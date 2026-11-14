from __future__ import annotations

from typing import Annotated, Optional

from fastapi import Depends, Request, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlmodel import Session, select

from .config import settings
from .db import get_session
from .errors import UNAUTHORIZED, ensure, require_found
from .models import Request as RequestModel
from .models import Role, User
from .schemas import role_value

_serializer = URLSafeTimedSerializer(settings.secret_key, salt="vetlink-session")

COOKIE_NAME = settings.session_cookie


def create_session_token(user_id: str) -> str:
    return _serializer.dumps({"uid": user_id})


def read_session_token(token: Optional[str]) -> Optional[str]:
    if not token:
        return None
    try:
        data = _serializer.loads(token, max_age=settings.session_max_age)
    except (BadSignature, SignatureExpired):
        return None
    return data.get("uid") if isinstance(data, dict) else None


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=settings.session_max_age,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")


def get_current_user(
    request: Request,
    session: Annotated[Session, Depends(get_session)],
) -> User:
    user_id = read_session_token(request.cookies.get(COOKIE_NAME))
    ensure(user_id is not None, "Sesión no válida o expirada. Inicia sesión demo.", UNAUTHORIZED)
    user = session.get(User, user_id)
    return require_found(user, "Usuario de sesión no encontrado.", UNAUTHORIZED)


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_session)]


def specialist_id_for_user(user: User) -> Optional[str]:
    if role_value(user) != Role.SPECIALIST.value:
        return None
    return f"spc_{user.username}"


def is_participant(user: User, req: RequestModel) -> bool:
    role = role_value(user)
    if role == Role.ADMIN.value:
        return True
    if role == Role.CLINIC.value:
        return req.created_by == user.id
    if role == Role.SPECIALIST.value:
        return req.specialist_id == specialist_id_for_user(user)
    return False


def request_scope(user: User):
    role = role_value(user)
    if role == Role.CLINIC.value:
        return select(RequestModel).where(RequestModel.created_by == user.id)
    if role == Role.SPECIALIST.value:
        return select(RequestModel).where(RequestModel.specialist_id == specialist_id_for_user(user))
    return select(RequestModel)
