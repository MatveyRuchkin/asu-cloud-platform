# Настройки

Все настоящие секреты вводятся через `wrangler secret put ИМЯ`. Для локального запуска допустим только игнорируемый `.dev.vars`; образец `.dev.vars.example` пустой. Не публикуйте файлы `.dev.vars*`, `.env*`, экспорт D1, логи или токены в Issue/PR.

| Secret | Назначение |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Токен отдельного бота от BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Случайная строка 32+ символов; тот же секрет у `setWebhook` |
| `ADMIN_TELEGRAM_IDS` | Числовые Telegram user_id администраторов через запятую; не username |
| `DIAGNOSTIC_SECRET` | Отдельный случайный ключ доступа к диагностике; не webhook secret |
| `GITHUB_TOKEN` | Рекомендуется read-only fine-grained PAT только для этого репозитория: Contents, Issues, Pull requests, Checks, Actions, Commit statuses — Read |
| `YANDEX_API_KEY` | Только для явно включённого резервного провайдера |
| `YANDEX_FOLDER_ID` | Каталог Yandex AI Studio |
| `YANDEX_MODEL` | Актуальный model URI/имя, проверенный владельцем по документации |

Несекретные значения в `wrangler.jsonc`:

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `GITHUB_REPOSITORY` | `MatveyRuchkin/asu-cloud-platform` | Репозиторий |
| `GITHUB_REF` | `dev` | Ветка документации/команды |
| `GITHUB_CACHE_TTL` | 90 | Кэш GitHub, максимум 300 секунд |
| `AI_MODEL` | `@cf/qwen/qwen3-30b-a3b-fp8` | Многоязычная модель; смена требует пересчёта резервирования нейронов в коде |
| `AI_CONTEXT_CHARS` | 6500 | Ограничение контекста, максимум 8000 символов |
| `AI_MAX_TOKENS` | 500 | Максимум 600 токенов ответа |
| `AI_DAILY_GLOBAL_REQUESTS` | 40 | Суточный лимит всех ИИ-запросов бота |
| `AI_DAILY_USER_REQUESTS` | 4 | Суточный лимит на человека |
| `AI_DAILY_NEURON_BUDGET` | 8000 | Консервативный бюджет нейронов, верхняя граница 8000 |
| `AI_DAILY_TOKEN_BUDGET` | 240000 | Бюджет суммы входа/выхода, резервируется до вызова |
| `ENABLE_YANDEX_FALLBACK` | `false` | Только `true` явно разрешает платный резерв; одних ключей недостаточно |
| `REMINDER_HOURS` | 24 | Одно напоминание ответственному |
| `ESCALATION_HOURS` | 48 | Интервал следующих эскалаций |
| `STALE_DAYS` | 7 | Порог отсутствия обновлений Issue/связанных PR для отчёта |

Дни лимитов считаются по UTC. Ошибочные и неопределённые вызовы ИИ не возвращают резерв бюджета. Счётчик консервативен и может остановить ИИ раньше квоты Cloudflare. Квота аккаунта общая с другими приложениями: проверяйте Cloudflare Dashboard. Чужой расход боту неизвестен.

Официальные источники: [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [Qwen3 API](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/), [Yandex HTTP completion](https://aistudio.yandex.ru/ru/docs/ai-studio/text-generation/api-ref/TextGeneration/completion).
