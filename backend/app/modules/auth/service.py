"""Логика регистрации и входа.

Ошибки — в общем формате ``Error`` из контракта:
- 400 ``university_not_found`` — регистрации с несуществующим вузом;
- 400 ``email_already_exists`` — email уже занят;
- 401 ``unauthorized`` — неверный email или пароль при входе
  (одно сообщение для обоих случаев, чтобы не раскрывать,
  существует ли email).
"""

from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.security import create_access_token, hash_password, verify_password
from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas import LoginRequest, RegisterRequest, Token
from app.modules.users.schemas import User


class AuthService:
    """Регистрация и вход."""

    def __init__(self, session: Session) -> None:
        self._repo = AuthRepository(session)

    def register(self, data: RegisterRequest) -> User:
        """Создаёт пользователя и возвращает его профиль."""
        if not self._repo.university_exists(data.university_id):
            raise ApiError(400, "university_not_found", "Указанный университет не найден")
        if self._repo.get_user_by_email(data.email) is not None:
            raise ApiError(
                400,
                "email_already_exists",
                "Пользователь с таким email уже зарегистрирован",
            )
        user = self._repo.create_user(
            email=data.email,
            password_hash=hash_password(data.password),
            display_name=data.display_name,
            university_id=data.university_id,
        )
        return User.model_validate(user)

    def login(self, data: LoginRequest) -> Token:
        """Проверяет учётные данные и выдаёт токен доступа."""
        user = self._repo.get_user_by_email(data.email)
        if user is None or not verify_password(data.password, user.password_hash):
            raise ApiError(401, "unauthorized", "Неверный email или пароль")
        return Token(access_token=create_access_token(str(user.id)))
