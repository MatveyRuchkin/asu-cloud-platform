"""Сборка маршрутов версии v1.

Каждый модуль подключает свой роутер здесь. Новый модуль — по правилам
docs/architecture/structure.md: сначала маршрут появляется в контракте
`docs/api/openapi.yaml`, потом — в коде.
"""

from fastapi import APIRouter

from app.api.v1 import health
from app.modules.ads.router import router as ads_router
from app.modules.auth.router import router as auth_router
from app.modules.forum.router import router as forum_router
from app.modules.universities.router import router as universities_router
from app.modules.users.router import router as users_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(universities_router)

api_router.include_router(ads_router)
api_router.include_router(forum_router)
