"""The real Alembic environment must load and compile the PostgreSQL migration."""

import os
import subprocess
import sys
from pathlib import Path


def test_initial_migration_compiles_with_real_logging_configuration() -> None:
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head", "--sql"],
        cwd=Path(__file__).resolve().parents[1],
        env={**os.environ, "DATABASE_URL": "postgresql+psycopg://unused@localhost/unused"},
        capture_output=True,
        text=True,
        check=True,
    )
    assert "CREATE TABLE universities" in result.stdout
    assert "CREATE TABLE forum_replies" in result.stdout
