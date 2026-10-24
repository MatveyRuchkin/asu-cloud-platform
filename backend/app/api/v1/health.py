"""Проверка работы сервера.

Путь и форма ответа описаны в контракте `docs/api/openapi.yaml` (`/health`).
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    """Ответ проверки работы сервера."""

    status: str = Field(examples=["ok"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Проверка работы сервера",
)
async def health() -> HealthResponse:
    """Возвращает статус сервера. Используется для проверки готовности и в тестах."""
    return HealthResponse(status="ok")
