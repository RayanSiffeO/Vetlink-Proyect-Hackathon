from __future__ import annotations

from typing import TypeVar

from fastapi import HTTPException, status

T = TypeVar("T")

BAD_REQUEST = status.HTTP_400_BAD_REQUEST
UNAUTHORIZED = status.HTTP_401_UNAUTHORIZED
FORBIDDEN = status.HTTP_403_FORBIDDEN
NOT_FOUND = status.HTTP_404_NOT_FOUND
CONFLICT = status.HTTP_409_CONFLICT
UNPROCESSABLE = 422


def require_found(value: T | None, detail: str, status_code: int = NOT_FOUND) -> T:
    if value is None:
        raise HTTPException(status_code=status_code, detail=detail)
    return value


def ensure(condition: bool, detail: str, status_code: int = FORBIDDEN) -> None:
    if not condition:
        raise HTTPException(status_code=status_code, detail=detail)
