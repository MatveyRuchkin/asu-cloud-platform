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
    monkeypatch.delenv("DB_HOST", raising=False)
    monkeypatch.delenv("DB_PORT", raising=False)
    monkeypatch.setattr(docker_entrypoint, "wait_for_database", Mock())


@pytest.mark.usefixtures("compose_env")
def test_startup_preserves_special_password_and_migrates_before_api(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    steps: list[str] = []

    def migrate(*args: object, **kwargs: object) -> None:
        url = make_url(os.environ["DATABASE_URL"])
        assert url.password == "local-test:@/#% password"
        assert url.host == "db" and url.port == 5432
        steps.append(args[0][2])

    monkeypatch.setattr(docker_entrypoint.subprocess, "run", migrate)
    monkeypatch.setattr(docker_entrypoint.os, "execv", lambda *args: steps.append("api"))
    docker_entrypoint.main()
    assert steps == ["alembic", "app.seed_reference_data", "api"]


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


@pytest.mark.usefixtures("compose_env")
def test_remote_database_uses_vm_address_and_published_port(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DB_HOST", "192.168.1.10")
    monkeypatch.setenv("DB_PORT", "55432")
    migrate = Mock()
    monkeypatch.setattr(docker_entrypoint.subprocess, "run", migrate)
    monkeypatch.setattr(docker_entrypoint.os, "execv", Mock())
    docker_entrypoint.main()
    url = make_url(os.environ["DATABASE_URL"])
    assert url.host == "192.168.1.10" and url.port == 55432
    assert url.password == "local-test:@/#% password"
    docker_entrypoint.wait_for_database.assert_called_once_with(url)
    assert migrate.call_count == 2


@pytest.mark.usefixtures("compose_env")
def test_unavailable_database_prevents_migration_and_api_start(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    wait = Mock(side_effect=SystemExit("Database unavailable"))
    migrate, start = Mock(), Mock()
    monkeypatch.setattr(docker_entrypoint, "wait_for_database", wait)
    monkeypatch.setattr(docker_entrypoint.subprocess, "run", migrate)
    monkeypatch.setattr(docker_entrypoint.os, "execv", start)
    with pytest.raises(SystemExit, match="Database unavailable"):
        docker_entrypoint.main()
    migrate.assert_not_called()
    start.assert_not_called()


@pytest.mark.usefixtures("compose_env")
def test_reference_setup_failure_prevents_server_start(monkeypatch: pytest.MonkeyPatch) -> None:
    run = Mock(side_effect=[None, subprocess.CalledProcessError(1, "reference setup")])
    start = Mock()
    monkeypatch.setattr(docker_entrypoint.subprocess, "run", run)
    monkeypatch.setattr(docker_entrypoint.os, "execv", start)
    with pytest.raises(subprocess.CalledProcessError):
        docker_entrypoint.main()
    start.assert_not_called()
