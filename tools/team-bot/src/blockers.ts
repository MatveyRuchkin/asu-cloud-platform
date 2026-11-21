import { Store } from './storage';
import { Team } from './team';
import { Blocker, Env, UserError, buttons, int, now } from './types';

export const states: Record<string, string> = {
  open: 'Открыт',
  answering: 'Отвечу',
  done: 'Уже готово',
  help: 'Нужна помощь',
  wrong: 'Не моя задача',
  cancelled: 'Отменён',
};
export const responses = (id: string) =>
  buttons(['answering', 'done', 'help', 'wrong'].map((s) => [[states[s], `reply:${id}:${s}`]]));

export class Blockers {
  constructor(
    private env: Env,
    private store: Store,
  ) {}
  async get(id: string) {
    const b = await this.store.first<Blocker>('SELECT * FROM blockers WHERE id=?', id);
    if (!b) throw new UserError('Блокер не найден или удалён.');
    return b;
  }
  async create(uid: number, target: string, summary: string, team: Team, id: string) {
    const author = await this.store.requireUser(uid),
      member = team.member(author.slug);
    team.member(target);
    if (target === author.slug)
      throw new UserError('Выберите другого участника или своего руководителя.');
    if (summary.trim().length < 5 || summary.length > 600)
      throw new UserError('Описание: 5–600 символов без паролей и ключей.');
    await this.store.run(
      `INSERT OR IGNORE INTO blockers(id,author,target,issue,summary,created,updated,due)
      VALUES(?,?,?,?,?,?,?,?)`,
      id,
      uid,
      target,
      member.issue_number,
      summary.trim(),
      now(),
      now(),
      now() + int(this.env.REMINDER_HOURS, 24) * 3600,
    );
    const b = await this.store.first<Blocker>(
      "SELECT * FROM blockers WHERE author=? AND target=? AND issue=? AND state NOT IN ('done','cancelled')",
      uid,
      target,
      member.issue_number,
    );
    if (!b) throw new UserError('Карточку не удалось создать. Попробуйте снова.');
    return b;
  }
  async share(id: string, uid: number) {
    await this.store.requireUser(uid);
    const b = await this.get(id);
    if (b.author !== uid || ['done', 'cancelled'].includes(b.state))
      throw new UserError('Отправку подтверждает автор открытого блокера.');
    await this.store.run('UPDATE blockers SET consent=1 WHERE id=?', id);
    return this.notifyTarget(b, b.target, `blocker:${id}:initial`, 'Блокер');
  }
  private async notifyTarget(b: Blocker, slug: string, key: string, label: string) {
    const user = await this.store.first<{ telegram_id: number; notify: number }>(
      "SELECT * FROM users WHERE slug=? AND status='approved'",
      slug,
    );
    if (!user?.notify) return false;
    await this.store.out(
      key,
      user.telegram_id,
      `${label} #${b.id}, задача #${b.issue}\n${b.summary}\nhttps://github.com/${this.env.GITHUB_REPOSITORY || 'MatveyRuchkin/asu-cloud-platform'}/issues/${b.issue}`,
      responses(b.id),
      b.id,
      'notification',
    );
    return true;
  }
  async respond(id: string, uid: number, state: string, key: string) {
    await this.store.requireUser(uid);
    const b = await this.get(id);
    const delivered = await this.store.first(
      "SELECT 1 FROM notifications WHERE blocker=? AND recipient=? AND kind='notification' AND status IN ('sent','sending','uncertain')",
      id,
      uid,
    );
    if (!b.consent || !delivered || !['answering', 'done', 'help', 'wrong'].includes(state))
      throw new UserError('Вы не получатель этого блокера.');
    if (['done', 'cancelled'].includes(b.state)) throw new UserError('Блокер уже закрыт.');
    await this.store.run('UPDATE blockers SET state=?,updated=? WHERE id=?', state, now(), id);
    await this.store.out(
      key,
      b.author,
      `Блокер #${id}: ${states[state]}. Изменения доступны в /blockers.`,
      undefined,
      id,
      'notification',
    );
  }
  async close(id: string, uid: number) {
    await this.store.requireUser(uid);
    const b = await this.get(id);
    if (b.author !== uid)
      throw new UserError('Закрыть блокер может автор; получатель нажимает «Уже готово».');
    await this.store.run("UPDATE blockers SET state='done',updated=? WHERE id=?", now(), id);
  }
  async tick(id: string, team: Team) {
    const b = await this.get(id),
      author = await this.store.user(b.author);
    if (
      !b.consent ||
      ['done', 'cancelled'].includes(b.state) ||
      b.stage >= 5 ||
      b.due > now() ||
      author?.status !== 'approved'
    )
      return;
    const tech = team.special('tech_lead');
    const target =
      b.stage === 0
        ? b.target
        : b.stage === 1
          ? team.lead(b.target)
          : b.stage === 2 || (b.stage === 3 && !b.critical)
            ? tech
            : team.special('project_manager');
    const queued = await this.notifyTarget(
      b,
      target,
      `blocker:${id}:stage:${b.stage}`,
      b.stage === 0 ? 'Напоминание' : 'Эскалация',
    );
    await this.store.out(
      `blocker:${id}:stage-result:${b.stage}`,
      b.author,
      `Блокер #${id}: ${team.member(target).name}. ` +
        (queued
          ? 'Уведомление поставлено в очередь; доставка ещё не подтверждена.'
          : 'Уведомление не отправлено: участник не зарегистрирован или отключил уведомления.'),
      undefined,
      id,
      'notification',
    );
    await this.store.run(
      'UPDATE blockers SET stage=?,due=? WHERE id=? AND stage=?',
      b.stage === 3 && b.critical ? 5 : b.stage + 1,
      now() + int(this.env.ESCALATION_HOURS, 48) * 3600,
      id,
      b.stage,
    );
  }
}
