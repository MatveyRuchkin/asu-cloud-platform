"""Общие зависимости FastAPI.

Развитие каталога ``app/core/`` после каркаса ARCH-01 — задача BE-01.
Здесь живёт зависимость текущего пользователя: она нужна модулям auth,
users и будущим защищённым маршрутам, поэтому вынесена в общий каталог,
а не в папку одного модуля.
"""

import uuid
from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.security import decode_access_token
from app.db.models import User
from app.db.session import get_session

# auto_error=False: без заголовка Authorization сами отвечаем 401 в формате
# Error из контракта, а не стандартным 403 от HTTPBearer.
bearer_scheme = HTTPBearer(auto_error=False)


def unauthorized_error() -> ApiError:
    """Ошибка 401 в формате контракта для всех случаев «требуется вход»."""
    return ApiError(401, "unauthorized", "Требуется вход")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> User:
    """Возвращает пользователя по заголовку ``Authorization: Bearer <token>``.

    401 — если заголовка нет, токен испорчен, просрочен или пользователь
    больше не существует.
    """
    if credentials is None:
        raise unauthorized_error()
    try:
        user_id = uuid.UUID(decode_access_token(credentials.credentials))
    except (jwt.InvalidTokenError, ValueError):
        raise unauthorized_error() from None
    user = session.scalar(select(User).where(User.id == user_id))
    if user is None:
        raise unauthorized_error()
    return user


# Удобный псевдоним для маршрутов: current_user: CurrentUser = Depends() не нужен,
# достаточно аннотации параметра.
CurrentUser = Annotated[User, Depends(get_current_user)]
