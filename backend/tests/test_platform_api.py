"""Real HTTP handlers, authorization, persistence, filters and reference lists."""

import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.models import Base, University, User
from app.db.session import get_session
from app.main import app
from app.modules.ads.models import Ad, AdCategory
from app.modules.forum.models import ForumSection, ForumTopic
from app.seed_reference_data import seed


@pytest.fixture()
def platform() -> Generator[tuple[TestClient, sessionmaker[Session]], None, None]:
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as session:
        seed(session)

    def override() -> Generator[Session, None, None]:
        with factory() as session:
            yield session

    app.dependency_overrides[get_session] = override
    try:
        with TestClient(app) as client:
            yield client, factory
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def credentials(client: TestClient) -> tuple[dict[str, str], dict, dict]:
    university = client.get("/api/v1/universities").json()[0]
    result = client.post(
        "/api/v1/auth/register",
        json={
            "email": "platform@example.com",
            "password": "PlatformTestPassword123",
            "display_name": "Platform user",
            "university_id": university["id"],
        },
    )
    assert result.status_code == 201
    token = client.post(
        "/api/v1/auth/login",
        json={
            "email": "platform@example.com",
            "password": "PlatformTestPassword123",
        },
    ).json()["access_token"]
    category = client.get("/api/v1/ad-categories").json()[0]
    return {"Authorization": f"Bearer {token}"}, result.json(), category


def test_create_ad_persists_and_uses_authenticated_identity(platform) -> None:
    client, factory = platform
    headers, user, category = credentials(client)
    response = client.post(
        "/api/v1/ads",
        headers=headers,
        json={
            "category_id": category["id"],
            "title": "Настоящее объявление",
            "description": "Сохранено через API",
            "price_rub": 200,
        },
    )
    assert response.status_code == 201
    ad = response.json()
    assert ad["author_id"] == user["id"] and ad["university_id"] == user["university_id"]
    with factory() as session:
        assert session.get(Ad, uuid.UUID(ad["id"])).title == "Настоящее объявление"
    assert client.get("/api/v1/ads", params={"category_id": category["id"]}).json() == [ad]
    assert client.get("/api/v1/ads", params={"university_id": str(uuid.uuid4())}).json() == []


def test_anonymous_create_is_denied(platform) -> None:
    client, factory = platform
    category = client.get("/api/v1/ad-categories").json()[0]
    assert (
        client.post(
            "/api/v1/ads",
            json={"category_id": category["id"], "title": "Test", "description": "Test"},
        ).status_code
        == 401
    )
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(Ad)) == 0


@pytest.mark.parametrize(
    "change",
    [
        {"price_rub": -1},
        {"price_rub": 1.5},
        {"title": "  "},
        {"author_id": str(uuid.uuid4())},
        {"university_id": str(uuid.uuid4())},
    ],
)
def test_invalid_ad_cannot_be_written(platform, change: dict) -> None:
    client, factory = platform
    headers, _, category = credentials(client)
    response = client.post(
        "/api/v1/ads",
        headers=headers,
        json={
            "category_id": category["id"],
            "title": "Test ad",
            "description": "Test",
            **change,
        },
    )
    assert response.status_code == 422
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(Ad)) == 0


def test_unknown_category_returns_400_without_write(platform) -> None:
    client, factory = platform
    headers, _, _ = credentials(client)
    response = client.post(
        "/api/v1/ads",
        headers=headers,
        json={
            "category_id": str(uuid.uuid4()),
            "title": "Test ad",
            "description": "Test",
        },
    )
    assert response.status_code == 400
    with factory() as session:
        assert session.scalar(select(func.count()).select_from(Ad)) == 0


def test_forum_reads_existing_data_and_filters_sections(platform) -> None:
    client, factory = platform
    _, user, _ = credentials(client)
    sections = client.get("/api/v1/forum/sections").json()
    with factory() as session:
        session.add(
            ForumTopic(
                section_id=uuid.UUID(sections[0]["id"]),
                author_id=uuid.UUID(user["id"]),
                title="Тема из БД",
                body="Текст",
            )
        )
        session.commit()
    assert (
        client.get("/api/v1/forum/topics", params={"section_id": sections[0]["id"]}).json()[0][
            "title"
        ]
        == "Тема из БД"
    )
    assert client.get("/api/v1/forum/topics", params={"section_id": sections[1]["id"]}).json() == []


def test_reference_seed_is_repeatable_and_does_not_create_users_or_ads(platform) -> None:
    _, factory = platform
    with factory() as session:
        seed(session)
        seed(session)
        for model, count in [
            (University, 1),
            (AdCategory, 3),
            (ForumSection, 3),
            (User, 0),
            (Ad, 0),
        ]:
            assert session.scalar(select(func.count()).select_from(model)) == count
