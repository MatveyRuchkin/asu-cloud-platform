"""Проверки health-эндпоинта и его соответствия контракту API."""

from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import pytest
import yaml
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

CONTRACT_PATH = Path(__file__).resolve().parents[2] / "docs" / "api" / "openapi.yaml"


def test_health_returns_ok() -> None:
    """GET /api/v1/health отвечает 200 и статусом ok."""
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_health_is_in_generated_openapi() -> None:
    """Сгенерированный OpenAPI приложения содержит путь /api/v1/health."""
    schema = client.get("/openapi.json").json()

    assert "/api/v1/health" in schema["paths"]


def test_unknown_path_uses_contract_error_format() -> None:
    """Ошибки HTTP отдаются в формате контракта: code, message, details."""
    response = client.get("/api/v1/does-not-exist")

    assert response.status_code == 404

    payload = response.json()

    assert payload["code"] == "not_found"
    assert isinstance(payload["message"], str)
    assert "details" not in payload


def test_health_matches_project_contract() -> None:
    """Реализация health соответствует черновику контракта docs/api/openapi.yaml."""
    if not CONTRACT_PATH.is_file():
        pytest.skip("Файл контракта docs/api/openapi.yaml недоступен")

    contract: dict[str, Any] = yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))

    # В контракте путь записан относительно адреса сервера: /health + префикс /api/v1.
    server_path = urlparse(contract["servers"][0]["url"]).path.rstrip("/")
    contract_path = f"{server_path}/health"

    assert "/health" in contract["paths"]
    assert (
        contract["paths"]["/health"]["get"]["responses"]["200"]["content"]["application/json"][
            "schema"
        ]["properties"]["status"]["type"]
        == "string"
    )

    assert contract_path in client.get("/openapi.json").json()["paths"]

    response = client.get(contract_path)

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
