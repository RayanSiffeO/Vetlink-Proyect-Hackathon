"""Importación de ficheros del PMS con cache por sha256 (demo instantánea)."""

from __future__ import annotations

import hashlib
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlmodel import select

from ..auth import CurrentUser, DbSession, role_value
from ..config import settings
from ..db import log_audit
from ..models import ImportJob, ImportStatus, utcnow
from ..schemas import import_job_dict
from ..seed import NEEDS_REVIEW_MESSAGE, build_import_cache

router = APIRouter(prefix="/imports", tags=["imports"])

READY_MESSAGE = "Ficha reconocida en la cache de importación"


def _safe_name(filename: str) -> str:
    cleaned = re.sub(r"[^0-9A-Za-zÀ-ÿ._-]+", "_", filename or "upload.bin")
    return cleaned.strip("._") or "upload.bin"


def _write_upload(data: bytes, filename: str) -> Path:
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    dest = settings.uploads_dir / f"{uuid.uuid4().hex[:8]}_{_safe_name(filename)}"
    dest.write_bytes(data)
    return dest


@router.post("", summary="Subir 1..N ficheros del PMS")
def upload_files(
    user: CurrentUser,
    session: DbSession,
    files: list[UploadFile] = File(..., description="Ficheros del PMS (docx, xlsx, json, csv)"),
) -> dict:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envía al menos un fichero")

    cache = build_import_cache()
    created: list[ImportJob] = []
    results: list[dict] = []

    for upload in files:
        data = upload.file.read()
        filename = upload.filename or "upload.bin"
        sha = hashlib.sha256(data).hexdigest()
        record_id = cache.get(sha)

        job = ImportJob(
            id=f"imp_{uuid.uuid4().hex[:10]}",
            filename=filename,
            status=ImportStatus.READY if record_id else ImportStatus.NEEDS_REVIEW,
            sha256=sha,
            record_id=record_id,
            message=READY_MESSAGE if record_id else NEEDS_REVIEW_MESSAGE,
            created_at=utcnow(),
        )
        _write_upload(data, filename)
        session.add(job)
        session.commit()
        session.refresh(job)

        log_audit(
            session,
            actor=user.username,
            role=role_value(user),
            entity_type="ImportJob",
            entity_id=job.id,
            action="IMPORT_FILE",
        )
        created.append(job)
        results.append(import_job_dict(job))

    ready = sum(1 for job in created if job.status == ImportStatus.READY)
    review = len(created) - ready
    return {
        "job_id": created[0].id,
        "files": results,
        "summary": {"total": len(created), "ready": ready, "needs_review": review},
    }


@router.get("/{job_id}", summary="Estado de una importación")
def get_import(job_id: str, user: CurrentUser, session: DbSession) -> dict:
    job = session.get(ImportJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Importación no encontrada")
    return {"job_id": job.id, "files": [import_job_dict(job)]}


@router.get("", summary="Historial de importaciones")
def list_imports(user: CurrentUser, session: DbSession) -> dict:
    jobs = list(session.exec(select(ImportJob).order_by(ImportJob.created_at.desc()).limit(50)).all())
    return {"files": [import_job_dict(j) for j in jobs], "count": len(jobs)}
