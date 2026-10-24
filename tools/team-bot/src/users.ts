import { Store } from './storage';
import { Team } from './team';
import { Env, UserError, buttons, now } from './types';

export function requireAdmin(env: Env, uid: number) {
  if (
    !(env.ADMIN_TELEGRAM_IDS || '')
      .split(',')
      .map((x) => x.trim())
      .includes(String(uid))
  )
    throw new UserError('Действие доступно только администратору.');
}
export async function register(store: Store, team: Team, uid: number, slug: string, id: string) {
  team.member(slug);
  const user = await store.user(uid);
  if (['approved', 'disabled'].includes(user?.status || ''))
    throw new UserError('Привязку нельзя менять самостоятельно. Обратитесь к администратору.');
  const occupied = await store.first(
    'SELECT 1 FROM users WHERE slug=? AND status=?',
    slug,
    'approved',
  );
  if (occupied)
    throw new UserError(
      'Имя уже подтверждено за другим Telegram ID. Администратор должен проверить личность.',
    );
  await store.db.batch([
    store.stmt(
      "UPDATE registrations SET status='superseded' WHERE telegram_id=? AND status='pending' AND id!=?",
      uid,
      id,
    ),
    store.stmt(
      "UPDATE users SET slug=?,status='pending',notify=0,updated=? WHERE telegram_id=?",
      slug,
      now(),
      uid,
    ),
    store.stmt(
      'INSERT OR IGNORE INTO registrations(id,telegram_id,slug,created) VALUES(?,?,?,?)',
      id,
      uid,
      slug,
      now(),
    ),
  ]);
}
export async function approve(
  store: Store,
  team: Team,
  env: Env,
  admin: number,
  id: string,
  yes: boolean,
) {
  requireAdmin(env, admin);
  const registration = await store.first<{ telegram_id: number; slug: string; status: string }>(
    'SELECT * FROM registrations WHERE id=?',
    id,
  );
  if (!registration || registration.status !== 'pending')
    throw new UserError('Заявка уже обработана или устарела. /pending');
  team.member(registration.slug);
  const user = await store.user(registration.telegram_id);
  if (user?.status !== 'pending' || user.slug !== registration.slug)
    throw new UserError('Участник изменил заявку. Откройте /pending.');
  try {
    await store.db.batch([
      store.stmt(
        "UPDATE users SET status=?,updated=? WHERE telegram_id=? AND status='pending' AND slug=?",
        yes ? 'approved' : 'rejected',
        now(),
        user.telegram_id,
        registration.slug,
      ),
      store.stmt(
        "UPDATE registrations SET status=?,decided_by=?,decided_at=? WHERE id=? AND status='pending'",
        yes ? 'approved' : 'rejected',
        admin,
        now(),
        id,
      ),
    ]);
  } catch {
    throw new UserError('Одобрение не выполнено: это имя уже занято или база недоступна. /pending');
  }
  await store.out(
    `registration:${id}:decision`,
    user.telegram_id,
    yes
      ? 'Регистрация одобрена. /mytask — ваше задание. /settings — включить уведомления.'
      : 'Заявка отклонена. Подтвердите свою личность администратору.',
  );
}
export const approvalButtons = (id: string) =>
  buttons([
    [
      ['Одобрить', `approve:${id}:yes`],
      ['Отклонить', `approve:${id}:no`],
    ],
  ]);
