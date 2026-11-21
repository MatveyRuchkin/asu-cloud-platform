-- DB-03: воспроизводимые проверки начальной миграции и ограничений.
-- Запускать после применения миграции DB-01 к чистой PostgreSQL.
-- Скрипт заканчивается ROLLBACK и не оставляет тестовых данных.

BEGIN;

DO $$
BEGIN
    IF to_regclass('public.alembic_version') IS NULL
       OR to_regclass('public.universities') IS NULL
       OR to_regclass('public.users') IS NULL
       OR to_regclass('public.ads') IS NULL
       OR to_regclass('public.forum_sections') IS NULL
       OR to_regclass('public.forum_topics') IS NULL
       OR to_regclass('public.forum_replies') IS NULL THEN
        RAISE EXCEPTION
            'Начальная миграция DB-01 не применена или создала не все таблицы';
    END IF;
END;
$$;

-- Проверка 1: внешний ключ users.university_id.
DO $$
BEGIN
    BEGIN
        INSERT INTO users (
            id,
            email,
            password_hash,
            display_name,
            university_id
        ) VALUES (
            '90000000-0000-0000-0000-000000000001',
            'foreign-key-check@example.test',
            'not-a-real-password',
            'Проверка внешнего ключа',
            '99999999-9999-9999-9999-999999999999'
        );

        RAISE EXCEPTION
            'Ожидалось нарушение внешнего ключа users.university_id';
    EXCEPTION
        WHEN foreign_key_violation THEN
            RAISE NOTICE 'OK: внешний ключ users.university_id работает';
    END;
END;
$$;

-- Проверка 2: обязательное поле universities.name.
DO $$
BEGIN
    BEGIN
        INSERT INTO universities (id, name) VALUES (
            '90000000-0000-0000-0000-000000000002',
            NULL
        );

        RAISE EXCEPTION
            'Ожидалось нарушение NOT NULL для universities.name';
    EXCEPTION
        WHEN not_null_violation THEN
            RAISE NOTICE 'OK: universities.name является обязательным';
    END;
END;
$$;

-- Проверка 3: уникальность universities.name.
DO $$
BEGIN
    INSERT INTO universities (id, name) VALUES (
        '90000000-0000-0000-0000-000000000003',
        'DB-03 проверочный университет'
    );

    BEGIN
        INSERT INTO universities (id, name) VALUES (
            '90000000-0000-0000-0000-000000000004',
            'DB-03 проверочный университет'
        );

        RAISE EXCEPTION
            'Ожидалось нарушение уникальности universities.name';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'OK: уникальность universities.name работает';
    END;
END;
$$;

ROLLBACK;