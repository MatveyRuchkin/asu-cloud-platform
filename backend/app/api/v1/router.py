"""Сборка маршрутов версии v1.

Каждый модуль подключает свой роутер здесь. Новый модуль — по правилам
docs/architecture/structure.md: сначала маршрут появляется в контракте
`docs/api/openapi.yaml`, потом — в коде.
"""

from fastapi import APIRouter

from app.api.v1 import health

api_router = APIRouter()
api_router.include_router(health.router)
