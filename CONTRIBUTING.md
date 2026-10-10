# Как принять участие

**Начните здесь: [Пошаговая инструкция с нуля](docs/START_HERE.md)** — регистрация GitHub, выбор своей Issue, команда `беру`, установка Git, VS Code и **OpenCode**, бесплатные варианты нейросетей, работа с файлами и сдача Pull Request.

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
