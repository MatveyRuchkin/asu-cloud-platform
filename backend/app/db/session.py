"""Подключение к базе данных: движок и сессии.

Владельцы каталога: BE-01 (подключение и сессии) и DB-01 (модели и миграции Alembic).
Строка подключения читается из настроек: переменная DATABASE_URL в ``.env``
(пример — ``.env.example``). Движок создаётся лениво: импорт модуля не открывает
соединение, подключение происходит при первом реальном запросе.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_session() -> Generator[Session, None, None]:
    """Раздаёт сессию базы данных запросам FastAPI и гарантированно закрывает её.

    Используется как зависимость FastAPI: ``Depends(get_session)``.
    """
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
