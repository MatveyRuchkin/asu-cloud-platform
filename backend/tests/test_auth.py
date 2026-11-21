"""Проверки регистрации, входа и профиля (BE-01, Issue #6).

Тесты работают на SQLite в памяти: таблицы создаются из тех же моделей
(``app/db/models.py``), что и в PostgreSQL, поэтому прогоняются у любого
участника без установленной базы и исчезают после запуска.

Тест-данные — те же, что в сценариях QA-02 (PR #56,
``tests/manual/auth-cases.md``): результаты backend и QA совпадают.
"""

import uuid
from collections.abc import Generator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import verify_password
from app.db.models import Base, University, User
from app.db.session import get_session
from app.main import app

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
ME_URL = "/api/v1/users/me"
UNIVERSITIES_URL = "/api/v1/universities"

TEST_UNIVERSITY_ID = uuid.UUID("10000000-0000-0000-0000-000000000001")
QA_EMAIL = "maria.ivanova.test@example.com"
QA_PASSWORD = "StrongPass123"


@pytest.fixture()
def session_factory() -> sessionmaker[Session]:
    """Свежая база SQLite в памяти с таблицами из моделей приложения."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture()
def client(session_factory: sessionmaker[Session]) -> Generator[TestClient, None, None]:
    """Приложение с подменённой базой: SQLite вместо PostgreSQL из ``.env``."""

    def override_get_session() -> Generator[Session, None, None]:
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = override_get_session
    with TestClient(app) as test_client:
        with session_factory() as session:
            session.add(University(id=TEST_UNIVERSITY_ID, name="Северный технический университет"))
            session.commit()
        yield test_client
    app.dependency_overrides.clear()


def register_payload(**overrides: Any) -> dict[str, Any]:
    """Тело регистрации как в успешном сценарии QA-02, с возможностью правок."""
    payload: dict[str, Any] = {
        "email": QA_EMAIL,
        "password": QA_PASSWORD,
        "display_name": "Мария Иванова",
        "university_id": str(TEST_UNIVERSITY_ID),
    }
    payload.update(overrides)
    return payload


def register(client: TestClient, **overrides: Any) -> Any:
    return client.post(REGISTER_URL, json=register_payload(**overrides))


# --- Успешные сценарии (QA-02: сценарии 1 и 2) ---


def test_register_success(client: TestClient) -> None:
    """Сценарий 1: регистрация -> 201 и профиль по схеме User."""
    response = register(client)

    assert response.status_code == 201
    body = response.json()
    assert uuid.UUID(body["id"])
    assert body["display_name"] == "Мария Иванова"
    assert body["university_id"] == str(TEST_UNIVERSITY_ID)
    assert body["faculty"] is None
    assert body["course"] is None


def test_register_stores_only_password_hash(
    client: TestClient,
    session_factory: sessionmaker[Session],
) -> None:
    """Пароль сохраняется только как bcrypt-хэш; открытого пароля в базе нет."""
    register(client)

    with session_factory() as session:
        user = session.scalar(select(User).where(User.email == QA_EMAIL))
        assert user is not None
        assert user.password_hash != QA_PASSWORD
        assert user.password_hash.startswith("$2b$")
        assert verify_password(QA_PASSWORD, user.password_hash)


def test_login_success_returns_token(client: TestClient) -> None:
    """Сценарий 2: вход после регистрации -> 200 и токен bearer."""
    register(client)

    response = client.post(LOGIN_URL, json={"email": QA_EMAIL, "password": QA_PASSWORD})

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert isinstance(body["access_token"], str) and body["access_token"]


def test_users_me_returns_profile(client: TestClient) -> None:
    """/users/me с токеном -> 200 и профиль владельца токена."""
    register(client)
    token = client.post(
        LOGIN_URL,
        json={"email": QA_EMAIL, "password": QA_PASSWORD},
    ).json()["access_token"]

    response = client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["display_name"] == "Мария Иванова"


def test_universities_list_is_not_empty(client: TestClient) -> None:
    """/universities отдаёт список вузов (его ждёт форма регистрации FE-02)."""
    response = client.get(UNIVERSITIES_URL)

    assert response.status_code == 200
    universities = response.json()
    assert isinstance(universities, list) and universities
    assert universities[0]["name"] == "Северный технический университет"


# --- Ошибки регистрации: 400 в формате Error (QA-02: сценарии 3-6) ---


def test_register_duplicate_email_is_400(client: TestClient) -> None:
    """Повторная регистрация тем же email -> 400 email_already_exists."""
    register(client)

    response = register(client)

    assert response.status_code == 400
    assert response.json()["code"] == "email_already_exists"


def test_register_empty_fields_is_400(client: TestClient) -> None:
    """Сценарий 3: пустые обязательные поля -> 400 (не 422)."""
    response = register(
        client,
        email="",
        password="",
        display_name="",
        university_id="",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"


@pytest.mark.parametrize("bad_email", ["test.user", "user@", "@example.com"])
def test_register_invalid_email_is_400(client: TestClient, bad_email: str) -> None:
    """Сценарий 4: email не в формате email -> 400."""
    response = register(client, email=bad_email)

    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"


def test_register_short_password_is_400(client: TestClient) -> None:
    """Сценарий 5: пароль короче 8 символов -> 400."""
    response = register(client, password="Pass123")

    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"


@pytest.mark.parametrize("bad_university_id", ["12345", "not-a-uuid", ""])
def test_register_invalid_university_id_format_is_400(
    client: TestClient,
    bad_university_id: str,
) -> None:
    """Сценарий 6: university_id не в формате UUID -> 400."""
    response = register(client, university_id=bad_university_id)

    assert response.status_code == 400
    assert response.json()["code"] == "validation_error"


def test_register_unknown_university_is_400(client: TestClient) -> None:
    """Регистрация с несуществующим вузом -> 400 university_not_found."""
    response = register(
        client,
        email="someone.test@example.com",
        university_id="99999999-9999-9999-9999-999999999999",
    )

    assert response.status_code == 400
    assert response.json()["code"] == "university_not_found"


# --- Ошибки входа и профиля: 401 в формате Error ---


def test_login_wrong_password_is_401(client: TestClient) -> None:
    """Дополнительный сценарий QA-02: неверный пароль -> 401."""
    register(client)

    response = client.post(
        LOGIN_URL,
        json={"email": QA_EMAIL, "password": "WrongPass456"},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


def test_login_unknown_email_is_401(client: TestClient) -> None:
    """Вход под несуществующим email -> тот же 401 (не раскрываем существование)."""
    response = client.post(
        LOGIN_URL,
        json={"email": "nobody.test@example.com", "password": QA_PASSWORD},
    )

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


def test_users_me_without_token_is_401(client: TestClient) -> None:
    """/users/me без заголовка Authorization -> 401 (не 403)."""
    response = client.get(ME_URL)

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


def test_users_me_with_broken_token_is_401(client: TestClient) -> None:
    """/users/me с испорченным токеном -> 401."""
    response = client.get(ME_URL, headers={"Authorization": "Bearer not-a-jwt"})

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
