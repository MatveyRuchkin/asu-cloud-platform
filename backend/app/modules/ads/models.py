"""Models for existing DB-01 tables. No schema migration is needed."""

import uuid

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.models import Base


class AdCategory(Base):
    __tablename__ = "ad_categories"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True)


class Ad(Base):
    __tablename__ = "ads"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    university_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("universities.id"))
    category_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("ad_categories.id"))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text())
    price_rub: Mapped[int | None] = mapped_column(Integer())
    image_url: Mapped[str | None] = mapped_column(String(2048))
    status: Mapped[str] = mapped_column(String(20), default="active")
