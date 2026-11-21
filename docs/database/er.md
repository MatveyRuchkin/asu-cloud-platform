# ER-схема PostgreSQL для MVP

Статус: черновик DB-01 для согласования с Backend Lead, API Lead и DB Lead.

Схема покрывает ближайший MVP: регистрацию студентов, справочник вузов,
объявления и форум. Идентификаторы всех сущностей — UUID. Временные метки
хранятся в UTC.

```mermaid
erDiagram
    UNIVERSITIES ||--o{ USERS : "обучает"
    UNIVERSITIES ||--o{ ADS : "публикуются в"
    USERS ||--o{ ADS : "создаёт"
    AD_CATEGORIES ||--o{ ADS : "категоризирует"
    FORUM_SECTIONS ||--o{ FORUM_TOPICS : "содержит"
    USERS ||--o{ FORUM_TOPICS : "создаёт"
    FORUM_TOPICS ||--o{ FORUM_REPLIES : "содержит"
    USERS ||--o{ FORUM_REPLIES : "пишет"

    UNIVERSITIES {
        uuid id PK
        varchar name UK
        timestamptz created_at
    }

    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar display_name
        uuid university_id FK
        varchar faculty
        smallint course
        timestamptz created_at
        timestamptz updated_at
    }

    AD_CATEGORIES {
        uuid id PK
        varchar name UK
        timestamptz created_at
    }

    ADS {
        uuid id PK
        uuid author_id FK
        uuid university_id FK
        uuid category_id FK
        varchar title
        text description
        integer price_rub
        varchar image_url
        varchar status
        timestamptz created_at
        timestamptz updated_at
    }

    FORUM_SECTIONS {
        uuid id PK
        varchar name UK
        text description
        timestamptz created_at
    }

    FORUM_TOPICS {
        uuid id PK
        uuid section_id FK
        uuid author_id FK
        varchar title
        text body
        timestamptz created_at
        timestamptz updated_at
    }

    FORUM_REPLIES {
        uuid id PK
        uuid topic_id FK
        uuid author_id FK
        text body
        timestamptz created_at
        timestamptz updated_at
    }

    Таблицы и ограничения
Таблица	Назначение	Основные ограничения
universities	Справочник вузов	name обязателен и уникален
users	Учётные записи и профили студентов	email уникален; display_name обязателен; university_id обязателен; course от 1 до 6 либо NULL
ad_categories	Категории объявлений	name обязателен и уникален
ads	Объявления студентов	обязательны автор, вуз, категория, заголовок и описание; price_rub >= 0 либо NULL; status — active или closed
forum_sections	Разделы форума	name обязателен и уникален
forum_topics	Темы форума	обязательны раздел, автор и заголовок
forum_replies	Ответы в темах	обязательны тема, автор и текст


Связи
- Один вуз содержит много пользователей и объявлений.
- Пользователь может создавать много объявлений, тем и ответов.
- Категория объединяет много объявлений.
- Раздел форума содержит много тем.
- Тема содержит много ответов.
- Внешние ключи запрещают создание объявления, темы или ответа со ссылкой на несуществующую сущность.
- Удаление пользователя, вуза, категории, раздела или темы с зависимыми данными запрещено до отдельного согласованного решения.
Соответствие OpenAPI
- users.id, users.display_name, users.university_id, users.faculty, users.course соответствуют User.
- universities.id, universities.name соответствуют University.
- ads.id, ads.author_id, ads.university_id, ads.category_id, ads.title,
  ads.description, ads.price_rub, ads.image_url, ads.status соответствуют Ad.
- forum_sections.id, forum_sections.name, forum_sections.description
  соответствуют ForumSection.
- forum_topics.id, forum_topics.section_id, forum_topics.author_id,
  forum_topics.title соответствуют ForumTopic.
Поле password_hash не возвращается через API и не является паролем в открытом виде.
Решения, ожидающие ревью
- Финальный набор категорий объявлений и разделов форума.
- Правила удаления и архивирования сущностей.
- Максимальные длины текстовых полей и индексы для поиска.
- Согласование точных моделей с backend до включения миграции в рабочий запуск.