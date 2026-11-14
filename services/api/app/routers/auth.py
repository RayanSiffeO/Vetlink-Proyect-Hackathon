"""Autenticación demo por cookie firmada (itsdangerous)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status
from sqlmodel import select

from ..auth import (
    clear_session_cookie,
    create_session_token,
    set_session_cookie,
)
from ..models import User
from ..schemas import DemoLoginIn, user_dict
from ..auth import CurrentUser, DbSession

router = APIRouter(prefix="/auth", tags=["auth"])
# `GET /api/me` vive en la raíz (contrato v1); `GET /api/auth/me` se mantiene como alias.
me_router = APIRouter(tags=["auth"])


@router.post("/demo", summary="Login demo (laura | marc)")
def demo_login(payload: DemoLoginIn, response: Response, session: DbSession) -> dict:
    username = (payload.user or "").strip().lower()
    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Usuario demo '{payload.user}' no existe. Usa 'laura' o 'marc'.",
        )
    set_session_cookie(response, create_session_token(user.id))
    return {"user": user_dict(user)}


@router.get("/me", summary="Usuario de la sesión actual")
@me_router.get("/me", summary="Usuario de la sesión actual (/api/me)")
def me(user: CurrentUser) -> dict:
    return {"user": user_dict(user)}


@router.post("/logout", summary="Cerrar sesión demo")
def logout(response: Response) -> dict:
    clear_session_cookie(response)
    return {"status": "ok", "detail": "Sesión cerrada"}
