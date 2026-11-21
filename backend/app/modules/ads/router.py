"""Read and create real ads in the existing PostgreSQL tables."""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import CurrentUser
from app.core.errors import ApiError
from app.db.session import get_session
from app.modules.ads import models, schemas

router = APIRouter(tags=["ads"])


@router.get("/ad-categories", response_model=list[schemas.AdCategory])
def categories(session: Session = Depends(get_session)) -> list[models.AdCategory]:
    """Return persisted category UUIDs for the ad form."""
    return list(session.scalars(select(models.AdCategory).order_by(models.AdCategory.name)))


@router.get("/ads", response_model=list[schemas.Ad])
def list_ads(
    category_id: uuid.UUID | None = None,
    university_id: uuid.UUID | None = None,
    session: Session = Depends(get_session),
) -> list[models.Ad]:
    """List ads, with the optional filters already defined in OpenAPI."""
    query = select(models.Ad)
    if category_id is not None:
        query = query.where(models.Ad.category_id == category_id)
    if university_id is not None:
        query = query.where(models.Ad.university_id == university_id)
    return list(session.scalars(query.order_by(models.Ad.id)))


@router.post("/ads", response_model=schemas.Ad, status_code=201)
def create_ad(
    data: schemas.AdCreate,
    current_user: CurrentUser,
    session: Session = Depends(get_session),
) -> models.Ad:
    """Derive author and university from the authenticated user, never the request."""
    if session.get(models.AdCategory, data.category_id) is None:
        raise ApiError(400, "category_not_found", "Выбранная категория не найдена")
    ad = models.Ad(
        category_id=data.category_id,
        title=data.title,
        description=data.description,
        price_rub=data.price_rub,
        image_url=str(data.image_url) if data.image_url is not None else None,
        author_id=current_user.id,
        university_id=current_user.university_id,
    )
    session.add(ad)
    try:
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise ApiError(400, "invalid_reference", "Данные изменились. Обновите страницу.") from error
    session.refresh(ad)
    return ad
