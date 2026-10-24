import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { afterAll, beforeAll, beforeEach, describe, it, expect, vi } from 'vitest';
import worker, { processJob, scheduled, webhook } from '../src/index';
import { Store } from '../src/storage';
import { Team } from '../src/team';
import { GitHub, statusText } from '../src/github';
import { WorkersModel } from '../src/llm';
import { Blockers } from '../src/blockers';
import { Handler } from '../src/handlers';
import { Telegram } from '../src/telegram';
import { approve, register } from '../src/users';
import { Env, Fetcher, RetryError, TelegramUpdate, UserError, now } from '../src/types';

const people = [
  ['pm', 'Руководитель Примеров', 'Руководитель проекта (PM)', null, 1],
  ['tech', 'Архитектор Примеров', 'Tech Lead', null, 2],
  ['lead', 'Лид Тестовый', 'Backend Lead', 'tech', 3],
  ['student', 'Участник Тестовый', 'Разработчик', 'lead', 17],
  ['other', 'Второй Примеров', 'Разработчик', 'tech', 18],
] as const;
const team = new Team({
  members: people.map(([slug, name, role, lead_slug, issue_number]) => ({
    slug,
    name,
    role,
    lead_slug,
    issue_number,
    department: 'Примеры',
    code: `TEST-${issue_number}`,
    task: 'Подготовить пример',
    deliverable: 'docs/example.md',
    steps: ['Уточнить поля', 'Проверить пример'],
    depends: 'Лид Тестовый',
  })),
  groups: [{ title: 'Backend + API', lead_slug: 'lead', member_slugs: ['student'] }],
});
const issue = (n = 17) => ({
  number: n,
  title: 'Контейнер',
  state: 'open',
  body: 'Нужен API',
  html_url: `https://github.com/test/repo/issues/${n}`,
  updated_at: '2020-01-01T00:00:00Z',
});
const pr = (n = 71, body = 'Closes #17') => ({
  ...issue(n),
  title: 'Add Docker',
  body,
  head: { sha: 'abc' },
  html_url: `https://github.com/test/repo/pull/${n}`,
  draft: false,
  merged_at: null,
  requested_reviewers: [{ login: 'reviewer' }],
});
function apiMock(): Fetcher {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input)),
      p = url.pathname;
    if (url.hostname === 'api.telegram.org')
      return Response.json({ ok: true, result: { message_id: 42 } });
    if (p.endsWith('/contents/site/team.json'))
      return Response.json({
        encoding: 'base64',
        content: Buffer.from(JSON.stringify(team.data)).toString('base64'),
      });
    if (p.includes('/contents/docs/'))
      return Response.json({
        encoding: 'base64',
        content: Buffer.from('Описание задания. Нужно согласовать API.').toString('base64'),
      });
    if (/\/issues\/\d+$/.test(p)) return Response.json(issue(Number(p.split('/').at(-1))));
    if (p.endsWith('/timeline')) return Response.json([]);
    if (p.endsWith('/pulls')) return Response.json([pr(), pr(72, 'Closes #170')]);
    if (p.endsWith('/pulls/71')) return Response.json(pr());
    if (p.endsWith('/reviews'))
      return Response.json([
        {
          user: { login: 'reviewer' },
          state: 'CHANGES_REQUESTED',
          body: 'Fix port',
          html_url: 'https://github.com/test/repo/pull/71#review',
        },
      ]);
    if (p.endsWith('/comments'))
      return Response.json([
        {
          body: 'Add timeout',
          path: 'app.ts',
          html_url: 'https://github.com/test/repo/pull/71#comment',
        },
      ]);
    if (p.endsWith('/check-runs'))
      return Response.json({
        check_runs: [
          {
            name: 'build',
            status: 'completed',
            conclusion: 'failure',
            html_url: 'https://github.com/test/repo/actions/1',
          },
        ],
      });
    if (p.endsWith('/status')) return Response.json({ state: 'pending', statuses: [] });
    if (p.endsWith('/actions/runs')) return Response.json({ workflow_runs: [] });
    throw new Error('Unexpected mock URL: ' + p);
  }) as Fetcher;
}
let mf: Miniflare, store: Store, env: Env;
const schema = readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8');
beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    compatibilityDate: '2026-07-01',
    d1Databases: ['DB'],
  });
  const db = await mf.getD1Database('DB');
  for (const sql of schema
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean))
    await db.prepare(sql).run();
  store = new Store(db as unknown as D1Database);
});
beforeEach(async () => {
  for (const table of [
    'notifications',
    'registrations',
    'drafts',
    'requests',
    'blockers',
    'users',
    'jobs',
    'telegram_updates',
    'usage',
    'rate_limits',
    'github_cache',
    'settings',
  ])
    await store.run(`DELETE FROM ${table}`);
  env = {
    DB: store.db,
    JOBS: {
      send: vi.fn(async () => {}),
      sendBatch: vi.fn(async () => {}),
    } as unknown as Env['JOBS'],
    TELEGRAM_BOT_TOKEN: 'fake-token',
    TELEGRAM_WEBHOOK_SECRET: 'test-secret',
    ADMIN_TELEGRAM_IDS: '100',
    GITHUB_REPOSITORY: 'test/repo',
    AI: { run: vi.fn(async () => ({ response: 'Проверьте контракт API.' })) },
  };
});
afterAll(async () => {
  await mf.dispose();
});
const msg = (id: number, text: string, uid = 400): TelegramUpdate => ({
  update_id: id,
  message: { message_id: id, from: { id: uid }, chat: { id: uid, type: 'private' }, text },
});
const cb = (id: number, data: string, uid = 400): TelegramUpdate => ({
  update_id: id,
  callback_query: {
    id: `q${id}`,
    from: { id: uid },
    data,
    message: { message_id: id, chat: { id: uid, type: 'private' } },
  },
});
async function users() {
  for (const [index, slug] of ['pm', 'tech', 'lead', 'student', 'other'].entries()) {
    const uid = (index + 1) * 100;
    await store.seen(uid);
    await register(store, team, uid, slug, `reg${uid}`);
    await approve(store, team, env, 100, `reg${uid}`, true);
    await store.run('UPDATE users SET notify=1 WHERE telegram_id=?', uid);
  }
  await store.run('DELETE FROM notifications');
}
async function replies(uid = 400) {
  return (
    await store.all<{ text: string }>('SELECT text FROM notifications WHERE recipient=?', uid)
  )
    .map((x) => x.text)
    .join('\n');
}
function req(update: TelegramUpdate, secret = 'test-secret') {
  return new Request('https://bot.test/webhook', {
    method: 'POST',
    headers: { 'X-Telegram-Bot-Api-Secret-Token': secret },
    body: JSON.stringify(update),
  });
}

