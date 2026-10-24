"""Настройки приложения.

Значения читаются из переменных окружения и файла `.env` (пример — `.env.example`).
Секреты в репозитории не хранятся: см. ADR-006 и ADR-007 в docs/architecture/decisions.md.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Настройки backend-приложения."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "ASU Cloud Platform API"
    api_v1_prefix: str = "/api/v1"
    debug: bool = False

    secret_key: str = "change-me"
    database_url: str = "postgresql+psycopg://app:app@localhost:5432/app"

    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    """Возвращает настройки приложения. Результат кэшируется."""
    return Settings()
