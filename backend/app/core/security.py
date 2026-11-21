"""Безопасность: хэширование паролей и JWT-токены доступа.

Пароли хранятся только в виде хэша bcrypt с солью; открытые пароли не
логируются и не попадают в ответы API (ADR-007 в docs/architecture/decisions.md).
Токен доступа — JWT, алгоритм и срок действия берутся из настроек
(``JWT_ALGORITHM``, ``ACCESS_TOKEN_EXPIRE_MINUTES`` в ``.env``).
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings

settings = get_settings()


def hash_password(password: str) -> str:
    """Возвращает хэш пароля с солью (bcrypt) в виде строки."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Проверяет пароль против сохранённого хэша."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Хэш повреждён или имеет неподдерживаемый формат — пароль не подходит.
        return False


def create_access_token(user_id: str) -> str:
    """Подписывает JWT доступа для пользователя (поле ``sub`` — id)."""
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str:
    """Проверяет подпись и срок действия токена и возвращает id пользователя.

    Поднимает ``jwt.InvalidTokenError`` (или его подклассы), если токен
    просрочен, подписан другим ключом или испорчен.
    """
    payload: dict[str, Any] = jwt.decode(
        token,
        settings.secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    user_id = payload.get("sub")
    if not isinstance(user_id, str):
        raise jwt.InvalidTokenError("В токене нет идентификатора пользователя")
    return user_id
