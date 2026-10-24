import { Blockers, states } from './blockers';
import { GitHub, statusText } from './github';
import { LanguageModel, WorkersModel } from './llm';
import { Store } from './storage';
import { Telegram } from './telegram';
import { approvalButtons, approve, register, requireAdmin } from './users';
import { Blocker, Env, Fetcher, Markup, TelegramUpdate, UserError, buttons, now } from './types';

export const HELP = `Я помогу найти задание, проверить GitHub и разобраться с зависимостями.
/start — регистрация с одобрением администратора
/help — эта инструкция
/mytask — задание, шаги и ссылка на Issue
/status — Issue, PR, проверки и ревью (без ИИ)
/ask вопрос — помощь ИИ; можно просто отправить текст
/blocker описание — проблема и выбор ответственного
/blockers — мои открытые блокеры
/team — направления и контакты внутри бота
/report — отчёт для подтверждённых руководителей
/whoami — Telegram ID, регистрация и роль
/settings — согласие на уведомления
/cancel — удалить черновик блокера

Не присылайте пароли и ключи. Для ИИ передаётся только текущий вопрос и нужные публичные
документы GitHub. История диалога не передаётся. По умолчанию уведомления выключены.
Описание блокера передаётся другим только после отдельного подтверждения.
Для удаления своих данных обратитесь к администратору. Работает только личный чат.`;

