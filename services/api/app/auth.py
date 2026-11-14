"""Auth demo: cookie de sesión firmada con itsdangerous (sin JWT)."""

from __future__ import annotations

from typing import Annotated, Optional

from fastapi import Depends, HTTPException, Request, Response, status
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlmodel import Session, select

from .config import settings
from .db import get_session
from .models import Role, User

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
    if isinstance(data, dict):
        return data.get("uid")
    return None


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
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión no válida o expirada. Inicia sesión demo.",
        )
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario de sesión no encontrado.",
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
DbSession = Annotated[Session, Depends(get_session)]


def role_value(user: User) -> str:
    return user.role.value if isinstance(user.role, Role) else str(user.role)


def user_to_dict(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name,
        "role": role_value(user),
        "clinic_id": user.clinic_id,
        "specialty": user.specialty,
    }


def specialist_id_for_user(user: User) -> Optional[str]:
    """Convención de la demo: el especialista `marc` corresponde a `spc_marc`."""
    if role_value(user) != Role.SPECIALIST.value:
        return None
    return f"spc_{user.username}"


def is_participant(user: User, req) -> bool:
    if role_value(user) == Role.ADMIN.value:
        return True
    if role_value(user) == Role.CLINIC.value:
        return req.created_by == user.id
    if role_value(user) == Role.SPECIALIST.value:
        return req.specialist_id == specialist_id_for_user(user)
    return False
