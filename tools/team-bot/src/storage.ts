import { Env, Job, Markup, User, UserError, now } from './types';

export class Store {
  constructor(public db: D1Database) {}
  stmt(sql: string, ...values: unknown[]) {
    return this.db.prepare(sql).bind(...values);
  }
  async first<T>(sql: string, ...values: unknown[]) {
    return this.stmt(sql, ...values).first<T>();
  }
  async all<T>(sql: string, ...values: unknown[]) {
    return (await this.stmt(sql, ...values).all<T>()).results;
  }
  async run(sql: string, ...values: unknown[]) {
    return this.stmt(sql, ...values).run();
  }
  user(uid: number) {
    return this.first<User>('SELECT * FROM users WHERE telegram_id=?', uid);
  }
  async requireUser(uid: number) {
    const user = await this.user(uid);
    if (user?.status !== 'approved' || !user.slug)
      throw new UserError('Нужна одобренная регистрация. Откройте /start.');
    return user as User & { slug: string };
  }
  async seen(uid: number) {
    await this.run(
      'INSERT OR IGNORE INTO users(telegram_id,created,updated) VALUES(?,?,?)',
      uid,
      now(),
      now(),
    );
  }
  async allow(uid: number) {
    const row = await this.first<{ count: number }>(
      `INSERT INTO rate_limits VALUES(?,?,1) ON CONFLICT(telegram_id) DO UPDATE SET
       count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window
       RETURNING count`,
      uid,
      Math.floor(now() / 60),
    );
    return !!row && row.count <= 10;
  }
  async job(id: string, kind: string, payload: unknown, env?: Env) {
    await this.run(
      'INSERT OR IGNORE INTO jobs(id,kind,payload,available,updated) VALUES(?,?,?,?,?)',
      id,
      kind,
      JSON.stringify(payload),
      now(),
      now(),
    );
    if (env) await env.JOBS.send({ id });
  }
  claim(id: string) {
    return this.first<Job>(
      `UPDATE jobs SET status='processing',lease=?,attempts=attempts+1,updated=?
      WHERE id=? AND status!='done' AND available<=? AND lease<? RETURNING *`,
      now() + 180,
      now(),
      id,
      now(),
      now(),
    );
  }
  async out(
    id: string,
    uid: number,
    text: string,
    markup?: Markup,
    blocker?: string,
    kind: 'reply' | 'notification' = 'reply',
  ) {
    // Every chunk has a stable ID, so replay never resends already committed replies.
    const chunks = text.match(/[\s\S]{1,3600}/g) || ['Нет данных.'];
    for (let i = 0; i < chunks.length; i++) {
      await this.run(
        `INSERT OR IGNORE INTO notifications
        (id,recipient,blocker,kind,text,markup,available,updated) VALUES(?,?,?,?,?,?,?,?)`,
        `${id}:${i}`,
        uid,
        blocker || null,
        kind,
        chunks[i],
        i === chunks.length - 1 && markup ? JSON.stringify(markup) : null,
        now(),
        now(),
      );
    }
  }
  async removeUser(uid: number) {
    const user = await this.user(uid);
    await this.db.batch([
      this.stmt('DELETE FROM blockers WHERE author=? OR target=?', uid, user?.slug || ''),
      this.stmt('UPDATE telegram_updates SET payload=NULL,telegram_id=0 WHERE telegram_id=?', uid),
      this.stmt('UPDATE registrations SET decided_by=NULL WHERE decided_by=?', uid),
      this.stmt("DELETE FROM jobs WHERE json_extract(payload,'$.uid')=?", uid),
      this.stmt('DELETE FROM usage WHERE key=?', `user:${uid}`),
      this.stmt('DELETE FROM rate_limits WHERE telegram_id=?', uid),
      this.stmt('DELETE FROM users WHERE telegram_id=?', uid),
    ]);
  }
}
