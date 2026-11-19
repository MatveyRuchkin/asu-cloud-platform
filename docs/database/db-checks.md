# SQL-проверки демонстрационных данных

Статус: DB-02. Запускать после применения миграции DB-01 и загрузки
`data/demo/db_seed.sql`.

## Подготовка

На чистой PostgreSQL:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://app:app@localhost:5432/app"
backend\.venv\Scripts\alembic.exe -c backend\alembic.ini upgrade head
psql $env:DATABASE_URL -f data/demo/db_seed.sql

Данные полностью вымышленные: адреса используют зарезервированный домен
example.test, а поле password_hash не содержит настоящих паролей.

Проверка 1. Объявления, авторы, вузы и категории
SELECT
    ads.title,
    users.display_name AS author,
    universities.name AS university,
    ad_categories.name AS category,
    ads.status
FROM ads
JOIN users ON users.id = ads.author_id
JOIN universities ON universities.id = ads.university_id
JOIN ad_categories ON ad_categories.id = ads.category_id
ORDER BY ads.title;
Ожидаемый результат: 3 объявления; у каждого есть автор, вуз и категория.

Проверка 2. Активные объявления выбранного вуза
SELECT
    universities.name AS university,
    ads.title,
    ads.price_rub
FROM ads
JOIN universities ON universities.id = ads.university_id
WHERE universities.name = 'Северный технический университет'
  AND ads.status = 'active'
ORDER BY ads.title;
Ожидаемый результат: 2 активных объявления Северного технического университета.

Проверка 3. Темы форума с разделом и автором
SELECT
    forum_sections.name AS section,
    forum_topics.title,
    users.display_name AS author
FROM forum_topics
JOIN forum_sections ON forum_sections.id = forum_topics.section_id
JOIN users ON users.id = forum_topics.author_id
ORDER BY forum_topics.title;
Ожидаемый результат: 2 темы; у каждой есть раздел и автор.

Проверка 4. Ответы в темах форума
SELECT
    forum_topics.title AS topic,
    users.display_name AS author,
    forum_replies.body
FROM forum_replies
JOIN forum_topics ON forum_topics.id = forum_replies.topic_id
JOIN users ON users.id = forum_replies.author_id
ORDER BY forum_replies.created_at, forum_replies.id;
Ожидаемый результат: 3 ответа, связанные с существующими темами и авторами.

Проверка 5. Количество ответов по темам
SELECT
    forum_topics.title,
    COUNT(forum_replies.id) AS replies_count
FROM forum_topics
LEFT JOIN forum_replies ON forum_replies.topic_id = forum_topics.id
GROUP BY forum_topics.id, forum_topics.title
ORDER BY forum_topics.title;
Ожидаемый результат: у темы про подготовку к экзамену — 2 ответа,
у темы про мероприятие — 1 ответ.