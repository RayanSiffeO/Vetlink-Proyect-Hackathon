from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from .auth import CurrentUser, DbSession
from .db import AuditEntry, write_audit
from .models import User
from .schemas import role_value


@dataclass(frozen=True)
class ApiContext:
    user: User
    session: Session

    def audit(self, entity_type: str, entity_id: str, action: str) -> None:
        entry = AuditEntry(
            actor=self.user.username,
            role=role_value(self.user),
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
        )
        write_audit(self.session, entry)


def get_api_context(user: CurrentUser, session: DbSession) -> ApiContext:
    return ApiContext(user=user, session=session)


ApiCtx = Annotated[ApiContext, Depends(get_api_context)]
