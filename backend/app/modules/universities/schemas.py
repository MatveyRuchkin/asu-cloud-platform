"""Pydantic-схемы модуля universities.

Схема ``University`` повторяет одноимённую схему контракта
``docs/api/openapi.yaml``.
"""

import uuid

from pydantic import BaseModel, ConfigDict


class University(BaseModel):
    """Вуз (схема ``University`` из контракта)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
