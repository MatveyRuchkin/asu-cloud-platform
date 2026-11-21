"""Forum responses from the existing OpenAPI contract."""

import uuid

from pydantic import BaseModel, ConfigDict


class ForumSection(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None = None


class ForumTopic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    section_id: uuid.UUID
    title: str
    author_id: uuid.UUID
