"""Start the existing API after applying migrations to the Compose database."""

import os
import subprocess
import sys

from sqlalchemy import URL


def main() -> None:
    """Build an escaped connection URL, migrate, then replace this process with uvicorn."""
    if len(os.environ.get("SECRET_KEY", "").encode("utf-8")) < 32:
        raise SystemExit("SECRET_KEY must contain at least 32 bytes.")
    os.environ["DATABASE_URL"] = URL.create(
        "postgresql+psycopg",
        username=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        host="db",
        port=5432,
        database=os.environ["POSTGRES_DB"],
    ).render_as_string(hide_password=False)
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
    os.execv(
        sys.executable,
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
    )


if __name__ == "__main__":
    main()
