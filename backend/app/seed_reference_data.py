"""Explicit, repeatable setup of reference lists; never create users or ads."""

import os

from sqlalchemy import URL, select
from sqlalchemy.orm import Session

from app.db.models import University
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


def main() -> None:
    """Docker exec gets Compose variables, not the API process's generated URL."""
    if not os.environ.get("DATABASE_URL") and os.environ.get("POSTGRES_PASSWORD"):
        os.environ["DATABASE_URL"] = URL.create(
            "postgresql+psycopg",
            username=os.environ["POSTGRES_USER"],
            password=os.environ["POSTGRES_PASSWORD"],
            host=os.environ.get("DB_HOST", "db"),
            port=int(os.environ.get("DB_PORT", "5432")),
            database=os.environ["POSTGRES_DB"],
        ).render_as_string(hide_password=False)
    # The session must be imported only after the URL has been configured.
    from app.db.session import SessionLocal

    with SessionLocal() as session:
        seed(session)
    print("Справочники готовы. Пользователи и объявления не создавались.")


if __name__ == "__main__":
    main()
