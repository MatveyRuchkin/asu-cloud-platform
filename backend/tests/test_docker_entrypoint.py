"""Check Docker startup with special-character credentials and migration failures."""

import os
import subprocess
from unittest.mock import Mock

import docker_entrypoint
import pytest
from sqlalchemy.engine import make_url


@pytest.fixture()
def compose_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("POSTGRES_USER", "asu_cloud")
    monkeypatch.setenv("POSTGRES_PASSWORD", "local-test:@/#% password")
    monkeypatch.setenv("POSTGRES_DB", "asu_cloud")
    monkeypatch.setenv("SECRET_KEY", "local-test-key-32-bytes-or-longer-12345")
    monkeypatch.delenv("DATABASE_URL", raising=False)


@pytest.mark.usefixtures("compose_env")
def test_startup_preserves_special_password_and_migrates_before_api(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    steps: list[str] = []

    def migrate(*args: object, **kwargs: object) -> None:
        url = make_url(os.environ["DATABASE_URL"])
        assert url.password == "local-test:@/#% password"
        assert url.host == "db" and url.port == 5432
        steps.append("migrate")

    monkeypatch.setattr(docker_entrypoint.subprocess, "run", migrate)
    monkeypatch.setattr(docker_entrypoint.os, "execv", lambda *args: steps.append("api"))
    docker_entrypoint.main()
    assert steps == ["migrate", "api"]


@pytest.mark.usefixtures("compose_env")
def test_migration_failure_prevents_api_start(monkeypatch: pytest.MonkeyPatch) -> None:
    migrate = Mock(side_effect=subprocess.CalledProcessError(1, "alembic"))
    start_api = Mock()
    monkeypatch.setattr(docker_entrypoint.subprocess, "run", migrate)
    monkeypatch.setattr(docker_entrypoint.os, "execv", start_api)
    with pytest.raises(subprocess.CalledProcessError):
        docker_entrypoint.main()
    start_api.assert_not_called()


@pytest.mark.usefixtures("compose_env")
def test_short_signing_key_stops_before_connecting(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SECRET_KEY", "change-me")
    migrate = Mock()
    monkeypatch.setattr(docker_entrypoint.subprocess, "run", migrate)
    with pytest.raises(SystemExit, match="at least 32 bytes"):
        docker_entrypoint.main()
    migrate.assert_not_called()
