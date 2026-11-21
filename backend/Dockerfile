FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY pyproject.toml README.md ./
COPY app ./app
RUN pip install . && useradd --create-home --uid 10001 appuser

COPY alembic.ini docker_entrypoint.py ./
COPY migrations ./migrations
USER appuser
EXPOSE 8000
CMD ["python", "docker_entrypoint.py"]
