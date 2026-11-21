"""Request and response fields follow the shared OpenAPI contract."""

import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class AdCategory(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


class AdCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    category_id: uuid.UUID
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=1)
    price_rub: int | None = Field(default=None, ge=0, le=2147483647, strict=True)
    image_url: HttpUrl | None = Field(default=None, max_length=2048)


class Ad(AdCreate):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author_id: uuid.UUID
    university_id: uuid.UUID
    status: Literal["active", "closed"]
