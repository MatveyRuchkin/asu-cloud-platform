"""Единый формат ошибок API.

Формат ответа об ошибке зафиксирован в контракте (`docs/api/openapi.yaml`, схема `Error`):
`{"code": "...", "message": "...", "details": {...}}`. Клиент ориентируется на `code`
и показывает пользователю `message`.
"""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

HTTP_ERROR_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
    500: "internal_error",
}


class ApiError(Exception):
    """Ожидаемая ошибка приложения с понятным клиенту кодом и сообщением."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def error_payload(
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Собирает тело ответа об ошибке по схеме `Error` из контракта."""
    payload: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        payload["details"] = details
    return payload


def error_code_for(status_code: int) -> str:
    """Возвращает короткий код ошибки по HTTP-статусу."""
    return HTTP_ERROR_CODES.get(status_code, "error")


def register_error_handlers(app: FastAPI) -> None:
    """Подключает обработчики ошибок к приложению."""

    @app.exception_handler(ApiError)
    async def handle_api_error(_request: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(
        _request: Request,
        exc: StarletteHTTPException,
    ) -> JSONResponse:
        details = exc.detail if isinstance(exc.detail, dict) else None
        message = exc.detail if isinstance(exc.detail, str) else "Ошибка запроса"
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(error_code_for(exc.status_code), message, details),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=error_payload(
                "validation_error",
                "Некорректные данные запроса",
                {"errors": jsonable_encoder(exc.errors())},
            ),
        )