describe('durable webhook and queues', () => {
  it('rejects wrong secret before DB/queue processing', async () => {
    expect((await webhook(req(msg(1, '/start'), 'wrong'), env)).status).toBe(403);
    expect(await store.all('SELECT * FROM telegram_updates')).toHaveLength(0);
    expect(env.JOBS.send).not.toHaveBeenCalled();
  });
  it('persists update before acknowledgement; no AI in fetch', async () => {
    expect((await webhook(req(msg(1, '/start')), env)).status).toBe(200);
    expect(await store.all('SELECT * FROM telegram_updates')).toHaveLength(1);
    expect(env.AI!.run).not.toHaveBeenCalled();
    expect(env.JOBS.send).toHaveBeenCalledWith({ id: 'u:1' });
  });
  it('deduplicates repeated update and queue delivery', async () => {
    await webhook(req(msg(1, '/whoami')), env);
    await webhook(req(msg(1, '/whoami')), env);
    const fetcher = apiMock();
    await processJob('u:1', env, fetcher);
    await processJob('u:1', env, fetcher);
    expect(await store.all('SELECT * FROM telegram_updates')).toHaveLength(1);
    expect(await store.all('SELECT * FROM notifications')).toHaveLength(1);
    expect(
      (await store.first<{ payload: null }>('SELECT payload FROM telegram_updates'))!.payload,
    ).toBeNull();
  });
  it('returns 503 after queue failure and Cron recovers persisted inbox', async () => {
    env.JOBS.send = vi.fn(async () => {
      throw new Error('queue unavailable');
    });
    expect((await webhook(req(msg(1, '/whoami')), env)).status).toBe(503);
    await scheduled(env);
    expect(env.JOBS.sendBatch).toHaveBeenCalledWith([{ body: { id: 'u:1' } }]);
  });
  it('ignores groups and spoofed private chat IDs', async () => {
    const u = msg(1, 'hello');
    u.message!.chat = { id: -100, type: 'supergroup' };
    await webhook(req(u), env);
    u.message!.chat = { id: 500, type: 'private' };
    await webhook(req(u), env);
    expect(await store.all('SELECT * FROM jobs')).toHaveLength(0);
  });
  it('rejects malformed and oversized request bodies', async () => {
    const headers = { 'X-Telegram-Bot-Api-Secret-Token': 'test-secret' };
    expect(
      (await webhook(new Request('https://x', { method: 'POST', headers, body: 'bad' }), env))
        .status,
    ).toBe(400);
    expect(
      (
        await webhook(
          new Request('https://x', { method: 'POST', headers, body: 'x'.repeat(33000) }),
          env,
        )
      ).status,
    ).toBe(400);
  });
  it('preserves request and schedules retry on GitHub outage', async () => {
    await users();
    await webhook(req(msg(10, '/status')), env);
    await expect(
      processJob('u:10', env, vi.fn(async () => new Response('', { status: 503 })) as Fetcher),
    ).rejects.toBeInstanceOf(RetryError);
    expect(
      (await store.first<{ status: string }>('SELECT status FROM jobs WHERE id=?', 'u:10'))!.status,
    ).toBe('pending');
    expect(
      (await store.first<{ payload: string }>(
        'SELECT payload FROM telegram_updates WHERE update_id=10',
      ))!.payload,
    ).toContain('/status');
    expect(await replies()).toContain('Запрос сохранён');
  });
});

