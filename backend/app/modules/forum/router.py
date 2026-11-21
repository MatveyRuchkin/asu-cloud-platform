"""Read the real sections and topics defined in the API contract."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_session
from app.modules.forum import models, schemas

router = APIRouter(tags=["forum"])


@router.get("/forum/sections", response_model=list[schemas.ForumSection])
def sections(session: Session = Depends(get_session)) -> list[models.ForumSection]:
    """List persisted sections."""
    return list(session.scalars(select(models.ForumSection).order_by(models.ForumSection.name)))


@router.get("/forum/topics", response_model=list[schemas.ForumTopic])
def topics(
    section_id: uuid.UUID | None = None,
    session: Session = Depends(get_session),
) -> list[models.ForumTopic]:
    """List persisted topics, optionally by section."""
    query = select(models.ForumTopic)
    if section_id is not None:
        query = query.where(models.ForumTopic.section_id == section_id)
    return list(session.scalars(query.order_by(models.ForumTopic.id)))
