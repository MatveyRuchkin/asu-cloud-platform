"""Pydantic-схемы модуля auth: регистрация, вход, токен.

Повторяют схемы ``RegisterRequest``, ``LoginRequest`` и ``Token`` из контракта
``docs/api/openapi.yaml``. Ответ регистрации — схема ``User`` из модуля users.
"""

import uuid

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Тело ``POST /auth/register`` (схема ``RegisterRequest`` из контракта)."""

    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=2)
    university_id: uuid.UUID


class LoginRequest(BaseModel):
    """Тело ``POST /auth/login`` (схема ``LoginRequest`` из контракта)."""

    email: EmailStr
    password: str


class Token(BaseModel):
    """Ответ ``POST /auth/login`` (схема ``Token`` из контракта)."""

    access_token: str
    token_type: str = "bearer"
