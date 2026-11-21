"""Маршрут модуля users: ``GET /users/me``.

Возвращает профиль текущего пользователя по заголовку
``Authorization: Bearer <token>``. Путь и ответ — по контракту
``docs/api/openapi.yaml``; 401 без токена — общая зависимость
``get_current_user``.
"""

from fastapi import APIRouter

from app.core.deps import CurrentUser
from app.modules.users.schemas import User

router = APIRouter(tags=["users"])


@router.get(
    "/users/me",
    response_model=User,
    summary="Свой профиль",
)
async def me(current_user: CurrentUser) -> User:
    """Профиль пользователя, чей токен передан в заголовке."""
    return User.model_validate(current_user)