describe('registration and authorization', () => {
  it('requires admin approval; buttons do not grant a role', async () => {
    const h = new Handler(env, store, apiMock());
    await h.handle(msg(1, '/start'));
    await h.handle(cb(2, 'register:student'));
    expect((await store.user(400))!.status).toBe('pending');
    await expect(store.requireUser(400)).rejects.toBeInstanceOf(UserError);
    await approve(store, team, env, 100, 'r2', true);
    expect((await store.requireUser(400)).slug).toBe('student');
  });
  it('prevents impersonation and changing an approved identity', async () => {
    await users();
    await store.seen(999);
    await expect(register(store, team, 999, 'student', 'x')).rejects.toThrow('другим Telegram');
    await expect(register(store, team, 400, 'pm', 'x')).rejects.toThrow('Привязку');
  });
  it('prevents concurrent approvals of the same member', async () => {
    await store.seen(1);
    await store.seen(2);
    await register(store, team, 1, 'student', 'a');
    await register(store, team, 2, 'student', 'b');
    await approve(store, team, env, 100, 'a', true);
    await expect(approve(store, team, env, 100, 'b', true)).rejects.toThrow(
      'Одобрение не выполнено',
    );
  });
  it('rejects stale approval and forged admin callback', async () => {
    await store.seen(400);
    await register(store, team, 400, 'student', 'a');
    await register(store, team, 400, 'pm', 'b');
    await expect(approve(store, team, env, 100, 'a', true)).rejects.toThrow('устарела');
    await new Handler(env, store, apiMock()).handle(cb(3, 'approve:b:yes', 999));
    expect((await store.user(400))!.status).toBe('pending');
  });
  it('denies administrative reports to unregistered and participants', async () => {
    const h = new Handler(env, store, apiMock());
    await h.handle(msg(1, '/report'));
    expect(await replies()).toContain('одобренная');
    await users();
    await h.handle(msg(2, '/report'));
    expect(await replies()).toContain('руководителям');
    expect(await store.all("SELECT * FROM jobs WHERE kind='report'")).toHaveLength(0);
  });
  it('scopes lead reports and never shares unconsented descriptions', async () => {
    await users();
    await new Blockers(env, store).create(400, 'lead', 'Личное описание', team, 'b1');
    await new Handler(env, store, apiMock()).handle(msg(1, '/report', 300));
    expect(await replies(300)).not.toContain('Личное описание');
    expect(await store.all("SELECT * FROM jobs WHERE kind='report'")).toHaveLength(2);
  });
  it('derives roles and routes Backend questions from team.json', () => {
    expect(team.role('pm')).toBe('project_manager');
    expect(team.role('tech')).toBe('tech_lead');
    expect(team.role('lead')).toBe('lead');
    expect(team.role('student')).toBe('participant');
    expect(team.suggest('Жду Backend', 'student')).toBe('lead');
  });
  it('preserves data across a new repository instance', async () => {
    await users();
    expect((await new Store(store.db).requireUser(400)).slug).toBe('student');
  });
  it('disabled users cannot reregister and deletion removes private data', async () => {
    await users();
    await new Blockers(env, store).create(400, 'lead', 'Нужен контракт', team, 'b1');
    await store.run("UPDATE users SET status='disabled' WHERE telegram_id=400");
    await expect(register(store, team, 400, 'student', 'x')).rejects.toThrow('Привязку');
    await store.removeUser(400);
    expect(await store.user(400)).toBeNull();
    expect(await store.all('SELECT * FROM blockers')).toHaveLength(0);
  });
});

