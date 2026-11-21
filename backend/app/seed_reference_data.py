"""Explicit, repeatable setup of reference lists; never create users or ads."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import University
from app.db.session import SessionLocal
from app.modules.ads.models import AdCategory
from app.modules.forum.models import ForumSection


def seed(session: Session) -> None:
    """Add missing reference names without overwriting existing records."""
    for model, names in [
        (University, ["Учебный университет"]),
        (AdCategory, ["Учебники", "Техника", "Услуги"]),
        (ForumSection, ["Учёба", "Кампус", "Общение"]),
    ]:
        for name in names:
            if session.scalar(select(model.id).where(model.name == name)) is None:
                session.add(model(name=name))
    session.commit()


if __name__ == "__main__":
    with SessionLocal() as session:
        seed(session)
    print(
        "Справочники вузов, категорий и разделов готовы. Пользователи и объявления не создавались."
    )
