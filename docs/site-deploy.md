# Включение GitHub Pages

Сайт команды находится в папке `site/`. После появления изменений в `main` GitHub Actions автоматически публикует сайт.

Для первого запуска владельцу репозитория может понадобиться: **Settings → Pages → Build and deployment → Source → GitHub Actions**.

Посмотреть публикацию: **Actions → Publish Team Portal**. Если автоматический запуск не произошёл, выберите **Run workflow** на ветке `main`.

Адрес: https://matveyruchkin.github.io/asu-cloud-platform/

Если workflow завершился ошибкой, откройте детали запуска и проверьте, что GitHub Pages включён для репозитория. Если в настройках отсутствуют Pages, попросите владельца настроить этот раздел.

Локально: `python -m http.server 8080 --directory site`, затем http://localhost:8080 .

В `site/team.json` указаны персональные роли и ссылки на Issues. Публичный сайт не должен содержать оценки работоспособности, личные данные, пароли, ключи или секреты.
