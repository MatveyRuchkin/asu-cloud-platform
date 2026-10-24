# Windows: разработка и безопасная настройка

Приложение запускается в Cloudflare. Компьютер нужен только для установки, публикации и тестов; держать его включённым после публикации не требуется.

1. Установите [Node.js LTS](https://nodejs.org/en/download) (поддерживается Node 22/24+) и [Git for Windows](https://git-scm.com/download/win). Перезапустите PowerShell. Проверьте `node --version` и `npm --version`.
2. Откройте существующий репозиторий:

```powershell
cd D:\ASU_TG_BOT\tools\team-bot
npm install
npm run check
npm test
npm run build
```

Для воспроизводимого окружения вместо `npm install`: `corepack pnpm install --frozen-lockfile`. При работе pnpm разрешены скрипты только `workerd` и `esbuild` в `pnpm-workspace.yaml`. Workerd — локальная среда Cloudflare для тестов, не серверный Python-процесс.

3. Для локальной D1:

```powershell
npx wrangler d1 migrations apply asu-team-bot --local
Copy-Item .dev.vars.example .dev.vars
npm run dev
```

Настоящие значения добавляйте только в `.dev.vars`, который исключён из Git. Локальный HTTP-адрес не подходит Telegram webhook: для реального чата опубликуйте Worker. Локальный запуск может использовать удалённый Workers AI и расходовать квоту; автоматические тесты подменяют AI и сеть и не используют аккаунт.

4. Для сервера следуйте [DEPLOY_CLOUDFLARE.md](DEPLOY_CLOUDFLARE.md). После публикации безопасный помощник настройки:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\configure-secrets.ps1 -WorkerUrl https://ИМЯ.ПОДДОМЕН.workers.dev
```

Скрипт спрашивает Telegram-токен скрытым вводом, отправляет его в Cloudflare Secrets, создаёт отдельные случайные секреты webhook и диагностики, проверяет `getMe` именно из Worker, регистрирует webhook и предлагает проверить отправку после регистрации администратора. Он не сохраняет токен в файл и не выводит его в консоль. Скрипт использует установленный Node; в среде этой задачи также умеет находить встроенный Node приложения Codex.

Telegram ID — числовое значение, не `@username`. Его можно получить командой `/whoami` после базовой ручной настройки либо из сообщения бота идентификации, которому вы доверяете. Администраторов задаёт владелец конфигурации; заявка на имя руководителя сама по себе не даёт административных полномочий.

Если PowerShell сообщает об ошибке сети, не публикуйте полный текст ошибки с URL: в Telegram API URL может присутствовать токен. Встроенный помощник выводит только безопасное описание.
