# PostgreSQL и API в Docker

Два Compose-файла: `compose.yaml` запускает PostgreSQL 18, а
`compose.api.yaml` добавляет существующий FastAPI backend. Второй файл используют
вместе с первым. Docker автоматически объединяет сервисы в сеть одного проекта;
API подключается к `db:5432`, независимо от порта БД на компьютере.
Проброшенные порты доступны только с этого компьютера:

| Сервис | Адрес на компьютере | Адрес внутри Docker |
| --- | --- | --- |
| PostgreSQL | `127.0.0.1:5432` | `db:5432` |
| API | `http://127.0.0.1:8000` | `api:8000` |

Нужен Docker Engine с Linux-контейнерами и Docker Compose v2 или новее
с поддержкой `--wait`, например Docker Desktop. Все команды ниже — PowerShell,
из корня репозитория.

## Настройка один раз

```powershell
cd D:\ASU_TG_BOT
docker version
docker compose version
```

Docker должен показать версию и Client, и Server. Если Server недоступен,
откройте Docker Desktop и дождитесь готовности Engine.

Если `.env` ещё нет, создайте его и заполните два случайных секрета:

```powershell
if (-not (Test-Path .env)) {
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 32
    $rng.GetBytes($bytes)
    $dbPassword = ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
    $rng.GetBytes($bytes)
    $jwtKey = ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
    $rng.Dispose()
    $envText = (Get-Content .env.example -Raw).Replace('POSTGRES_PASSWORD=', "POSTGRES_PASSWORD=$dbPassword").Replace('SECRET_KEY=', "SECRET_KEY=$jwtKey")
    [IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $envText)
    Remove-Variable dbPassword,jwtKey,envText,bytes,rng
}
```

Для существующего `.env` сохраните текущие настройки БД и добавьте отсутствующие
поля из `.env.example`. `SECRET_KEY` — случайная строка минимум 32 байта;
при смене ключа старые токены входа перестанут работать.
Не публикуйте `.env` или вывод `docker compose config` без `--quiet`.
Пароль БД не имеет значения по умолчанию. Спецсимволы в пароле корректно
кодируются в строке подключения API; в `.env` соблюдайте правила кавычек Docker.

## Запустить только БД

```powershell
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml up -d --wait --wait-timeout 120
docker compose -f compose.yaml ps
```

Ожидается `db` со статусом `healthy`. Подключение с компьютера:
`127.0.0.1:5432`, имя БД и пользователь — `asu_cloud`, пароль — из `.env`.

## Запустить БД и API

```powershell
docker compose -f compose.yaml -f compose.api.yaml config --quiet
docker compose -f compose.yaml -f compose.api.yaml up -d --build --wait --wait-timeout 180
docker compose -f compose.yaml -f compose.api.yaml ps
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
Start-Process http://127.0.0.1:8000/docs
```

Ожидаются два сервиса `healthy`, ответ `status: ok` и Swagger UI.
API сначала ждёт готовности PostgreSQL и применяет `alembic upgrade head`.
При ошибке миграции API не запускается. Перед миграцией существующей базы
сохраните резервную копию. Автоматическая загрузка демо-данных не выполняется.

На новой базе список вузов пуст. Для локальной демонстрации можно один раз
загрузить существующие вымышленные данные после запуска API:

```powershell
Get-Content data/demo/db_seed.sql -Raw | docker compose -f compose.yaml exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
Invoke-RestMethod http://127.0.0.1:8000/api/v1/universities
```

Ожидаются два вуза. Seed предназначен для чистой базы: повторно его не загружайте.
Демо-хэши пользователей не подходят для входа; зарегистрируйте нового пользователя
через API с одним из UUID полученных вузов. Работают регистрация, вход и профиль.
Backend объявлений и форума ещё не реализован; их наличие в Swagger-контракте
не означает готовности серверных обработчиков.

Frontend запускают отдельно по `frontend/README.md`; адрес API по умолчанию —
`http://localhost:8000/api/v1`.

## Порты, сохранность и диагностика

Если 5432 занят, измените в `.env` `POSTGRES_PORT=5433`. Если занят 8000,
установите `API_PORT=8001` и измените адрес API во frontend и командах проверки.
Внутренний адрес БД остаётся `db:5432`. Пользователь PostgreSQL в этом локальном
окружении — суперпользователь; для публичного сервера нужны отдельные права.

Данные PostgreSQL хранятся в именованном volume `postgres_data`, путь контейнера
для PostgreSQL 18 — `/var/lib/postgresql`. Остановка сохраняет данные:

```powershell
docker compose -f compose.yaml -f compose.api.yaml down
```

Не используйте `down --volumes`, если хотите сохранить данные. Запускайте
из той же папки с тем же именем Compose-проекта, чтобы подключался прежний volume.
После повторного `up` зарегистрированные пользователи и данные должны сохраниться.

При ошибке:

```powershell
docker compose -f compose.yaml -f compose.api.yaml ps
docker compose -f compose.yaml -f compose.api.yaml logs --tail 60 api db
```

`port is already allocated` — измените внешний порт. `SECRET_KEY must contain...`
— заполните ключ. Ошибка пароля PostgreSQL на существующем volume — используйте
пароль, с которым база была создана: смена `.env` не меняет пароль в сохранённой БД.
Ошибку миграции устраняют до запуска API, сохраняя данные и текст ошибки без секретов.

Справка: [объединение Compose-файлов](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/),
[сеть Compose](https://docs.docker.com/compose/how-tos/networking/),
[официальный образ PostgreSQL](https://hub.docker.com/_/postgres).
