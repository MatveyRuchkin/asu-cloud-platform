# Развёртывание ASU Team Bot на Cloudflare Free

Нужны бесплатный аккаунт Cloudflare, Telegram и GitHub. Домен, VPS и банковская карта для базового сценария не требуются. Не включайте Workers Paid, платные модели или автоматический Yandex fallback. Тариф и квоты проверьте в Dashboard до запуска.

## 1. Аккаунт и инструменты

Зарегистрируйтесь на [Cloudflare](https://dash.cloudflare.com/sign-up), подтвердите почту. В разделе **Workers & Pages** выберите Free и свой поддомен `workers.dev`. Установите [Node.js LTS](https://nodejs.org/en/download) и Git на Windows. Перезапустите PowerShell:

```powershell
git clone --branch feature/54 https://github.com/MatveyRuchkin/asu-cloud-platform.git
cd asu-cloud-platform\tools\team-bot
npm install
npx wrangler login
```

После merge используйте принятую ветку `dev` вместо `feature/54`. Если папка репозитория уже есть, используйте её, повторное клонирование не нужно. Команда login открывает официальный браузерный вход Cloudflare; разрешите доступ Wrangler. Пароли и токены не присылайте в чат.

## 2. Сначала проверить исходящий Telegram из Worker

```powershell
npm run probe:deploy
node scripts/probe.mjs https://asu-team-bot-network-probe.ВАШ-ПОДДОМЕН.workers.dev
```

Probe — маленький Worker без Telegram-токена и БД. Скрипт создаёт случайный Cloudflare Secret для закрытого диагностического адреса. Результат сохраняется в игнорируемый `evaluation-results/network-probe.json`. Ответ 200/302 от `api.telegram.org` означает доступность адреса, но **не доказывает работу `getMe` и `sendMessage`**. Эти проверки выполняются позже с токеном именно из основного Worker. При недоступности Telegram сначала решите проблему маршрута с Cloudflare; не объявляйте бота проверенным.

## 3. D1 и очереди

В этой задаче ресурсы владельца уже могут быть созданы; проверьте `npx wrangler d1 list` и `npx wrangler queues list`, не создавайте дубликаты.

Для нового аккаунта:

```powershell
npx wrangler d1 create asu-team-bot
npx wrangler queues create asu-team-bot-jobs --message-retention-period-secs 86400
npx wrangler queues create asu-team-bot-dlq --message-retention-period-secs 86400
```

Скопируйте возвращённый `database_id` в `wrangler.jsonc`, binding оставьте `DB`. ID базы не является секретом; в новом аккаунте текущий ID чужой базы работать не будет. Сохраните AI binding `AI`, producer `JOBS`, consumer и DLQ. 86400 секунд — максимум хранения Queues Free.

```powershell
npx wrangler d1 migrations apply asu-team-bot --remote
npm run check
npm test
npm run build
npm run deploy
```

Wrangler покажет HTTPS URL вида `https://asu-team-bot.ВАШ-ПОДДОМЕН.workers.dev`. Этот адрес и нужен Telegram. Cron из конфигурации запускается каждые 15 минут; применение Cron может занять до 15 минут. Внешний HTTP-порт и веб-сервер не нужны.

## 4. Токен Telegram и безопасные Secrets

В Telegram откройте официальный `@BotFather`, выполните `/newbot`, сохраните токен. Узнайте свой числовой Telegram ID. Затем:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-secrets.ps1 -WorkerUrl https://asu-team-bot.ВАШ-ПОДДОМЕН.workers.dev
```

Ввод токена скрыт. Скрипт добавляет четыре Cloudflare Secrets, проверяет `getMe` из Worker и выполняет `setWebhook` с проверочным секретом. Ожидающие обновления сохраняются (`drop_pending_updates=false`). Не запускайте polling того же токена.

Ручной способ:

```powershell
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put ADMIN_TELEGRAM_IDS
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put DIAGNOSTIC_SECRET
npx wrangler secret put GITHUB_TOKEN
```

Для секретов webhook/диагностики используйте разные случайные строки минимум 32 символа. Полный список — [ENVIRONMENT.md](ENVIRONMENT.md). Для `setWebhook` помощник `scripts/telegram.mjs` читает `WORKER_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` из окружения. Не вставляйте токен в командную строку с аргументами или в браузерную ссылку. Для новичка рекомендуется PowerShell-помощник со скрытым вводом.

GitHub PAT: только выбранный репозиторий, права Read на Contents, Issues, Pull requests, Actions, Checks и Commit statuses. Обычный публичный API без PAT имеет малую общую квоту и может остановить отчёт. Права записи боту не нужны.

Для скрытого ввода GitHub PAT: `powershell -ExecutionPolicy Bypass -File .\scripts\configure-github.ps1`. Скрипт добавляет Secret и снимает только сохранённую задержку анонимного GitHub API: у PAT свой лимит.

## 5. Первые команды и 18 участников

1. Администратор открывает бота, нажимает Start, выбирает своё имя.
2. Администратор вызывает `/pending` (bootstrap доступ определяется числовыми ID из Secret, независимо от роли), сверяет ID и одобряет себя.
3. В `/settings` включает уведомления. Теперь PowerShell-помощник сможет проверить реальный `sendMessage` из Worker.
4. Проверяет `/mytask`, `/status`, затем `/ask Какой следующий шаг?`.
5. Отправляет команде ссылку на бота. Каждый из 18 участников самостоятельно нажимает Start, выбирает себя и получает одобрение после проверки личности. Вручную копировать список команды не нужно.
6. Участники, желающие получать обращения, включают `/settings`. Проверьте один тестовый блокер, явное согласие автора и ответ получателя.

Нельзя считать интеграцию проверенной лишь по `/health`. Нужно увидеть `getMe=true`, `sendMessage=sent` в диагностике и сообщения в Telegram. Диагностика не отправляет тестовые сообщения произвольному ID: только первому подтверждённому администратору с включёнными уведомлениями.

## 6. Workers AI

Binding `AI` уже указан в конфигурации. Основная модель — [Qwen3 30B A3B](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/): многоязычная, с документированными параметрами и доступом через Workers AI. Качество русского и ответов по задачам проверяется реальными примерами, не предполагается заранее.

Для теста задайте `WORKER_URL` и `DIAGNOSTIC_SECRET` локально и выполните:

```powershell
npm run ai:eval
```

Скрипт проверяет три вопроса по Issues #17, #9 и #13, сохраняет ответы в `evaluation-results/ai-evaluation.json`. Оцените: русский язык, конкретный следующий шаг, правильные ссылки, отсутствие выдуманного статуса, отсутствие обвинений. Эти вызовы расходуют бесплатный лимит. Тесты приложения модель не вызывают.

При недоступности/квоте AI бот сообщает об этом и сохраняет работу команд без модели. Yandex не подключается автоматически. Если владелец отдельно решит оплачивать резерв, он добавляет Yandex Secrets и **явно** меняет `ENABLE_YANDEX_FALLBACK` на `true`.

## 7. Логи, обновление, откат

```powershell
npx wrangler tail --format pretty
git fetch origin
git switch feature/54
git pull --ff-only
npm install
npm run check
npm test
npm run build
npx wrangler d1 migrations apply asu-team-bot --remote
npm run deploy
npx wrangler deployments list
npx wrangler rollback
```

После merge обновляйте принятую ветку. База сохраняется отдельно от Worker. Rollback кода не откатывает схему D1: перед миграциями делайте экспорт. Не публикуйте полный вывод диагностики с личными данными; приложение пишет только короткие коды событий. Длительное хранение invocation-логов выключено в конфигурации.

## 8. Резервные копии

Из папки бота создайте игнорируемый каталог `backups`. Экспорт:

```powershell
New-Item -ItemType Directory -Force backups
npx wrangler d1 export asu-team-bot --remote --output backups\team-bot-before-update.sql
npx wrangler d1 time-travel info asu-team-bot
```

На Free Time Travel хранит до 7 дней. Для восстановления на прежнюю точку сначала остановите поступление webhook безопасным `deleteWebhook` с сохранением pending updates, запишите текущее состояние, затем:

```powershell
npx wrangler d1 time-travel restore asu-team-bot --timestamp 2026-10-24T12:00:00Z
```

Замените timestamp на нужную UTC-точку. После восстановления заново зарегистрируйте webhook. Откат может вернуть старые согласия/отключённые аккаунты: перепроверьте права. Старые уже доставленные сообщения Telegram отменить нельзя.

Для долгосрочной копии — экспорт в зашифрованное хранилище владельца. Импортируйте SQL **в новую D1 базу**, проверьте её локально/отдельным Worker и только затем переключите `database_id`: `wrangler d1 execute НОВАЯ-БАЗА --remote --file backups\КОПИЯ.sql`. Не импортируйте поверх работающей базы. Копии содержат данные участников и блокеров, никогда не добавляйте их в Git.

## 9. Бесплатные пределы

По официальной документации на дату разработки:

| Ресурс | Free | Что делает бот |
|---|---|---|
| Workers | 100000 запросов/сутки, 10 мс CPU, 50 внешних подзапросов на запуск | Тяжёлые задания вынесены в Queue; отчёт делится по участникам |
| Queues | 10000 операций/сутки; запись+чтение+удаление обычно минимум 3 операции/сообщение; хранение до 24 часов | D1 сохраняет источник; Cron восстанавливает очередь; одна consumer-обработка за раз |
| D1 | 5 млн прочитанных и 100000 записанных строк/сутки, 5 ГБ суммарно; одна Free база до 500 МБ | Индексы, короткая история, кэш, ограничения на выборки |
| Workers AI | 10000 нейронов/сутки на аккаунт | Резерв до 8000, 40 запросов всего и 4 на участника в сутки, ограниченный контекст/ответ |

В Dashboard смотрите **Workers & Pages → Metrics**, **D1 → Metrics**, **Queues → Metrics**, **Workers AI → Usage**. Квоты общие с другими приложениями аккаунта. Приложение не может обещать точное количество бесплатных ответов: размер вопроса и токенизация различаются.

При нехватке квот уменьшайте число AI-вопросов/длину ответа, запрашивайте отчёт реже, увеличьте TTL GitHub до 300 с. Без модели используйте `/status`, `/mytask`, `/blocker`. При исчерпании D1 новые webhook получают 503 до восстановления доступности; Telegram хранит обновления ограниченное время, поэтому длительная недоступность не даёт абсолютной гарантии сохранения сообщений, ещё не дошедших до D1. Не включайте платный тариф незаметно.

Источники: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Queues Free](https://developers.cloudflare.com/queues/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).
