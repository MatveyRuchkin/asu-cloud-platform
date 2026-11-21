"""SQLAlchemy-модели таблиц ``universities`` и ``users``.

Колонки совпадают с начальной миграцией DB-01 (Issue #18) и со схемами
``University`` и ``User`` из контракта ``docs/api/openapi.yaml``.
Модели остальных таблиц (``ads``, ``forum_*``) появляются вместе со своими
модулями и их владельцами.

UUID генерируются на стороне приложения (``uuid4``) — см. ADR-004
в docs/architecture/decisions.md.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Базовый класс всех моделей приложения."""


class University(Base):
    """Вуз: справочник для профиля студента и объявлений."""

    __tablename__ = "universities"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
    )


class User(Base):
    """Пользователь-студент. Пароль хранится только как хэш с солью (ADR-007)."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(255))
    university_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("universities.id", ondelete="RESTRICT"),
        index=True,
    )
    faculty: Mapped[str | None] = mapped_column(String(255))
    course: Mapped[int | None] = mapped_column(SmallInteger())
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.current_timestamp(),
    )

    __table_args__ = (
        CheckConstraint("course IS NULL OR course BETWEEN 1 AND 6", name="ck_users_course_range"),
    )