describe('GitHub and AI', () => {
  it('finds own Issue, PR #17 references, failures and review comments', async () => {
    await users();
    const fetcher = apiMock(),
      h = new Handler(env, store, fetcher);
    await h.handle(msg(1, '/mytask'));
    await h.handle(msg(2, '/status'));
    const text = await replies();
    expect(text).toContain('Issue: open');
    expect(text).toContain('PR #71');
    expect(text).not.toContain('PR #72');
    expect(text).toContain('failure');
    expect(text).toContain('Fix port');
    expect(text).toContain('Add timeout');
    expect(env.AI!.run).not.toHaveBeenCalled();
  });
  it.each([403, 404, 429, 503])('handles GitHub HTTP %s honestly', async (code) => {
    const github = new GitHub(
      env,
      store,
      vi.fn(async () => new Response('', { status: code })) as Fetcher,
    );
    await expect(github.get('/issues/17')).rejects.toBeInstanceOf(
      code === 404 ? UserError : RetryError,
    );
  });
  it('cache expires without silently returning stale facts', async () => {
    const fetcher = apiMock(),
      gh = new GitHub(env, store, fetcher);
    await gh.issue(17);
    await gh.issue(17);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await store.run('UPDATE github_cache SET expires=0');
    const broken = new GitHub(
      env,
      store,
      vi.fn(async () => new Response('', { status: 404 })) as Fetcher,
    );
    await expect(broken.issue(17)).rejects.toThrow('неизвестно');
  });
  it('missing PR never implies inactivity', async () => {
    const s = await new GitHub(env, store, apiMock()).snapshot(team.member('other'));
    expect(statusText(s)).toContain('не означает отсутствия работы');
  });
  it('uses AI binding only for a question; constrains requests and context', async () => {
    await users();
    const h = new Handler(env, store, apiMock());
    await h.handle(msg(1, '/ask Что делать дальше?'));
    expect(env.AI!.run).toHaveBeenCalledTimes(1);
    expect(await replies()).toContain('контракт');
    env.AI_DAILY_USER_REQUESTS = '1';
    await expect(new WorkersModel(env, store).answer(400, 'Ещё?', {})).rejects.toThrow('лимит');
  });
  it('AI failure never silently invokes Yandex', async () => {
    env.AI!.run = vi.fn(async () => {
      throw new Error('quota');
    });
    const fetcher = vi.fn(async () => new Response());
    await expect(new WorkersModel(env, store, fetcher).answer(400, 'Вопрос', {})).rejects.toThrow(
      'Платный резерв выключен',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('missing AI binding leaves non-AI commands available', async () => {
    await users();
    delete env.AI;
    await expect(new WorkersModel(env, store).answer(400, 'Вопрос', {})).rejects.toThrow('binding');
    await new Handler(env, store, apiMock()).handle(msg(1, '/mytask'));
    expect(await replies()).toContain('Подготовить пример');
  });
});

describe('blockers and reliable notifications', () => {
  it('creates and deduplicates blockers; only explicit consent enables sharing', async () => {
    await users();
    const b = new Blockers(env, store);
    const first = await b.create(400, 'lead', 'Нужен контракт', team, 'b1');
    expect((await b.create(400, 'lead', 'Тот же контракт!', team, 'b2')).id).toBe(first.id);
    expect(await store.all('SELECT * FROM notifications')).toHaveLength(0);
    await expect(b.share('b1', 500)).rejects.toThrow('автор');
    await b.share('b1', 400);
    await b.share('b1', 400);
    expect(await store.all('SELECT * FROM notifications')).toHaveLength(1);
  });
  it('does not pretend to notify a person without chat/consent', async () => {
    await users();
    await store.run('DELETE FROM users WHERE telegram_id=300');
    const b = new Blockers(env, store);
    await b.create(400, 'lead', 'Нужен контракт', team, 'b1');
    expect(await b.share('b1', 400)).toBe(false);
    expect(await store.all('SELECT * FROM notifications')).toHaveLength(0);
  });
  it.each(['answering', 'done', 'help', 'wrong'])(
    'handles recipient action %s and notifies author',
    async (state) => {
      await users();
      const b = new Blockers(env, store);
      await b.create(400, 'lead', 'Нужен контракт', team, 'b1');
      await b.share('b1', 400);
      await new Telegram(env, store, apiMock()).send('blocker:b1:initial:0');
      await expect(b.respond('b1', 500, state, 'x')).rejects.toThrow('не получатель');
      await b.respond('b1', 300, state, 'response1');
      expect((await b.get('b1')).state).toBe(state);
      expect(await replies()).toContain('Блокер #b1');
    },
  );
  it('author closes blockers, unrelated users cannot', async () => {
    await users();
    const b = new Blockers(env, store);
    await b.create(400, 'lead', 'Нужен контракт', team, 'b1');
    await expect(b.close('b1', 500)).rejects.toThrow('автор');
    await b.close('b1', 400);
    expect((await b.get('b1')).state).toBe('done');
  });
  it('reminds once and escalates first to lead, without ordinary PM alerts', async () => {
    await users();
    const b = new Blockers(env, store);
    await b.create(400, 'other', 'Жду тестовые данные', team, 'b1');
    await b.share('b1', 400);
    await store.run('UPDATE blockers SET due=0');
    await b.tick('b1', team);
    await b.tick('b1', team);
    expect((await b.get('b1')).stage).toBe(1);
    await store.run('UPDATE blockers SET due=0');
    await b.tick('b1', team);
    expect(
      await store.first("SELECT 1 FROM notifications WHERE recipient=200 AND id LIKE '%stage:1%'"),
    ).not.toBeNull();
    expect(await store.first('SELECT 1 FROM notifications WHERE recipient=100')).toBeNull();
  });
  it('records Telegram success and never resends on queue replay', async () => {
    await users();
    await store.out('reply', 400, 'Hello');
    const f = apiMock(),
      t = new Telegram(env, store, f);
    await t.send('reply:0');
    await t.send('reply:0');
    expect(f).toHaveBeenCalledTimes(1);
    expect(
      (await store.first<{ status: string }>('SELECT status FROM notifications'))!.status,
    ).toBe('sent');
  });
  it('retains uncertain delivery without automatically sending duplicates', async () => {
    await users();
    await store.out('reply', 400, 'Hello');
    const f = vi.fn(async () => {
      throw new Error('timeout');
    }) as Fetcher;
    const t = new Telegram(env, store, f);
    await t.send('reply:0');
    await t.send('reply:0');
    expect(f).toHaveBeenCalledTimes(1);
    expect(
      (await store.first<{ status: string }>('SELECT status FROM notifications'))!.status,
    ).toBe('uncertain');
  });
  it('honors Telegram Retry-After and retries later', async () => {
    await users();
    await store.out('reply', 400, 'Hello');
    await expect(
      new Telegram(
        env,
        store,
        vi.fn(async () =>
          Response.json(
            { ok: false, error_code: 429, parameters: { retry_after: 200 } },
            { status: 429 },
          ),
        ) as Fetcher,
      ).send('reply:0'),
    ).rejects.toBeInstanceOf(RetryError);
    const row = await store.first<{ status: string; available: number }>(
      'SELECT status,available FROM notifications',
    );
    expect(row!.status).toBe('retry');
    expect(row!.available).toBeGreaterThanOrEqual(now() + 199);
  });
  it('checks opt-out immediately before a queued notification is sent', async () => {
    await users();
    await store.out('push', 400, 'Hello', undefined, undefined, 'notification');
    await store.run('UPDATE users SET notify=0 WHERE telegram_id=400');
    const f = apiMock();
    await new Telegram(env, store, f).send('push:0');
    expect(f).not.toHaveBeenCalled();
  });
});

it('health has no secrets and unknown routes are closed', async () => {
  expect((await worker.fetch(new Request('https://x/health'), env)).status).toBe(200);
  expect(
    (await worker.fetch(new Request('https://x/diagnostics/telegram', { method: 'POST' }), env))
      .status,
  ).toBe(403);
  expect((await worker.fetch(new Request('https://x/'), env)).status).toBe(404);
});
