"""Хранение данных модуля auth: единственный файл модуля, знающий про SQL.

Работает с таблицами ``users`` и ``universities`` (модели — общие,
``app/db/models.py``). Хэширование пароля выполняется в сервисе: репозиторий
получает уже готовый ``password_hash`` и никогда не видит открытый пароль.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import University, User


class AuthRepository:
    """Доступ к данным, нужным для регистрации и входа."""

    def __init__(self, session: Session) -> None:
        self._session = session

    def university_exists(self, university_id: uuid.UUID) -> bool:
        """Проверяет, что вуз существует (регистрация только с реальным вузом)."""
        return self._session.get(University, university_id) is not None

    def get_user_by_email(self, email: str) -> User | None:
        """Возвращает пользователя по email или ``None``."""
        return self._session.scalar(select(User).where(User.email == email))

    def create_user(
        self,
        *,
        email: str,
        password_hash: str,
        display_name: str,
        university_id: uuid.UUID,
    ) -> User:
        """Сохраняет нового пользователя и возвращает его с заполненным id."""
        user = User(
            email=email,
            password_hash=password_hash,
            display_name=display_name,
            university_id=university_id,
        )
        self._session.add(user)
        self._session.commit()
        self._session.refresh(user)
        return user
