import { Store } from './storage';
import { Env, Fetcher, Markup, RetryError, now } from './types';

interface Notice {
  id: string;
  recipient: number;
  kind: string;
  text: string;
  markup: string | null;
  status: string;
  attempts: number;
  lease: number;
  available: number;
}
export class Telegram {
  constructor(
    private env: Env,
    private store: Store,
    private fetcher: Fetcher = (...args) => fetch(...args),
  ) {}
  async callback(id: string) {
    // Callback acknowledgement is best effort. All meaningful results use durable outbox.
    try {
      await this.fetcher(
        `https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN.trim()}/answerCallbackQuery`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: id }),
          signal: AbortSignal.timeout(4000),
        },
      );
    } catch {
      /* no private data in logs */
    }
  }
  async send(id: string) {
    const notice = await this.store.first<Notice>('SELECT * FROM notifications WHERE id=?', id);
    if (!notice || ['sent', 'unavailable', 'uncertain', 'rejected'].includes(notice.status)) return;
    if (notice.available > now()) throw new RetryError(notice.available - now());
    if (notice.status === 'sending') {
      if (notice.lease > now()) throw new RetryError(60);
      await this.store.run(
        "UPDATE notifications SET status='uncertain',updated=? WHERE id=?",
        now(),
        id,
      );
      return;
    }
    const user = await this.store.user(notice.recipient);
    // Direct replies require a known chat from a verified webhook. Push needs consent.
    if (!user || (notice.kind === 'notification' && (user.status !== 'approved' || !user.notify))) {
      await this.store.run(
        "UPDATE notifications SET status='unavailable',updated=? WHERE id=?",
        now(),
        id,
      );
      return;
    }
    const claimed = await this.store.first<Notice>(
      `UPDATE notifications SET status='sending',
      lease=?,attempts=attempts+1,updated=? WHERE id=? AND status IN ('pending','retry')
      AND available<=? RETURNING *`,
      now() + 60,
      now(),
      id,
      now(),
    );
    if (!claimed) return;
    let response: Response;
    try {
      response = await this.fetcher(
        `https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN.trim()}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            chat_id: notice.recipient,
            text: notice.text,
            ...(notice.markup ? { reply_markup: JSON.parse(notice.markup) as Markup } : {}),
          }),
        },
      );
    } catch {
      // Telegram has no idempotency key for sendMessage. Persist ambiguity for operator review.
      await this.store.run(
        "UPDATE notifications SET status='uncertain',updated=? WHERE id=?",
        now(),
        id,
      );
      return;
    }
    let data: {
      ok: boolean;
      result?: { message_id: number };
      parameters?: { retry_after?: number };
      error_code?: number;
    };
    try {
      data = await response.json();
    } catch {
      await this.store.run(
        "UPDATE notifications SET status='uncertain',updated=? WHERE id=?",
        now(),
        id,
      );
      return;
    }
    if (response.status === 429 || data.error_code === 429 || response.status >= 500) {
      const delay = Math.max(60, data.parameters?.retry_after || 0);
      await this.store.run(
        "UPDATE notifications SET status='retry',available=?,lease=0,updated=? WHERE id=?",
        now() + delay,
        now(),
        id,
      );
      throw new RetryError(delay);
    }
    if (!data.ok || !response.ok) {
      await this.store.run(
        'UPDATE notifications SET status=?,updated=? WHERE id=?',
        response.status === 403 ? 'unavailable' : 'rejected',
        now(),
        id,
      );
      return;
    }
    await this.store.run(
      "UPDATE notifications SET status='sent',message_id=?,text='',markup=NULL,updated=? WHERE id=?",
      data.result!.message_id,
      now(),
      id,
    );
  }
}
export async function flush(env: Env, store: Store, limit = 6) {
  const rows = await store.all<{ id: string }>(
    `SELECT id FROM notifications WHERE
    (status IN ('pending','retry') AND available<=?) OR (status='sending' AND lease<?) LIMIT ?`,
    now(),
    now(),
    limit,
  );
  if (rows.length) await env.JOBS.sendBatch(rows.map((r) => ({ body: { id: 'n:' + r.id } })));
}
