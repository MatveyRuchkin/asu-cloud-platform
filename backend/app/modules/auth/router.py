"""Маршруты модуля auth: ``POST /auth/register`` и ``POST /auth/login``.

Пути, тела и ответы — по контракту ``docs/api/openapi.yaml``. Ошибки валидации
отдаются как 400 (у регистрации в контракте описан только 400, и сценарии
QA-02 ждут 400), а не стандартные 422 каркаса: перехватчик ниже переводит их
внутри этого модуля, не меняя общий код приложения.
"""

from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.db.session import get_session
from app.modules.auth.schemas import LoginRequest, RegisterRequest, Token
from app.modules.auth.service import AuthService
from app.modules.users.schemas import User


class ValidationAs400Route(APIRoute):
    """Обёртка маршрута: ошибки валидации Pydantic → 400 с телом ``Error``."""

    def get_route_handler(self):
        original = super().get_route_handler()

        async def validation_as_400(request):
            try:
                return await original(request)
            except RequestValidationError as exc:
                raise ApiError(
                    status_code=400,
                    code="validation_error",
                    message="Некорректные данные запроса",
                    details={"errors": jsonable_encoder(exc.errors())},
                ) from exc

        return validation_as_400


router = APIRouter(route_class=ValidationAs400Route, tags=["auth"])


@router.post(
    "/auth/register",
    response_model=User,
    status_code=201,
    summary="Регистрация",
)
async def register(
    data: RegisterRequest,
    session: Session = Depends(get_session),
) -> User:
    """Создаёт пользователя.

    400 — неверные поля, неизвестный вуз или занятый email.
    """
    return AuthService(session).register(data)


@router.post(
    "/auth/login",
    response_model=Token,
    summary="Вход",
)
async def login(
    data: LoginRequest,
    session: Session = Depends(get_session),
) -> Token:
    """Выдаёт токен доступа. 401 — неверный email или пароль."""
    return AuthService(session).login(data)
