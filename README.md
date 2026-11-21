# ASU Cloud Platform — студенческая платформа

**Командный учебный проект для взаимодействия и взаимопомощи студентов.**

🔗 **[Портал команды: роли, персональные задания, инструкции](https://matveyruchkin.github.io/asu-cloud-platform/)** (после включения GitHub Pages)

## Что мы разрабатываем
Профили студентов, доску объявлений, форум. Учебные материалы, переписка и поиск остаются в общем видении продукта, но не обязательно входят в первый выпуск. [Подробнее](docs/requirements.md).

## Авторы разработки

Проект создаётся командой. В историю ветки `dev` вошли коммиты следующих
13 GitHub-авторов (проверено 21 ноября 2026):

- [Adilya1177](https://github.com/Adilya1177)
- [Antonova-vika](https://github.com/Antonova-vika)
- [arinaminko10](https://github.com/arinaminko10)
- [catround](https://github.com/catround)
- [Dildarkhan-mamaev](https://github.com/Dildarkhan-mamaev)
- [DmitriyDileev](https://github.com/DmitriyDileev)
- [hakuromi](https://github.com/hakuromi)
- [Kapitan999](https://github.com/Kapitan999)
- [makaes](https://github.com/makaes)
- [MatveyRuchkin](https://github.com/MatveyRuchkin)
- [PejaDuos](https://github.com/PejaDuos)
- [PurpleSwtr](https://github.com/PurpleSwtr)
- [Ton1q77](https://github.com/Ton1q77)

Авторство подтверждено исходными коммитами, а не аккаунтом, выполнившим merge.
Все исходные авторы сохраняются при интеграции изменений.
[Полная история разработки](https://github.com/MatveyRuchkin/asu-cloud-platform/commits/dev/)
и [GitHub Contributors](https://github.com/MatveyRuchkin/asu-cloud-platform/graphs/contributors).

Вся команда из 18 участников и роли опубликованы на
[портале проекта](https://matveyruchkin.github.io/asu-cloud-platform/).
Участие в команде и наличие уже вошедшего в репозиторий коммита — разные сведения.

## Новичку

**[Пошаговая инструкция с нуля](docs/START_HERE.md)** — от регистрации до отправки Pull Request.

**[OpenCode: установка и работа без обязательной подписки](docs/OPENCODE.md)** — самостоятельное руководство для Windows/macOS/Linux, выбор модели и работа с задачей.

**[Структура команды: лиды и к кому обращаться](docs/TEAM_STRUCTURE.md)** · [Схема на сайте](https://matveyruchkin.github.io/asu-cloud-platform/#hierarchy)

## Старт для участника
1. Найдите себя на [сайте команды](https://matveyruchkin.github.io/asu-cloud-platform/).
2. Откройте персональную Issue в [Issues](https://github.com/MatveyRuchkin/asu-cloud-platform/issues), прочитайте [CONTRIBUTING.md](CONTRIBUTING.md) и [AGENTS.md](AGENTS.md).
3. Выполняйте задачу в отдельной ветке от `dev` и присылайте PR в `dev`.

## Документы
- [Основные функции и этапы](docs/requirements.md)
- [Архитектура: решения, структура папок, локальный запуск](docs/architecture/) — принято техлидом
- [Архитектура и договорённости](docs/architecture.md) — черновик, на который опирались решения
- [OpenAPI-контракт](docs/api/openapi.yaml) — черновик, требует согласования
- [Задания всех 18 участников](docs/tasks/README.md)
- [Порядок настройки GitHub Pages](docs/site-deploy.md)

## Каркас проекта

- [backend/](backend/) — API на FastAPI: запуск, проверки, владельцы модулей
- [frontend/](frontend/) — приложение на Vue 3 + TypeScript: запуск, проверки, владельцы каталогов

Локальный запуск — по инструкции в [docs/architecture/structure.md](docs/architecture/structure.md).

## Ветки
`main` — стабильная версия; `dev` — рабочая версия; `feature/123` — изменения одной Issue.

## Статус
Репозиторий запущен, обязанности и первые задания опубликованы как проект для подтверждения. Реализация продукта начнётся после согласования архитектуры и контракта. Настоящий сайт — сайт **команды**, а не готовая студенческая платформа.

## Первый спринт

[Срок: 23 октября 2026, 23:59 МСК](docs/SPRINT_2026-10-14.md).

## Защита общего кода

[Правила работы с Write, проверкой PR и защитой веток](docs/GITHUB_SECURITY.md). **Даже с Write нельзя по правилам команды напрямую менять `main` и `dev`.**
