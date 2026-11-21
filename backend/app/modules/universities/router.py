"""Маршрут модуля universities: ``GET /universities``.

Публичный список вузов — нужен форме регистрации (FE-02) и фильтрам
объявлений. Путь и ответ — по контракту ``docs/api/openapi.yaml``.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import University as UniversityModel
from app.db.session import get_session
from app.modules.universities.schemas import University

router = APIRouter(tags=["universities"])


@router.get(
    "/universities",
    response_model=list[University],
    summary="Список университетов",
)
async def list_universities(session: Session = Depends(get_session)) -> list[University]:
    """Все вузы справочника. Пустой список — ``[]``, не ``null`` (ADR-006)."""
    universities = session.scalars(select(UniversityModel).order_by(UniversityModel.name))
    return [University.model_validate(university) for university in universities]
