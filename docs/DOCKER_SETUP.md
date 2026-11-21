# PostgreSQL, API и Vue-сайт в Docker

`compose.yaml` запускает только PostgreSQL 18; `compose.api.yaml` — API и пользовательский сайт Vue.
Они работают как на двух виртуальных машинах, так и вместе на одной.
По умолчанию порты БД и API привязаны к `127.0.0.1`, а сайт публикуется
на `0.0.0.0:8080`. Адреса и порты настраиваются в `.env`. Настоящий `.env` в Git не публикуется.


## Готовый env-файл с открытыми портами

В репозитории есть `deploy.env` — публичные настройки для одной виртуалки:

| Сервис | Публикуемый адрес | Внутренний порт |
| --- | --- | --- |
| PostgreSQL | `10.10.214.122:5432` | `5432` |
| API / Swagger | `10.10.214.122:8000` | `8000` |
| Пользовательский сайт | `10.10.214.122:8080` | `80` |

Пароль БД и `SECRET_KEY` остаются в вашем существующем `.env` на виртуалке.
`deploy.env` не содержит секретов и не меняет имя базы, пользователя или пароль.
Для применения используйте **оба** env-файла в указанном порядке:

```powershell
docker compose --env-file .env --env-file deploy.env -f compose.yaml -f compose.api.yaml config --quiet
docker compose --env-file .env --env-file deploy.env -f compose.yaml -f compose.api.yaml up -d --build --wait --wait-timeout 180
docker compose --env-file .env --env-file deploy.env -f compose.yaml -f compose.api.yaml ps
```

Второй env-файл переопределяет только перечисленные в нём сетевые настройки.
Внешние переменные окружения терминала имеют приоритет над обоими файлами:
если вы ранее экспортировали `WEB_PORT`, `API_PORT` или `POSTGRES_BIND_IP`,
сначала проверьте их. Полный `config` без `--quiet` может показать секреты.

Откройте `http://10.10.214.122:8080/` для сайта или
`http://10.10.214.122:8000/docs` для Swagger. Подключение к БД с другой машины:
`10.10.214.122:5432`. Все три порта привязаны только к указанному
интерфейсу ВМ. Адрес должен присутствовать на ВМ: проверьте `ip -4 addr`.
Для другой машины измените три переменные `*_BIND_IP` в `deploy.env`. Для доступа из вашей сети
должны быть разрешены TCP 5432, 8000 и 8080 в правилах ВМ и гипервизора.

Этот файл предназначен для одной ВМ. Для двух ВМ задайте `DB_HOST` и `DB_PORT`
по инструкции ниже вместо использования локального имени `db`.

## Пользовательский сайт на одной ВМ

В существующий `.env` в корне добавьте:

```dotenv
WEB_BIND_IP=0.0.0.0
WEB_PORT=8080
```

Настройки БД и `SECRET_KEY` сохраните. Сайт включён в прежнюю команду:

```powershell
docker compose -f compose.yaml -f compose.api.yaml up -d --build --wait --wait-timeout 180
docker compose -f compose.yaml -f compose.api.yaml ps
```

Откройте `http://IP_ВИРТУАЛКИ:8080/`. Это Vue-сайт; `http://IP_ВИРТУАЛКИ:8000/docs`
по-прежнему открывает Swagger API. Для клиентов из локальной сети разрешите TCP 8080.
Если 8080 занят, поменяйте `WEB_PORT` и используйте новый порт в браузере.

Сайт показывает объявления с поиском и категориями, демо-форму добавления,
примеры тем форума и профиля. Демо-данные явно помечены; добавление примера
не отправляет запрос в API и сохраняется только до перезагрузки страницы.
Формы входа и регистрации используют настоящий API. Пустой справочник вузов
потребует загрузки демо-данных, описанной ниже. Отсутствующие серверные функции
объявлений/форума не выдаются за работающие.

Nginx отдаёт статическую сборку и проксирует `/api/` к `api:8000`.
Обновление страницы `/ads`, `/forum`, `/profile` или `/login` поддерживается.
Сайт запускается независимо от доступности API: демонстрационные разделы
остаются видны при сбое API. Команда `up --wait` при этом честно сообщит,
что весь стек не готов. Диагностика:

```powershell
docker compose -f compose.yaml -f compose.api.yaml logs --tail 60 web api
```

## Две ВМ в одной сети

Пример: ВМ БД — `192.168.1.10`, ВМ API — `192.168.1.11`.
Замените эти адреса своими. На каждой ВМ нужен checkout ветки `dev`
и отдельный `.env` в корне рядом с Compose-файлами. Если `.env` отсутствует,
скопируйте `.env.example` и отредактируйте его.

На **ВМ с базой данных**, в `.env`:

