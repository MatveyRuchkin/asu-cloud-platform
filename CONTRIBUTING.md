# Как принять участие

**Начните здесь: [Пошаговая инструкция с нуля](docs/START_HERE.md)** · **[OpenCode для начинающих](docs/OPENCODE.md)** — регистрация GitHub, выбор своей Issue, команда `беру`, установка Git, VS Code и **OpenCode**, бесплатные варианты нейросетей, работа с файлами и сдача Pull Request.

**По вопросам обращайтесь сначала к руководителю своего направления.** [Схема руководителей и контактов](docs/TEAM_STRUCTURE.md). Матвею Ручкину обычные технические вопросы напрямую отправлять не нужно — лид сам передаст важный вопрос.

## Если уже знакомы с Git

1. [Найдите себя на сайте команды](https://matveyruchkin.github.io/asu-cloud-platform/).
2. Откройте **свою** Issue, напишите `беру` в Add a comment, проверьте Assignees.
3. Прочитайте [AGENTS.md](AGENTS.md), [архитектуру](docs/architecture.md) и [контракт API](docs/api/openapi.yaml). Контракт пока требует утверждения.
4. Создайте fork, клонируйте, затем добавьте upstream:

```bash
git clone https://github.com/ВАШ_ЛОГИН/asu-cloud-platform.git
cd asu-cloud-platform
git remote add upstream https://github.com/MatveyRuchkin/asu-cloud-platform.git
git fetch upstream dev
git switch -c feature/НОМЕР upstream/dev
```

5. Решите только свою Issue и проверьте изменения. Нейросети использовать можно, но за результат отвечаете вы.
6. Сделайте commit и push ветки в свой fork. Создайте Pull Request с **base = MatveyRuchkin/asu-cloud-platform:dev** и строкой `Closes #НОМЕР`.
7. Дождитесь ревью и при необходимости поправьте PR. После merge в `dev` задача не обязательно автоматически закрывается — проверяющий подтверждает готовность.

**Безопасность:** не коммитьте ключи, пароли, токены, `.env` и личные данные студентов. Не создавайте новый проект вместо работы с существующим репозиторием. При непонятной ошибке обратитесь к PM/наставнику.

## Срок первого спринта

[Все задачи и структура](docs/SPRINT_2026-10-14.md). **Дедлайн 23 октября 2026, 23:59 МСК.** Нужно открыть PR в `dev` и показать результаты собственной проверки.

## Если вы получили права Write (работа без fork)

**Write не означает разрешение редактировать `main` или `dev` напрямую.**
Можно пушить свою отдельную ветку в **общий** репозиторий, но сдавать результат только через PR в `dev`.
Если у вас нет Write, используйте fork по инструкции выше — это полноценный способ участия.

```bash
git clone https://github.com/MatveyRuchkin/asu-cloud-platform.git
cd asu-cloud-platform
git fetch origin dev
git switch -c feature/НОМЕР origin/dev
# внесите изменения и проверьте их
git add .
git commit -m "feat: выполнить задачу НОМЕР"
git push -u origin feature/НОМЕР
```

После push откройте PR: **base: `dev`**, **compare: `feature/НОМЕР`**. В описании укажите `Closes #НОМЕР` и как проверяли работу.

Нельзя применять `git push --force` к общим веткам, напрямую менять `main`/`dev` или самостоятельно объединять PR без проверки. Если изменения затрагивают API, БД или workflows, согласуйте их с ответственными.
[Зачем защищать ветки и кто проверяет PR](docs/GITHUB_SECURITY.md).
