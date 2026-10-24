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
