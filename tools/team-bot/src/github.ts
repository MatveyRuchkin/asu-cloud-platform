import { Store } from './storage';
import { Team } from './team';
import { Env, Fetcher, Member, RetryError, TeamData, UserError, int, now } from './types';

interface Issue {
  number: number;
  title: string;
  state: string;
  body?: string;
  html_url: string;
  updated_at: string;
  repository_url?: string;
  pull_request?: unknown;
}
interface Pull extends Issue {
  draft: boolean;
  merged_at?: string;
  head: { sha: string };
  requested_reviewers: { login: string }[];
}
interface Review {
  state: string;
  body?: string;
  html_url: string;
  user: { login: string };
}
interface ReviewComment {
  body: string;
  path: string;
  html_url: string;
}
interface Check {
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
}
interface Status {
  state: string;
  statuses: { state: string; context: string; target_url: string }[];
}
export interface Snapshot {
  checked: string;
  ttl: number;
  issue: Issue;
  prs: {
    number: number;
    url: string;
    state: string;
    draft: boolean;
    updated: string;
    reviewers: string[];
    reviews: Review[];
    comments: ReviewComment[];
    checks: Check[];
    actions: Check[];
    statuses: Status['statuses'];
  }[];
  note: string;
}
export class GitHub {
  root: string;
  web: string;
  calls = 0;
  constructor(
    private env: Env,
    private store: Store,
    private fetcher: Fetcher = (...args) => fetch(...args),
  ) {
    const repo = env.GITHUB_REPOSITORY || 'MatveyRuchkin/asu-cloud-platform';
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new UserError('Ошибка GITHUB_REPOSITORY.');
    this.root = `https://api.github.com/repos/${repo}`;
    this.web = `https://github.com/${repo}`;
  }
  file(path: string) {
    return `${this.web}/blob/${encodeURIComponent(this.env.GITHUB_REF || 'dev')}/${path}`;
  }
  async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = this.root + path + '?' + new URLSearchParams(params);
    const cached = await this.store.first<{ value: string }>(
      'SELECT value FROM github_cache WHERE key=? AND expires>?',
      url,
      now(),
    );
    if (cached) return JSON.parse(cached.value) as T;
    const rate = await this.store.first<{ value: string }>(
      "SELECT value FROM settings WHERE key='github_retry_at'",
    );
    if (rate && Number(rate.value) > now())
      throw new RetryError(Math.min(3600, Number(rate.value) - now()));
    if (++this.calls > 32)
      throw new UserError('Слишком большой запрос GitHub для Free-плана. Уточните вопрос.');
    let response: Response;
    try {
      response = await this.fetcher(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'ASU-Team-Bot',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(this.env.GITHUB_TOKEN ? { Authorization: `Bearer ${this.env.GITHUB_TOKEN}` } : {}),
        },
        signal: AbortSignal.timeout(12000),
        redirect: 'manual',
      });
    } catch {
      throw new RetryError();
    }
    if ([403, 429].includes(response.status)) {
      const delay = Math.max(
        60,
        Number(response.headers.get('retry-after')) || 0,
        (Number(response.headers.get('x-ratelimit-reset')) || 0) - now(),
      );
      await response.body?.cancel();
      await this.store.run(
        "INSERT INTO settings VALUES('github_retry_at',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        String(now() + delay),
      );
      throw new RetryError(Math.min(delay, 3600));
    }
    if (response.status >= 500) {
      await response.body?.cancel();
      throw new RetryError();
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new UserError(
        'GitHub не предоставил данные. Состояние задачи неизвестно. Проверьте доступ или повторите позже.',
      );
    }
    const raw = await response.text();
    let data: T;
    try {
      data = JSON.parse(raw) as T;
    } catch {
      throw new RetryError();
    }
    if (raw.length < 200000)
      await this.store.run(
        'INSERT INTO github_cache VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,expires=excluded.expires',
        url,
        raw,
        now() + int(this.env.GITHUB_CACHE_TTL, 90, 300),
      );
    return data;
  }
  async pages<T>(path: string, params: Record<string, string> = {}, field?: string): Promise<T[]> {
    const rows: T[] = [];
    for (let page = 1; page <= 3; page++) {
      const data = await this.get<T[] | Record<string, T[]>>(path, {
        ...params,
        per_page: '100',
        page: String(page),
      });
      const part = field ? (data as Record<string, T[]>)[field] : (data as T[]);
      rows.push(...part);
      if (part.length < 100) return rows;
    }
    throw new UserError(
      'GitHub вернул более 300 записей. Нужен более узкий запрос; сводка неполная.',
    );
  }
  async document(path: string) {
    const data = await this.get<{ encoding: string; content: string }>(`/contents/${path}`, {
      ref: this.env.GITHUB_REF || 'dev',
    });
    if (data.encoding !== 'base64') throw new UserError('Документ GitHub не удалось прочитать.');
    return new TextDecoder().decode(
      Uint8Array.from(atob(data.content.replaceAll('\n', '')), (c) => c.charCodeAt(0)),
    );
  }
  async team() {
    return new Team(JSON.parse(await this.document('site/team.json')) as TeamData);
  }
  issue(n: number) {
    return this.get<Issue>(`/issues/${n}`);
  }
  async linked(n: number) {
    const events = await this.pages<{ source?: { issue?: Issue } }>(`/issues/${n}/timeline`);
    const numbers = new Set(
      events
        .map((e) => e.source?.issue)
        .filter((i) => i?.pull_request && i.repository_url === this.root)
        .map((i) => i!.number),
    );
    const escaped = this.web.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![\\w/#])#${n}(?!\\d)|${escaped}/issues/${n}(?!\\d)`);
    for (const pr of await this.pages<Pull>('/pulls', {
      state: 'all',
      sort: 'updated',
      direction: 'desc',
    }))
      if (pattern.test(pr.title + '\n' + (pr.body || ''))) numbers.add(pr.number);
    return [...numbers];
  }
  async snapshot(member: Member): Promise<Snapshot> {
    const issue = await this.issue(member.issue_number);
    issue.body = (issue.body || '').slice(0, 1800);
    const linked = await this.linked(member.issue_number),
      prs: Snapshot['prs'] = [];
    for (const n of linked.slice(-2)) {
      const pr = await this.get<Pull>(`/pulls/${n}`);
      const reviews = await this.pages<Review>(`/pulls/${n}/reviews`);
      const latest = new Map<string, Review>();
      for (const r of reviews)
        if (['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state))
          latest.set(r.user.login, { ...r, body: (r.body || '').slice(0, 600) });
      const comments = await this.pages<ReviewComment>(`/pulls/${n}/comments`);
      const sha = encodeURIComponent(pr.head.sha);
      const checks = await this.get<{ check_runs: Check[] }>(`/commits/${sha}/check-runs`, {
        per_page: '50',
      });
      const statuses = await this.get<Status>(`/commits/${sha}/status`);
      const actions = await this.get<{ workflow_runs: Check[] }>('/actions/runs', {
        head_sha: pr.head.sha,
        per_page: '50',
      });
      prs.push({
        number: n,
        url: pr.html_url,
        state: pr.merged_at ? 'merged' : pr.state,
        draft: pr.draft,
        updated: pr.updated_at,
        reviewers: pr.requested_reviewers.map((r) => r.login),
        reviews: [...latest.values()],
        comments: comments.slice(-5).map((r) => ({ ...r, body: r.body.slice(0, 600) })),
        checks: checks.check_runs,
        actions: actions.workflow_runs,
        statuses: statuses.statuses,
      });
    }
    return {
      checked: new Date().toISOString(),
      ttl: int(this.env.GITHUB_CACHE_TTL, 90, 300),
      issue,
      prs,
      note:
        (linked.length > 2
          ? `Показаны 2 из ${linked.length} PR. Остальные проверьте на GitHub. `
          : '') +
        (prs.some((p) => p.checks.length >= 50 || p.actions.length >= 50 || p.statuses.length >= 30)
          ? 'Список проверок/статусов может быть сокращён; полный список откройте по ссылке PR.'
          : ''),
    };
  }
}
export function statusText(s: Snapshot) {
  const lines = [
    `Задача #${s.issue.number}: ${s.issue.title} — ${s.issue.state}`,
    s.issue.html_url,
    `Проверено ${s.checked} (UTC), кэш до ${s.ttl} с.`,
    s.note,
  ];
  if (!s.prs.length)
    lines.push(
      'Связанные PR не найдены. Это не означает отсутствия работы. Если PR есть, добавьте ссылку на Issue в его описание.',
    );
  for (const p of s.prs) {
    lines.push(`PR #${p.number}: ${p.state}${p.draft ? ' (черновик)' : ''}`, p.url);
    const checks = [...p.checks, ...p.actions];
    for (const c of checks) lines.push(`${c.name}: ${c.conclusion || c.status} ${c.html_url}`);
    for (const c of p.statuses) lines.push(`${c.context}: ${c.state} ${c.target_url}`);
    if (!checks.length && !p.statuses.length)
      lines.push('Проверки не найдены; успешность сборки не подтверждена.');
    if (p.reviewers.length) lines.push('Запрошено ревью: ' + p.reviewers.join(', '));
    for (const r of p.reviews) lines.push(`Ревью ${r.state}: ${r.body || ''}\n${r.html_url}`);
    for (const r of p.comments) lines.push(`Замечание ${r.path}: ${r.body}\n${r.html_url}`);
    const failure =
      checks.some((c) =>
        ['failure', 'timed_out', 'action_required'].includes(c.conclusion || ''),
      ) || p.statuses.some((c) => ['failure', 'error'].includes(c.state));
    if (p.state === 'open')
      lines.push(
        'Следующий шаг: ' +
          (failure
            ? 'откройте ошибку проверки по ссылке и исправьте её в своём PR.'
            : p.reviews.some((r) => r.state === 'CHANGES_REQUESTED')
              ? 'исправьте замечания проверяющего.'
              : p.draft
                ? 'завершите черновик и отправьте на ревью.'
                : 'дождитесь ревью; при задержке обратитесь к своему лиду.'),
      );
  }
  return lines.filter(Boolean).join('\n');
}
