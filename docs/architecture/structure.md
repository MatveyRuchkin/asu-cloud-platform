# Структура проекта и локальный запуск

**Issue:** #5 (ARCH-01). Связано: [решения](decisions.md) · [контракт API](../api/openapi.yaml) · [правила репозитория](../../AGENTS.md).

## 1. Репозиторий

Один монорепозиторий: frontend, backend, документация и демо-данные лежат рядом, но в разных каталогах. Новый проект внутри репозитория не создаём.

```
asu-team-cloud-platform/
├── backend/            # FastAPI-приложение (Python)          — см. backend/README.md
├── frontend/           # Vue-приложение (TypeScript)           — см. frontend/README.md
├── data/
│   └── demo/           # демо-данные и тестовые наборы JSON
├── docs/
│   ├── architecture/   # решения, структура, локальный запуск  (ARCH-01, техлид)
│   ├── api/            # контракт OpenAPI и правила его изменения (API-01)
│   ├── database/       # ER-схема, SQL-проверки                 (DB-01, DB-02, DB-03)
│   ├── tasks/          # персональные задания команды
│   ├── requirements.md # продукт и этапы
│   └── architecture.md # черновик, на который опирались решения
├── site/               # сайт команды (GitHub Pages)
└── .github/            # шаблоны Issue/PR и автоматические проверки
```

## 2. Backend

```
backend/
├── app/
│   ├── main.py             # создание FastAPI, CORS, подключение роутера
│   ├── core/               # конфигурация, общие ошибки, общие зависимости
│   │   ├── config.py
│   │   └── errors.py
│   ├── api/
│   │   └── v1/             # сборка маршрутов /api/v1
│   │       ├── router.py
│   │       └── health.py
│   ├── db/                 # подключение, сессии, модели   (BE-01 + DB-01)
│   └── modules/            # доменные модули
│       ├── auth/           # регистрация, вход, токены    (BE-01)
│       ├── users/          # профиль                      (BE-01)
│       ├── universities/   # справочник вузов             (BE-01)
│       ├── ads/            # объявления                   (назначает BE-01)
│       └── forum/          # разделы, темы, ответы        (BE-02)
├── tests/                  # pytest-тесты (test_*.py)
├── migrations/             # миграции Alembic             (DB-01)
├── pyproject.toml          # зависимости, Ruff, pytest
└── .env.example            # пример переменных окружения без секретов
```

**Владение каталогами:** см. [ADR-008](decisions.md#adr-008-границы-модулей). Правило простое: работаешь в своём модуле — не правь чужой; нужен общий файл — согласуй с лидом направления.

**Структура одного модуля** (шаблон для новых):

```
app/modules/<имя>/
├── __init__.py
├── router.py      # HTTP-маршруты модуля
├── schemas.py     # Pydantic-модели запросов и ответов
├── service.py     # логика модуля
└── repository.py  # работа с базой
```

Модуль не выходит за пределы своей папки наружу: наружу торчат только `router.py` (маршруты) и Pydantic-схемы.

## 3. Frontend

```
frontend/
├── src/
│   ├── main.ts             # точка входа, подключение роутера и Pinia
│   ├── App.vue             # оболочка приложения
│   ├── router/             # маршруты                    (FE-01)
│   ├── views/              # страницы                    (FE-02…FE-04)
│   ├── components/         # переиспользуемые элементы    (FE-01)
│   ├── api/                # вызов API и типы             (FE-01 + API-01)
│   │   ├── http.ts         # единственная точка запросов
│   │   └── types.ts        # типы запросов и ответов
│   ├── stores/             # состояние Pinia             (FE-01)
│   └── styles/             # общие стили, адаптивность    (FE-01 + UI-01)
├── eslint.config.js
├── .prettierrc.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .env.example
```

**Правила для страниц и компонентов:**
- Новая страница — папка или файл в `src/views/`, маршрут добавляется в `src/router/index.ts` (владелец — FE-01; если маршрут нужен срочно, добавляем свой маршрут сразу и сообщаем лиду).
- Данные страницы не подгружаются напрямую через `fetch` в компоненте: только через `src/api/http.ts`.
- Название файла компонента — `PascalCase.vue`, папки и файлы логики — `kebab-case` или `camelCase` для `*.ts`.

## 4. Локальный запуск

Нужно: Python 3.11+ (цель — 3.12), Node.js 22 LTS, при желании Docker Desktop (для PostgreSQL).

### 4.1. Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -e ".[dev]"
pytest -q
uvicorn app.main:app --reload --port 8000
```

Проверка в другом терминале:

```bash
curl http://127.0.0.1:8000/api/v1/health
# {"status":"ok"}
```

Дополнительно: Swagger UI — <http://127.0.0.1:8000/docs>, автосгенерированный OpenAPI — <http://127.0.0.1:8000/openapi.json> (вспомогательный просмотр; источник истины — `docs/api/openapi.yaml`).

### 4.2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Приложение: <http://localhost:5173>. Адрес API берётся из `.env`:

```dotenv
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

Файл `.env` в `frontend/` создаётся локально из `.env.example` и в Git не попадает.

### 4.3. База данных и сервисы в Docker

Появятся вместе с DOCKER-01 (Аксютин): `docker compose up -d` поднимает PostgreSQL и backend. До этого база поднимается отдельно по инструкции BE-01.

### 4.4. Проверки перед Pull Request

| Что | Команда | Где |
| --- | --- | --- |
| Тесты backend | `pytest -q` | `backend/` |
| Линт и формат backend | `ruff check .` и `ruff format --check .` | `backend/` |
| Сборка frontend | `npm run build` | `frontend/` |
| Линт frontend | `npm run lint` | `frontend/` |
| Формат frontend | `npm run format:check` | `frontend/` |

Результат этих команд вставляется в описание Pull Request.

## 5. Как добавить модуль или файл

1. Найди в [ADR-008](decisions.md#adr-008-границы-модулей) владельца нужного каталога.
2. Если каталог твой — добавляй файлы, не меняя чужие.
3. Если нужен новый каталог, новая зависимость, новый эндпоинт или новое поле — это Issue и согласование по [ADR-012](decisions.md#adr-012-что-требует-согласования).
4. Новый эндпоинт появляется в коде **после** того, как он появился в `docs/api/openapi.yaml`.

## 6. Частые проблемы

| Симптом | Причина | Что делать |
| --- | --- | --- |
| `ModuleNotFoundError: app` | не активировано виртуальное окружение | активируй `.venv` и запусти из каталога `backend/` |
| `connection refused` на `/api/v1/health` | backend не запущен | запусти `uvicorn app.main:app --reload` |
| CORS-ошибка в браузере | frontend и backend на разных портах | проверь `VITE_API_BASE_URL` и список разрешённых origins |
| `npm run dev` не открывает страницу | занят порт 5173 | `npm run dev -- --port 5174` |
| Ошибка при `pip install` | нет доступа в сеть или несовместимая версия Python | проверь версию `python --version` (нужна 3.11+) |
