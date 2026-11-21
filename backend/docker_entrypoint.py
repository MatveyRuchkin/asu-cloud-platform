"""Start the existing API after applying migrations to the Compose database."""

import os
import subprocess
import sys
import time

from sqlalchemy import URL, create_engine, text
from sqlalchemy.exc import OperationalError


def wait_for_database(url: URL) -> None:
    """Wait for a local or remote database; never log connection credentials."""
    engine = create_engine(url, connect_args={"connect_timeout": 3})
    try:
        for attempt in range(12):
            try:
                with engine.connect() as connection:
                    connection.execute(text("SELECT 1"))
                return
            except OperationalError:
                if attempt == 11:
                    raise SystemExit(
                        "Database unavailable. Check DB_HOST, DB_PORT, credentials and VM firewall."
                    ) from None
                time.sleep(2)
    finally:
        engine.dispose()


def main() -> None:
    """Build an escaped connection URL, migrate, then replace this process with uvicorn."""
    if len(os.environ.get("SECRET_KEY", "").encode("utf-8")) < 32:
        raise SystemExit("SECRET_KEY must contain at least 32 bytes.")
    port = int(os.environ.get("DB_PORT", "5432"))
    if not 1 <= port <= 65535:
        raise SystemExit("DB_PORT must be between 1 and 65535.")
    url = URL.create(
        "postgresql+psycopg",
        username=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        host=os.environ.get("DB_HOST", "db"),
        port=port,
        database=os.environ["POSTGRES_DB"],
    )
    os.environ["DATABASE_URL"] = url.render_as_string(hide_password=False)
    wait_for_database(url)
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], check=True)
    os.execv(
        sys.executable,
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
    )


if __name__ == "__main__":
    main()
