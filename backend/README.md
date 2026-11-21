# Backend

API студенческой облачной платформы на FastAPI.

**Каркас создан по Issue #5 (ARCH-01).** Решения по стеку и границам модулей —
[docs/architecture/decisions.md](../docs/architecture/decisions.md), структура и запуск —
[docs/architecture/structure.md](../docs/architecture/structure.md).

**Источник истины по форматам запросов и ответов — [docs/api/openapi.yaml](../docs/api/openapi.yaml).**
Код не расширяет контракт: сначала меняется контракт (через Issue и согласование), потом реализация.

## Требования

- Python 3.11+ (целевая версия проекта — 3.12, как в CI)
- PostgreSQL 16 (подключение появится вместе с DB-01 / DOCKER-01; сейчас не требуется)

## Быстрый старт

```bash
cd backend
python -m venv .venv
```

Активация окружения:

```bash
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
```

Установка зависимостей и запуск:

```bash
pip install -e ".[dev]"
pytest -q
uvicorn app.main:app --reload --port 8000
```

Проверка в другом терминале:

```bash
curl http://127.0.0.1:8000/api/v1/health
# {"status":"ok"}
```

- Swagger UI: <http://127.0.0.1:8000/docs>
- OpenAPI приложения (вспомогательно): <http://127.0.0.1:8000/openapi.json>

## Маршруты

Реализовано (BE-01, Issue #6; форматы — по `docs/api/openapi.yaml`):

| Маршрут | Что делает | Доступ |
| --- | --- | --- |
| `POST /api/v1/auth/register` | Регистрация: 201 с профилем, 400 — неверные поля, неизвестный вуз, занятый email | публичный |
| `POST /api/v1/auth/login` | Вход: 200 с `access_token` (JWT, bearer), 401 — неверные данные | публичный |
| `GET /api/v1/users/me` | Свой профиль по заголовку `Authorization: Bearer <token>`, 401 без токена | Bearer JWT |
| `GET /api/v1/universities` | Список вузов | публичный |

Ошибки валидации в модуле auth отдаются как `400` (в контракте у регистрации
описан только 400) — перехват живёт в `app/modules/auth/router.py` и не меняет
общий код приложения.

## Запуск с PostgreSQL (до слияния DOCKER-01 и DB-01)

`pytest -q` работает **без** базы: тесты создают SQLite в памяти из тех же
моделей. Для запуска сервера с настоящей PostgreSQL нужна схема БД — она пока
на ревью, поэтому поднимается из веток PR коллег (в вашу ветку ничего
из их файлов не копируется):

```bash
# 1. Скачать ветки PR: compose (DOCKER-01, PR #53), миграция (DB-01, PR #61),
#    демо-данные (DB-02, PR #62) — из корня репозитория:
git fetch upstream pull/53/head:pr-53-docker pull/61/head:pr-61-db pull/62/head:pr-62-seed

# 2. Поднять PostgreSQL 18 через compose из ветки PR #53:
git worktree add ../pr-53-docker pr-53-docker
cd ../pr-53-docker
cp .env.example .env        # задайте POSTGRES_PASSWORD
docker compose up -d --wait

# 3. Применить миграцию из ветки PR #61 (DATABASE_URL — ваши пользователь,
#    пароль и порт из .env compose; на Windows используйте 127.0.0.1, не localhost):
cd ../backend
DATABASE_URL="postgresql+psycopg://asu_cloud:ПАРОЛЬ@127.0.0.1:5432/asu_cloud" \
  .venv/bin/alembic -c ../pr-61-db/backend/alembic.ini upgrade head

# 4. (Необязательно) демо-данные из ветки PR #62 — вузы для формы регистрации:
git show pr-62-seed:data/demo/db_seed.sql | docker exec -i ИМЯ_КОНТЕЙНЕРА \
  psql -U asu_cloud -d asu_cloud

# 5. Прописать подключение в backend/.env (файл в Git не попадает):
#    DATABASE_URL=postgresql+psycopg://asu_cloud:ПАРОЛЬ@127.0.0.1:5432/asu_cloud
#    и запустить сервер:
uvicorn app.main:app --reload --port 8000
```

После слияния PR #53 и #61 в `dev` шаги 1–3 заменяются на `docker compose up`
и обычный `alembic upgrade head` из корня репозитория.

## Настройки

Значения настроек читаются из переменных окружения и файла `.env`.
В репозитории лежит только пример `.env.example` — создайте из него свой `.env`:

```bash
copy .env.example .env   # Windows
cp .env.example .env     # macOS / Linux
```

Реальные пароли, токены и ключи в Git не попадают.

## Структура

```
backend/
├── app/
│   ├── main.py             # создание FastAPI, CORS, подключение роутера
│   ├── core/               # конфигурация и единый формат ошибок
│   ├── api/v1/             # маршруты /api/v1
│   ├── db/                 # подключение, сессии, модели  (BE-01 + DB-01)
│   └── modules/            # доменные модули: auth, users, universities, ads, forum
├── migrations/             # миграции Alembic             (DB-01)
├── tests/                  # pytest-тесты
└── pyproject.toml
```

## Проверки перед Pull Request

```bash
ruff check .
ruff format --check .
pytest -q
```

Результат этих команд вставляется в описание Pull Request.

## Кто что делает дальше

| Что | Кто | Issue |
| --- | --- | --- |
| Регистрация, вход, токены, модуль `auth` | Лаврецкий Константин | BE-01 (#6) |
| Разделы, темы и ответы форума | Минко Арина | BE-02 (#7) |
| Подключение к базе и модели | Лаврецкий Константин + Коптелов Владислав | BE-01 (#6), DB-01 (#18) |
| Схема БД и миграции Alembic | Коптелов Владислав | DB-01 (#18) |
| Docker Compose, Dockerfile, `.env.example` в корне | Аксютин Антон | DOCKER-01 (#17) |
| Контракт API | Косачев Михаил | API-01 (#13) |

## Правила

- Пароли хранятся только в виде хэша с солью, открытые пароли в код и в Git не попадают.
- Ошибки API — в формате `{"code": "...", "message": "...", "details": {...}}`.
- Новый эндпоинт сначала появляется в `docs/api/openapi.yaml`, потом в коде.
- Модуль не правит чужую папку: общий файл меняется только с согласования лида.