export class Handler {
  github: GitHub;
  blockers: Blockers;
  telegram: Telegram;
  model: LanguageModel;
  constructor(
    private env: Env,
    private store: Store,
    fetcher: Fetcher = (...args) => fetch(...args),
    model?: LanguageModel,
  ) {
    this.github = new GitHub(env, store, fetcher);
    this.blockers = new Blockers(env, store);
    this.telegram = new Telegram(env, store, fetcher);
    this.model = model || new WorkersModel(env, store, fetcher);
  }
  async handle(update: TelegramUpdate) {
    const uid = update.message?.from.id || update.callback_query!.from.id;
    let replyIndex = 0;
    const reply = (text: string, markup?: Markup) =>
      this.store.out(`u:${update.update_id}:r:${replyIndex++}`, uid, text, markup);
    await this.store.seen(uid);
    const user = await this.store.user(uid);
    if (user?.status === 'disabled') {
      await reply(`Telegram ID: ${uid}. Доступ отключён администратором.`);
      return;
    }
    // This marker avoids spending the per-user rate limit again on queue retries.
    const existing = await this.store.first(
      'SELECT 1 FROM requests WHERE update_id=?',
      update.update_id,
    );
    if (!existing && !(await this.store.allow(uid))) {
      await reply('Слишком много запросов. Подождите минуту.');
      return;
    }
    await this.store.run(
      'INSERT OR IGNORE INTO requests VALUES(?,?,?,?)',
      update.update_id,
      uid,
      update.callback_query
        ? 'callback'
        : update.message?.text?.startsWith('/')
          ? 'command'
          : 'question',
      now(),
    );
    if (update.callback_query) {
      await this.telegram.callback(update.callback_query.id);
      try {
        await this.callback(uid, update.callback_query.data || '', update.update_id, reply);
      } catch (error) {
        if (error instanceof UserError) await reply(error.message);
        else throw error;
      }
      return;
    }
    const text = update.message?.text?.trim() || '';
    if (!text) {
      await reply('Отправьте текст или откройте /help.');
      return;
    }
    const [raw, ...args] = text.split(/\s+/),
      command = raw.toLowerCase().split('@')[0],
      value = args.join(' ');
    try {
      if (command === '/help') {
        await reply(HELP);
        return;
      }
      if (command === '/whoami') {
        const team = user?.status === 'approved' ? await this.github.team() : null;
        await reply(
          `Telegram ID: ${uid}\nРегистрация: ${user?.status || 'нет'}${
            team && user?.slug
              ? `\n${team.member(user.slug).name}; роль: ${team.role(user.slug)}`
              : ''
          }`,
        );
        return;
      }
      if (command === '/start') {
        if (user?.status === 'approved') {
          await reply('Вы зарегистрированы. /mytask — задание, /settings — уведомления.');
          return;
        }
        const team = await this.github.team();
        await reply(
          'Выберите себя. Доступ появится после проверки личности администратором.\n' + HELP,
          buttons(team.data.members.map((m) => [[m.name, 'register:' + m.slug]])),
        );
        return;
      }
      if (command === '/pending') {
        requireAdmin(this.env, uid);
        const team = await this.github.team();
        const rows = await this.store.all<{ id: string; telegram_id: number; slug: string }>(
          "SELECT * FROM registrations WHERE status='pending' ORDER BY created DESC LIMIT 20",
        );
        if (!rows.length) await reply('Нет заявок.');
        for (const r of rows)
          await reply(
            `${team.member(r.slug).name}; Telegram ID: ${r.telegram_id}. Проверьте ID с человеком через известный вам канал связи.`,
            approvalButtons(r.id),
          );
        return;
      }
      if (['/disable', '/deleteuser', '/critical', '/retrydelivery'].includes(command)) {
        requireAdmin(this.env, uid);
        if (!/^[\w:.-]+$/.test(value)) throw new UserError(`Формат: ${command} ID`);
        if (command === '/disable') {
          await this.store.run(
            "UPDATE users SET status='disabled',notify=0 WHERE telegram_id=?",
            Number(value),
          );
          await reply('Доступ отключён. Повторная регистрация заблокирована.');
        } else if (command === '/deleteuser')
          await reply(
            `Удалить сведения Telegram ID ${value}, включая связанные блокеры? Копии базы нужно очищать отдельно.`,
            buttons([[['Удалить данные', `delete:${value}`]]]),
          );
        else if (command === '/critical') {
          await this.blockers.get(value);
          await this.store.run('UPDATE blockers SET critical=1 WHERE id=?', value);
          await reply(
            'Блокер отмечен критичным. Руководитель проекта получит его на этапе эскалации.',
          );
        } else
          await reply(
            'Повторная отправка при неопределённой доставке может создать дубликат. Сначала уточните у получателя, пришло ли сообщение.',
            buttons([[['Подтвердить повтор', `resend:${value}`]]]),
          );
        return;
      }
      if (command === '/delivery') {
        requireAdmin(this.env, uid);
        const rows = await this.store.all<{ id: string; status: string; attempts: number }>(
          "SELECT id,status,attempts FROM notifications WHERE status IN ('uncertain','rejected','retry','unavailable') ORDER BY updated DESC LIMIT 20",
        );
        await reply(
          rows.map((r) => `${r.id}: ${r.status}, попыток ${r.attempts}`).join('\n') ||
            'Ошибок доставки не найдено.',
        );
        return;
      }
      const registered = await this.store.requireUser(uid);
      if (command === '/settings') {
        await reply(
          'Уведомления ' +
            (registered.notify ? 'включены' : 'выключены') +
            '. Служебные ответы на ваши команды приходят всегда.',
          buttons([
            [
              ['Включить', 'notify:1'],
              ['Выключить', 'notify:0'],
            ],
          ]),
        );
        return;
      }
      if (command === '/cancel') {
        await this.store.run('DELETE FROM drafts WHERE telegram_id=?', uid);
        await reply('Черновик удалён.');
        return;
      }
      const team = await this.github.team(),
        member = team.member(registered.slug);
      if (/^(что с моей (работой|задачей)|мой статус)[?.!]*$/i.test(text)) {
        await reply(statusText(await this.github.snapshot(member)));
        return;
      }
      if (command === '/mytask') {
        const issue = await this.github.issue(member.issue_number);
        await reply(
          `${member.name}: ${member.task}\nЧто подготовить: ${member.deliverable}\n` +
            member.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') +
            `\nЗависимости по документам: ${member.depends}. Это не доказательство блокировки.\nПервый контакт: ${team.member(team.lead(member.slug)).name}\nIssue: ${issue.state} ${issue.html_url}\n${this.github.file('docs/tasks/' + member.code + '.md')}`,
        );
        return;
      }
      if (command === '/status') {
        await reply(statusText(await this.github.snapshot(member)));
        return;
      }
      if (command === '/team') {
        await reply(
          team.data.groups
            .map(
              (g) =>
                `${g.title}: ${team.member(g.lead_slug).name}; направить вопрос внутри бота — /blocker`,
            )
            .join('\n') + `\n${this.github.file('docs/TEAM_STRUCTURE.md')}`,
        );
        return;
      }
      if (command === '/report') {
        if (team.role(registered.slug) === 'participant')
          throw new UserError('Отчёт доступен только подтверждённым руководителям.');
        const scope = team.scope(registered.slug),
          people = await this.store.all<{ slug: string }>(
            "SELECT slug FROM users WHERE status='approved'",
          );
        const blockers = await this.store.all<Blocker>(
          `SELECT b.* FROM blockers b JOIN users u ON b.author=u.telegram_id
           WHERE b.state NOT IN ('done','cancelled') AND u.slug IN (${scope.map(() => '?').join(',')})
           ORDER BY b.created LIMIT 20`,
          ...scope,
        );
        const rows = [];
        for (const b of blockers) {
          rows.push(
            `#${b.id}, Issue #${b.issue}: ${states[b.state]}, этап ${b.stage}. ` +
              (b.consent ? b.summary : 'Описание не разрешено к передаче.') +
              (b.critical || b.stage >= 3 ? ' Требует решения руководителя.' : ''),
          );
        }
        await reply(
          `Отчёт ${new Date().toISOString()} (UTC). Зарегистрировано ${people.filter((p) => scope.includes(p.slug)).length} из ${scope.length} в вашей области.\nGitHub сводки придут отдельными сообщениями по участникам: каждый запрос укладывается в Free-план.\nОткрытые блокеры (до 20 карточек):\n${rows.join('\n') || 'Нет в показанной выборке.'}`,
        );
        for (const slug of scope)
          await this.store.job(`report:${update.update_id}:${slug}`, 'report', {
            uid,
            slug,
            request: update.update_id,
          });
        return;
      }
      if (command === '/blockers') {
        const rows = await this.store.all<Blocker & { delivery: string | null }>(
          `SELECT b.*,(SELECT group_concat(status,', ') FROM notifications n WHERE n.blocker=b.id) AS delivery
           FROM blockers b WHERE author=? AND state NOT IN ('done','cancelled') ORDER BY created LIMIT 20`,
          uid,
        );
        if (!rows.length) await reply('Открытых блокеров нет.');
        for (const b of rows) {
          await reply(
            `Блокер #${b.id}: ${states[b.state]}. Ответственный: ${team.member(b.target).name}\n${b.summary}\nДоставка: ${b.delivery || 'отправка не подтверждена'}`,
            this.blockerButtons(b.id),
          );
        }
        return;
      }
      const draft = await this.store.first<{ summary: string }>(
        'SELECT summary FROM drafts WHERE telegram_id=? AND expires>?',
        uid,
        now(),
      );
      if (command === '/blocker' || (draft?.summary === '' && !text.startsWith('/'))) {
        const summary = command === '/blocker' ? value : text;
        if (!summary) {
          await this.store.run(
            "INSERT INTO drafts VALUES(?,'',?) ON CONFLICT(telegram_id) DO UPDATE SET summary='',expires=excluded.expires",
            uid,
            now() + 1800,
          );
          await reply('Опишите проблему в 5–600 символах без секретов. /cancel — отмена.');
          return;
        }
        if (summary.length < 5 || summary.length > 600)
          throw new UserError('Опишите проблему в 5–600 символах.');
        await this.store.run(
          'INSERT INTO drafts VALUES(?,?,?) ON CONFLICT(telegram_id) DO UPDATE SET summary=excluded.summary,expires=excluded.expires',
          uid,
          summary,
          now() + 1800,
        );
        const target = team.suggest(summary, member.slug),
          candidates = [
            target,
            ...[...team.members.keys()].filter((s) => s !== target && s !== member.slug),
          ];
        await reply(
          `Выберите ответственного. Предложение по тексту требует вашего подтверждения; блокировка ещё не доказана.\n${summary}`,
          buttons(candidates.map((s) => [[team.member(s).name, 'target:' + s]])),
        );
        return;
      }
      if (text.startsWith('/') && command !== '/ask')
        throw new UserError('Неизвестная команда. /help');
      const question = command === '/ask' ? value : text;
      if (!question) throw new UserError('Напишите /ask и вопрос либо просто отправьте текст.');
      const snapshot = await this.github.snapshot(member);
      const docs: Record<string, string> = {};
      for (const path of [
        `docs/tasks/${member.code}.md`,
        'docs/TEAM_STRUCTURE.md',
        'docs/architecture.md',
      ])
        docs[this.github.file(path)] = (await this.github.document(path)).slice(0, 1200);
      const target = team.suggest(question, member.slug),
        dependency = team.member(target);
      const depIssue = await this.github.issue(dependency.issue_number);
      let answer: string;
      try {
        answer = await this.model.answer(uid, question, {
          author: { name: member.name, role: team.role(member.slug) },
          task: member.task,
          documented_dependencies: member.depends,
          github: snapshot,
          dependency: { name: dependency.name, issue: depIssue },
          lead: team.member(team.lead(member.slug)).name,
          docs,
        });
      } catch (error) {
        if (error instanceof UserError) answer = error.message;
        else throw error;
      }
      await reply(
        answer +
          '\n\nИсточники:\n' +
          snapshot.issue.html_url +
          '\n' +
          depIssue.html_url +
          '\n' +
          Object.keys(docs).join('\n'),
      );
      if (/жду|не могу|блокер|зависим/i.test(question)) {
        const b = await this.blockers.create(
          uid,
          target,
          question.slice(0, 600),
          team,
          `b${update.update_id.toString(36)}`,
        );
        await reply(
          `Создана карточка #${b.id}. Предполагаемый ответственный: ${dependency.name}.\n${b.summary}\nЕсли ответственный выбран неверно, закройте карточку и выберите человека через /blocker.\nОтправка и эскалация только с вашего согласия.`,
          this.blockerButtons(b.id),
        );
      }
    } catch (error) {
      if (error instanceof UserError) await reply(error.message);
      else throw error;
    }
  }
  blockerButtons(id: string) {
    return buttons([
      [['Разрешить отправку и эскалацию', `share:${id}`]],
      [['Закрыть блокер', `close:${id}`]],
    ]);
  }
  private async callback(
    uid: number,
    data: string,
    update: number,
    reply: (s: string, m?: Markup) => Promise<void>,
  ) {
    const [action, id, choice] = data.split(':');
    if (action === 'approve') {
      requireAdmin(this.env, uid);
      if (!['yes', 'no'].includes(choice)) throw new UserError('Некорректное решение.');
      await approve(this.store, await this.github.team(), this.env, uid, id, choice === 'yes');
      await reply('Решение сохранено.');
      return;
    }
    if (action === 'delete' || action === 'resend') {
      requireAdmin(this.env, uid);
      if (action === 'delete') {
        await this.store.removeUser(Number(id));
        if (Number(id) !== uid)
          await reply('Сведения удалены. Резервные копии очищаются отдельно.');
      } else {
        const notice = data.slice('resend:'.length);
        await this.store.run(
          "UPDATE notifications SET status='pending',lease=0,available=? WHERE id=? AND status IN ('uncertain','rejected','unavailable')",
          now(),
          notice,
        );
        await reply('Повтор поставлен в очередь. Доставка пока не подтверждена.');
      }
      return;
    }
    const team = await this.github.team();
    if (action === 'register') {
      const rid = `r${update.toString(36)}`;
      await register(this.store, team, uid, id, rid);
      await reply(
        `Заявка сохранена. Telegram ID: ${uid}. Администратор должен проверить вашу личность. Пока доступ закрыт. Если он не получил уведомление, попросите открыть /pending.`,
      );
      for (const raw of (this.env.ADMIN_TELEGRAM_IDS || '').split(',')) {
        const admin = Number(raw.trim());
        if (!admin) continue;
        const user = await this.store.user(admin);
        if (user?.status === 'approved' && user.notify)
          await this.store.out(
            `registration:${rid}:${admin}`,
            admin,
            `Заявка: ${team.member(id).name}, Telegram ID ${uid}. Сверьте личность вне бота.`,
            approvalButtons(rid),
            undefined,
            'notification',
          );
      }
      return;
    }
    const user = await this.store.requireUser(uid);
    team.member(user.slug);
    if (action === 'notify' && ['0', '1'].includes(id)) {
      await this.store.run(
        'UPDATE users SET notify=?,updated=? WHERE telegram_id=?',
        Number(id),
        now(),
        uid,
      );
      await reply('Настройка уведомлений сохранена.');
      return;
    }
    if (action === 'target') {
      const draft = await this.store.first<{ summary: string }>(
        'SELECT summary FROM drafts WHERE telegram_id=? AND expires>?',
        uid,
        now(),
      );
      if (!draft?.summary) throw new UserError('Черновик устарел. Повторите /blocker.');
      const b = await this.blockers.create(uid, id, draft.summary, team, `b${update.toString(36)}`);
      await reply(
        `Карточка #${b.id}: ${team.member(b.target).name}\n${b.summary}\nПодтверждая отправку, вы разрешаете передать это описание и номер задачи ответственному и его лидам при задержке. История чата не пересылается.`,
        this.blockerButtons(b.id),
      );
      return;
    }
    if (action === 'share') {
      const queued = await this.blockers.share(id, uid);
      await reply(
        queued
          ? 'Обращение сохранено в очереди. Доставка ещё не подтверждена; её состояние видно в /blockers.'
          : 'Уведомление не отправлено: адресат не зарегистрирован или не включил уведомления. Попросите его открыть /start и /settings.',
      );
      return;
    }
    if (action === 'close') {
      await this.blockers.close(id, uid);
      await reply('Блокер закрыт.');
      return;
    }
    if (action === 'reply') {
      await this.blockers.respond(id, uid, choice, `blocker:${id}:reply:${update}`);
      await reply('Ответ сохранён. Автор увидит изменение в /blockers.');
      return;
    }
    throw new UserError('Кнопка устарела. Повторите команду.');
  }
}