```dotenv
POSTGRES_BIND_IP=192.168.1.10
POSTGRES_PORT=5432
POSTGRES_DB=asu_cloud
POSTGRES_USER=asu_cloud
POSTGRES_PASSWORD=ЗАМЕНИТЕ_СВОИМ_ПАРОЛЕМ
```

`POSTGRES_BIND_IP` — собственный адрес ВМ БД, существующий на её сетевом интерфейсе.
Запустите из корня репозитория:

```powershell
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml up -d --wait --wait-timeout 120
docker compose -f compose.yaml ps
```

Ожидается `db: healthy` с пробросом `192.168.1.10:5432->5432/tcp`.

На **ВМ с API**, в её `.env`:

```dotenv
DB_HOST=192.168.1.10
DB_PORT=5432
POSTGRES_DB=asu_cloud
POSTGRES_USER=asu_cloud
POSTGRES_PASSWORD=ТОТ_ЖЕ_ПАРОЛЬ_ЧТО_НА_ВМ_БД
API_BIND_IP=192.168.1.11
API_PORT=8000
WEB_BIND_IP=192.168.1.11
WEB_PORT=8080
SECRET_KEY=ЗАМЕНИТЕ_СЛУЧАЙНОЙ_СТРОКОЙ_МИНИМУМ_32_БАЙТА
```

`DB_HOST` — адрес ВМ БД, **не** адрес ВМ API, не `localhost` и не имя `db`.
`DB_PORT` — внешний порт БД из `POSTGRES_PORT` на первой ВМ; если там `5433`,
здесь тоже нужно `DB_PORT=5433`. Имя БД, пользователь и пароль должны совпадать
на обеих ВМ. `API_BIND_IP` — собственный адрес ВМ API.

Для доступа через несколько интерфейсов можно задать соответствующий
`POSTGRES_BIND_IP` или `API_BIND_IP` равным `0.0.0.0`; частный адрес ВМ
ограничивает публикацию нужным интерфейсом. Не привязывайте порт к IP другой ВМ.

Запустите **API и сайт** на второй ВМ:

```powershell
docker compose -f compose.api.yaml config --quiet
docker compose -f compose.api.yaml up -d --build --wait --wait-timeout 180
docker compose -f compose.api.yaml ps
Invoke-RestMethod http://192.168.1.11:8000/api/v1/health
```

Ожидаются `api: healthy`, `web: healthy`, ответ `status: ok`. Сайт: `http://192.168.1.11:8080/`. Swagger UI:
`http://192.168.1.11:8000/docs`. API ждёт подключения к БД, применяет миграции
и запускает сервер. PostgreSQL на ВМ API не создаётся.

Обычная сеть Docker не объединяет два Docker Engine. В этом варианте
подключение проходит по сети виртуальных машин через опубликованный порт БД.
Разрешите на ВМ БД входящий TCP 5432 от ВМ API, а на ВМ API — входящие TCP 8080 (сайт) и 8000 (Swagger/API)
от нужных клиентов. Используйте свои порты, если поменяли значения.
Проверьте также правила сети гипервизора или облака.

Проверка из PowerShell на ВМ API:

```powershell
Test-NetConnection 192.168.1.10 -Port 5432
```

`TcpTestSucceeded: True` подтверждает TCP-доступность порта, но не проверяет
пароль. При `False` проверьте IP, порт, `docker compose ps` на первой ВМ
и правила сети. Если TCP доступен, но API не поднимается, проверьте совпадение
имени БД, пользователя и пароля и журнал API:

```powershell
docker compose -f compose.api.yaml logs --tail 60 api
```

Не публикуйте вывод с секретами. В существующем PostgreSQL-volume изменение
пароля в `.env` не меняет пароль уже созданного пользователя БД.

## Локальный запуск на одной машине

Нужен Docker Engine с Linux-контейнерами и Docker Compose v2 или новее
с поддержкой `--wait`, например Docker Desktop. Команды — PowerShell
из корня репозитория. Для локального режима оставьте `DB_HOST=db`,
`DB_PORT=5432`, `POSTGRES_BIND_IP=127.0.0.1`, `API_BIND_IP=127.0.0.1`.
При запуске обоих файлов вместе Docker объединяет сервисы в локальную сеть.

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

Ожидаются три сервиса `healthy` (`db`, `api`, `web`), ответ `status: ok` и Swagger UI.
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

Пользовательский сайт Vue включён в `compose.api.yaml`; откройте
`http://IP_ВИРТУАЛКИ:8080/`. Из браузера API вызывается по относительному адресу
`/api/v1` через Nginx, поэтому IP сервера не требуется вшивать в JavaScript.
Для отдельной разработки без Docker остаётся инструкция `frontend/README.md`.

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
