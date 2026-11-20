"""Pydantic-схемы модуля users.

Схема ``User`` повторяет одноимённую схему контракта ``docs/api/openapi.yaml``.
Она используется и модулем auth (ответ регистрации): Pydantic-схемы модуля
видны другим модулям — см. docs/architecture/structure.md.
"""

import uuid

from pydantic import BaseModel, ConfigDict, Field


class User(BaseModel):
    """Профиль пользователя (схема ``User`` из контракта)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    display_name: str
    university_id: uuid.UUID
    faculty: str | None = None
    course: int | None = Field(default=None, ge=1)
