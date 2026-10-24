# Локальный PostgreSQL — DOCKER-01

## Состав и блокер

Compose запускает только PostgreSQL 18 (`postgres:18`). Каркас backend Сергеенко
ещё не добавлен в upstream `dev`: нет исходников, зависимостей и команды запуска.
Поэтому сервис backend и `backend/Dockerfile` не создаются. После появления каркаса
нужно согласовать подключение с Константином Лаврецким и Михаилом Сергеенко,
параметры БД — также с Владиславом Коптеловым, затем добавить Dockerfile,
зависимость от здоровой БД и проверить запуск обоих сервисов. API и миграции
в этой задаче не изменяются. Версия PostgreSQL 18 выбрана по запросу исполнителя;
её совместимость с backend ещё предстоит подтвердить на ревью.

## Подготовка

Нужны Docker Engine с Linux-контейнерами и Docker Compose v2 с поддержкой `--wait`
(например, Docker Desktop). Выполняйте команды из корня репозитория.

```console
docker version
docker compose version
```

Скопируйте `.env.example` в `.env`: `cp .env.example .env` в Linux/macOS
или `Copy-Item .env.example .env` в PowerShell. Задайте в `.env` непустой
уникальный `POSTGRES_PASSWORD`; рекомендуется случайная строка из букв и цифр.
Шаблон намеренно содержит пустой пароль, поэтому без настройки Compose завершится
ошибкой. `.env` уже исключён из Git. Не публикуйте вывод конфигурации с паролем.

| Переменная | Назначение | По умолчанию |
| --- | --- | --- |
| `POSTGRES_DB` | Имя локальной БД | `asu_cloud` |
| `POSTGRES_USER` | Пользователь инициализации | `asu_cloud` |
| `POSTGRES_PASSWORD` | Пароль локальной БД | Обязателен, без значения |
| `POSTGRES_PORT` | Порт на компьютере | `5432` |

Порт доступен только на `127.0.0.1`. Если 5432 занят, задайте, например,
`POSTGRES_PORT=5433`. Для подключения с компьютера используйте `127.0.0.1`,
выбранный порт и значения из `.env`. Будущий backend внутри Compose должен
подключаться к `db:5432`; формат его настроек определит существующий каркас.
Пользователь `POSTGRES_USER` имеет права суперпользователя: это локальное окружение,
для production понадобится отдельная настройка прав и секретов.

## Запуск и проверка

```console
docker compose config --quiet
docker compose up -d --wait --wait-timeout 120
docker compose ps
docker compose exec db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version();"'
```

Ожидается сервис `db` в состоянии `healthy` и версия PostgreSQL 18.
Healthcheck проверяет готовность через `pg_isready`, а не правильность пароля.
Для отдельной проверки TCP-аутентификации выполните команду ниже и введите
свой пароль по запросу (он не попадёт в историю команд):

```console
docker compose exec db sh -c 'psql -h 127.0.0.1 -W -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;"'
```

## Проверка сохранности данных

Следующие команды подходят для Bash и PowerShell 7. Они создают служебную
таблицу только для ручной проверки локального окружения, затем удаляют её.
Выполняйте их последовательно, проверяя код завершения каждой команды.

```console
docker compose exec db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE TABLE docker01_persistence_probe (id integer PRIMARY KEY); INSERT INTO docker01_persistence_probe VALUES (17);"'
docker compose down
docker compose up -d --wait --wait-timeout 120
docker compose exec db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT id FROM docker01_persistence_probe;"'
docker compose exec db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "DROP TABLE docker01_persistence_probe;"'
```

После пересоздания контейнера запрос должен вернуть `17`. `docker compose down`
сохраняет именованный volume `postgres_data`. В PostgreSQL 18 volume монтируется
в `/var/lib/postgresql`, а данные по умолчанию лежат в `18/docker` внутри него:
[документация официального образа](https://github.com/docker-library/docs/blob/master/postgres/README.md#pgdata).
Не используйте для этой версии старую точку монтирования `/var/lib/postgresql/data`.

## Остановка и диагностика

```console
docker compose logs --tail=100 db
docker compose down
```

`docker compose down --volumes` **удалит локальные данные БД**. Используйте только
для намеренного сброса ненужного окружения. Переменные инициализации применяются
лишь к пустому volume: изменение пароля, пользователя или имени БД в `.env`
не меняет существующую БД. Для сохранения данных меняйте настройки средствами SQL;
для полного сброса сначала сделайте резервную копию. Не меняйте major-версию образа
на существующем volume без процедуры обновления PostgreSQL.

`.dockerignore` подготовлен для будущего контекста сборки из корня; текущий сервис
использует готовый образ и ничего не собирает. Фактически выполненные проверки
и ограничения окружения перечисляются в PR; команды выше — инструкция повторения,
а не утверждение об успешном запуске.
