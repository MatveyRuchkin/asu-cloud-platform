# Проверки миграций и ограничений PostgreSQL

Статус: DB-03. Проверки предназначены для начальной миграции DB-01.

## Что проверяется

`tests/database/check_initial_migration.sql` проверяет:

1. Применение начальной миграции и наличие ключевых таблиц.
2. Внешний ключ `users.university_id`.
3. Обязательность `universities.name`.
4. Уникальность `universities.name`.

Скрипт запускается внутри транзакции и завершается `ROLLBACK`, поэтому тестовые
записи не сохраняются в базе.

## Предварительные условия

- PR DB-01 / Issue #18 влит либо его миграция доступна в рабочей ветке.
- Есть чистая тестовая PostgreSQL.
- Установлены Alembic и `psql`.
- В переменной `DATABASE_URL` указана строка подключения к тестовой базе.

Пример строки подключения:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://app:app@localhost:5432/app"

Порядок запуска
Из корня репозитория:
backend\.venv\Scripts\alembic.exe -c backend\alembic.ini upgrade head
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f tests/database/check_initial_migration.sql
Ожидаемый результат
После применения миграции создаются таблицы:
- alembic_version;
- universities;
- users;
- ad_categories;
- ads;
- forum_sections;
- forum_topics;
- forum_replies.

Во время запуска проверки должны появиться сообщения:
OK: внешний ключ users.university_id работает
OK: universities.name является обязательным
OK: уникальность universities.name работает
Команда psql должна завершиться без ошибки. Скрипт выполняет ROLLBACK, поэтому
после него проверочных университетов и пользователей в базе не остаётся.

PostgreSQL: миграция применена к чистой БД; внешний ключ, NOT NULL и UNIQUE проверены успешно.