# Frontend

Каркас Vue-приложения студенческой облачной платформы.

**Каркас создан по Issue #5 (ARCH-01).** Навигация и правила для страниц — Issue #8 (FE-01):
[docs/frontend-shell.md](../docs/frontend-shell.md). Решения по стеку и границам модулей —
[docs/architecture/decisions.md](../docs/architecture/decisions.md), структура и запуск —
[docs/architecture/structure.md](../docs/architecture/structure.md).

**Источник истины по форматам запросов и ответов — [docs/api/openapi.yaml](../docs/api/openapi.yaml).**
Типы в `src/api/types.ts` повторяют схемы контракта один в один.

## Требования

- Node.js 20.19+ или 22.12+ (в проекте используется Node 22 LTS)
- npm 10+

## Запуск сайта в Docker

Из корня репозитория, с заполненным корневым `.env`:

```bash
docker compose -f compose.yaml -f compose.api.yaml up -d --build --wait
```

Откройте `http://IP_ВИРТУАЛКИ:8080/`. `WEB_PORT` и `WEB_BIND_IP` задаются
в корневом `.env`, по умолчанию `8080` и `0.0.0.0`. Отдельный `frontend/.env`
для Docker не нужен: сборка использует `/api/v1`, Nginx передаёт запросы API
в контейнер `api:8000`. Поддерживаются прямые ссылки и перезагрузка Vue-маршрутов.
Страницы обращаются к настоящему API: объявления и категории загружаются из БД,
создание объявления требует входа и сохраняет запись на сервере. Профиль
загружается через `/users/me`, форум читает разделы и темы из БД. При отказе API
показана ошибка и кнопка повторной загрузки, подмены данными из примеров нет.

JWT хранится в `sessionStorage` текущей вкладки, передаётся в Authorization Bearer
и удаляется при выходе/ответе 401. После входа открывается настоящий профиль.
Публикация тем и ответов форума пока не реализована.

На пустой БД заполните справочники один раз (повторный запуск безопасен):

```bash
docker compose --env-file .env --env-file deploy.env -f compose.yaml -f compose.api.yaml exec api python -m app.seed_reference_data
```

Команда добавляет справочный учебный вуз, категории и разделы; пользователей,
объявления и темы не создаёт. После этого зарегистрируйтесь через сайт.

Подробности и запуск на двух ВМ — [DOCKER_SETUP.md](../docs/DOCKER_SETUP.md).

## Быстрый старт

```bash
cd frontend
npm install
npm run dev
```

Приложение откроется на <http://localhost:5173>.

Адрес API задаётся в `.env` (файл создаётся из примера и в Git не попадает):

```bash
copy .env.example .env   # Windows
cp .env.example .env     # macOS / Linux
```

```dotenv
VITE_API_BASE_URL=/api/v1
```

## Проверки перед Pull Request

```bash
npm run type-check   # проверка типов TypeScript и Vue
npm run lint         # ESLint
npm run format:check # Prettier
npm run build        # сборка для production
```

Результат этих команд вставляется в описание Pull Request.

## Структура

```
frontend/
├── src/
│   ├── main.ts          # точка входа: Vue, Pinia, роутер
│   ├── App.vue          # оболочка приложения (FE-01)
│   ├── router/          # маршруты                      (FE-01)
│   ├── views/           # страницы                      (FE-02…FE-04)
│   ├── components/      # переиспользуемые элементы, навигация (FE-01)
│   ├── api/             # вызов API и типы               (FE-01 + API-01)
│   ├── stores/          # состояние Pinia                (FE-01)
│   └── styles/          # общие стили, адаптивность       (FE-01 + UI-01)
├── eslint.config.js
├── .prettierrc.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.example
```

## Правила

- Навигация одна: `src/components/AppNavigation.vue`. Раздел добавляется ссылкой в её `links` и маршрутом в `src/router/index.ts`; правила для страниц — [docs/frontend-shell.md](../docs/frontend-shell.md).
- Компоненты не вызывают `fetch` напрямую: только через `src/api/http.ts`.
- Имена полей в TypeScript повторяют контракт: `snake_case`, UUID строками, даты — ISO 8601 UTC.
- Ошибки API приходят как `{code, message, details}`; пользователю показывают `message`.
- Тип `any` не используется без явной причины (комментарий в коде обязателен).
- Название файла компонента — `PascalCase.vue`, папки — `kebab-case`.

## Кто что делает дальше

| Что                                             | Кто             | Issue        |
| ----------------------------------------------- | --------------- | ------------ |
| Каркас приложения, навигация, страницы-заглушки | Хапков Алексей  | FE-01 (#8)   |
| Страница входа и регистрации                    | Юмина Адиля     | FE-02 (#9)   |
| Форма создания объявления                       | Дилеев Дмитрий  | FE-03 (#10)  |
| Список разделов форума                          | Шадунцев Сергей | FE-04 (#11)  |
| Макеты основных экранов                         | Никитин Михаил  | UI-01 (#12)  |
| Контракт API                                    | Косачев Михаил  | API-01 (#13) |
