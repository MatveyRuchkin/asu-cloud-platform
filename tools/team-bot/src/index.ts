import { Blockers } from './blockers';
import { GitHub, statusText } from './github';
import { Handler } from './handlers';
import { WorkersModel } from './llm';
import { Store } from './storage';
import { Telegram, flush } from './telegram';
import { Blocker, Env, Fetcher, RetryError, TelegramUpdate, UserError, int, now } from './types';

export async function secretMatches(actual: string | null, expected: string | undefined) {
  if (!actual || !expected || actual.length > 256) return false;
  const [a, b] = await Promise.all(
    [actual, expected].map((s) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))),
  );
  const x = new Uint8Array(a),
    y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
export function sanitize(raw: TelegramUpdate): TelegramUpdate | null {
  if (!Number.isSafeInteger(raw.update_id) || raw.update_id < 0) return null;
  const m = raw.message,
    q = raw.callback_query;
  if (
    m &&
    m.chat?.type === 'private' &&
    m.chat.id === m.from?.id &&
    Number.isSafeInteger(m.from.id)
  )
    return {
      update_id: raw.update_id,
      message: {
        message_id: m.message_id,
        from: { id: m.from.id },
        chat: { id: m.chat.id, type: 'private' },
        ...(typeof m.text === 'string' ? { text: m.text.slice(0, 6000) } : {}),
      },
    };
  if (
    q?.message?.chat.type === 'private' &&
    q.message.chat.id === q.from?.id &&
    Number.isSafeInteger(q.from.id)
  )
    return {
      update_id: raw.update_id,
      callback_query: {
        id: q.id,
        from: { id: q.from.id },
        data: (q.data || '').slice(0, 64),
        message: { message_id: q.message.message_id, chat: { id: q.from.id, type: 'private' } },
      },
    };
  return null;
}
async function limitedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  let size = 0,
    text = '';
  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 32768) {
      await reader.cancel();
      throw new UserError('body_too_large');
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
export async function webhook(request: Request, env: Env) {
  if (!env.TELEGRAM_WEBHOOK_SECRET) return new Response('Not configured', { status: 503 });
  if (
    !(await secretMatches(
      request.headers.get('X-Telegram-Bot-Api-Secret-Token'),
      env.TELEGRAM_WEBHOOK_SECRET,
    ))
  )
    return new Response('Forbidden', { status: 403 });
  let update: TelegramUpdate | null;
  try {
    update = sanitize(JSON.parse(await limitedBody(request)));
  } catch {
    return new Response('Invalid update', { status: 400 });
  }
  if (!update) return new Response('Ignored', { status: 200 });
  const uid = update.message?.from.id || update.callback_query!.from.id,
    store = new Store(env.DB),
    id = `u:${update.update_id}`;
  try {
    await env.DB.batch([
      store.stmt(
        'INSERT OR IGNORE INTO telegram_updates(update_id,telegram_id,payload,created) VALUES(?,?,?,?)',
        update.update_id,
        uid,
        JSON.stringify(update),
        now(),
      ),
      store.stmt(
        'INSERT OR IGNORE INTO jobs(id,kind,payload,available,updated) VALUES(?,?,?,?,?)',
        id,
        'update',
        JSON.stringify({ uid, update: update.update_id }),
        now(),
        now(),
      ),
    ]);
    const job = await store.first<{ status: string }>('SELECT status FROM jobs WHERE id=?', id);
    if (job?.status !== 'done') await env.JOBS.send({ id });
    return new Response('OK');
  } catch {
    // Telegram retries 503; an inserted inbox entry remains recoverable by Cron.
    console.warn('webhook_persist_or_enqueue_failed');
    return new Response('Retry later', { status: 503 });
  }
}
export async function processJob(
  id: string,
  env: Env,
  fetcher: Fetcher = (...args) => fetch(...args),
) {
  const store = new Store(env.DB);
  if (id.startsWith('n:')) {
    await new Telegram(env, store, fetcher).send(id.slice(2));
    return;
  }
  const job = await store.claim(id);
  if (!job) return;
  const payload = JSON.parse(job.payload) as {
    uid: number;
    update?: number;
    slug?: string;
    request?: number;
    blocker?: string;
  };
  try {
    if (job.kind === 'update') {
      const row = await store.first<{ payload: string | null }>(
        'SELECT payload FROM telegram_updates WHERE update_id=?',
        payload.update,
      );
      if (row?.payload) await new Handler(env, store, fetcher).handle(JSON.parse(row.payload));
      await store.run(
        'UPDATE telegram_updates SET payload=NULL,processed=? WHERE update_id=?',
        now(),
        payload.update,
      );
    } else if (job.kind === 'report') {
      const user = await store.requireUser(payload.uid),
        github = new GitHub(env, store, fetcher),
        team = await github.team();
      if (team.role(user.slug) === 'participant' || !team.scope(user.slug).includes(payload.slug!))
        throw new UserError('Доступ к отчёту отозван.');
      const member = team.member(payload.slug!),
        snapshot = await github.snapshot(member);
      const cutoff = Date.now() - int(env.STALE_DAYS, 7) * 86400000;
      const latest = Math.max(
        Date.parse(snapshot.issue.updated_at),
        ...snapshot.prs.map((p) => Date.parse(p.updated)),
      );
      await store.out(
        job.id,
        payload.uid,
        `Отчёт #${payload.request}: ${member.name}\n` +
          statusText(snapshot) +
          (latest < cutoff
            ? '\nДавно нет обновлений Issue/связанных PR. Локальная работа и другие каналы здесь не видны.'
            : ''),
      );
    } else if (job.kind === 'blocker') {
      const team = await new GitHub(env, store, fetcher).team();
      await new Blockers(env, store).tick(payload.blocker!, team);
    }
    await store.run("UPDATE jobs SET status='done',lease=0,updated=? WHERE id=?", now(), id);
  } catch (error) {
    if (error instanceof UserError) {
      if (payload.uid) await store.out(`${id}:error`, payload.uid, error.message);
      await store.run("UPDATE jobs SET status='done',lease=0,updated=? WHERE id=?", now(), id);
    } else {
      const delay =
        error instanceof RetryError
          ? error.delay
          : Math.min(3600, 60 * 2 ** Math.min(job.attempts, 5));
      await store.run(
        "UPDATE jobs SET status='pending',available=?,lease=0,updated=? WHERE id=?",
        now() + delay,
        now(),
        id,
      );
      if (payload.uid) {
        await store.seen(payload.uid);
        await store.out(
          `${id}:waiting`,
          payload.uid,
          'Внешний сервис временно недоступен. Запрос сохранён; бот повторит обработку. Состояние GitHub сейчас неизвестно.',
        );
      }
      await flush(env, store, 2);
      throw new RetryError(delay);
    }
  }
  await flush(env, store);
  // Fan-out report jobs are persisted before enqueueing. Cron recovers interrupted publication.
  const pending = await store.all<{ id: string }>(
    "SELECT id FROM jobs WHERE status='pending' AND available<=? LIMIT 4",
    now(),
  );
  if (pending.length) await env.JOBS.sendBatch(pending.map((r) => ({ body: { id: r.id } })));
}
export async function scheduled(env: Env) {
  const store = new Store(env.DB);
  const rows = await store.all<{ id: string }>(
    `SELECT id FROM jobs WHERE status!='done'
    AND available<=? AND lease<? ORDER BY available LIMIT 8`,
    now(),
    now(),
  );
  if (rows.length) await env.JOBS.sendBatch(rows.map((r) => ({ body: { id: r.id } })));
  await flush(env, store, 8);
  const blockers = await store.all<Blocker>(
    "SELECT * FROM blockers WHERE consent=1 AND state NOT IN ('done','cancelled') AND due<=? AND stage<5 LIMIT 6",
    now(),
  );
  for (const b of blockers)
    await store.job(
      `reminder:${b.id}:${b.stage}`,
      'blocker',
      { uid: b.author, blocker: b.id },
      env,
    );
  await env.DB.batch([
    store.stmt('DELETE FROM github_cache WHERE expires<?', now() - 86400),
    store.stmt('DELETE FROM drafts WHERE expires<?', now()),
    store.stmt('DELETE FROM requests WHERE created<?', now() - 7 * 86400),
    store.stmt(
      'DELETE FROM usage WHERE day<?',
      new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    ),
    store.stmt("DELETE FROM jobs WHERE status='done' AND updated<?", now() - 30 * 86400),
    store.stmt(
      "UPDATE notifications SET text='',markup=NULL WHERE status IN ('unavailable','rejected','uncertain') AND updated<?",
      now() - 30 * 86400,
    ),
  ]);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET')
      return Response.json({ service: 'asu-team-bot', ok: true });
    if (url.pathname === '/webhook' && request.method === 'POST') return webhook(request, env);
    if (url.pathname.startsWith('/diagnostics/') && request.method === 'POST') {
      if (
        !(await secretMatches(
          request.headers.get('Authorization'),
          env.DIAGNOSTIC_SECRET ? `Bearer ${env.DIAGNOSTIC_SECRET}` : undefined,
        ))
      )
        return new Response('Forbidden', { status: 403 });
      const store = new Store(env.DB);
      if (url.pathname === '/diagnostics/telegram') {
        try {
          const body = (await request.json()) as { send?: boolean };
          const me = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getMe`, {
            signal: AbortSignal.timeout(12000),
          });
          const result = (await me.json()) as { ok: boolean };
          if (!me.ok || !result.ok)
            return Response.json({ getMe: false, sendMessage: false }, { status: 502 });
          if (!body.send) return Response.json({ getMe: true, sendMessage: 'not-tested' });
          const uid = Number((env.ADMIN_TELEGRAM_IDS || '').split(',')[0]),
            user = await store.user(uid);
          if (user?.status !== 'approved' || !user.notify)
            return Response.json(
              { getMe: true, sendMessage: 'requires-approved-opted-in-admin' },
              { status: 412 },
            );
          const id = `diagnostic:${now()}`;
          await store.out(
            id,
            uid,
            'Проверка Cloudflare → Telegram: сообщение доставлено через Worker.',
            undefined,
            undefined,
            'notification',
          );
          await new Telegram(env, store).send(id + ':0');
          const status = await store.first<{ status: string }>(
            'SELECT status FROM notifications WHERE id=?',
            id + ':0',
          );
          return Response.json({ getMe: true, sendMessage: status?.status });
        } catch {
          return Response.json(
            { getMe: 'unconfirmed', sendMessage: 'unconfirmed' },
            { status: 502 },
          );
        }
      }
      if (url.pathname === '/diagnostics/ai') {
        let stage = 'input';
        try {
          const body = (await request.json()) as { issue: number; question: string };
          if (typeof body.question !== 'string' || body.question.length > 1800)
            return new Response('Invalid question', { status: 400 });
          stage = 'github-team';
          const github = new GitHub(env, store),
            team = await github.team();
          const member = team.data.members.find((m) => m.issue_number === body.issue);
          if (!member) return new Response('Unknown issue', { status: 400 });
          stage = 'github-snapshot';
          const snapshot = await github.snapshot(member);
          stage = 'github-document';
          const task_doc = (await github.document(`docs/tasks/${member.code}.md`)).slice(0, 1800);
          stage = 'workers-ai';
          const answer = await new WorkersModel(env, store).answer(0, body.question, {
            member,
            github: snapshot,
            task_doc,
          });
          return Response.json({
            model: env.AI_MODEL,
            issue: body.issue,
            checked: snapshot.checked,
            answer:
              answer +
              '\n\nИсточники:\n' +
              snapshot.issue.html_url +
              '\n' +
              github.file(`docs/tasks/${member.code}.md`),
            evaluation: 'Requires human review: facts, links, Russian clarity, next action.',
          });
        } catch (error) {
          return Response.json(
            {
              stage,
              error:
                error instanceof UserError
                  ? error.message
                  : error instanceof RetryError
                    ? 'external-service-temporary-failure'
                    : 'internal-processing-failure',
            },
            { status: 503 },
          );
        }
      }
    }
    return new Response('Not found', { status: 404 });
  },
  async queue(batch: MessageBatch<{ id: string }>, env: Env) {
    for (const message of batch.messages) {
      try {
        await processJob(message.body.id, env);
        message.ack();
      } catch (error) {
        console.warn('queue_job_retry');
        message.retry({
          delaySeconds: Math.min(3600, error instanceof RetryError ? error.delay : 60),
        });
      }
    }
  },
  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext) {
    try {
      await scheduled(env);
    } catch {
      console.warn('cron_recovery_failed');
    }
  },
} satisfies ExportedHandler<Env, { id: string }>;
