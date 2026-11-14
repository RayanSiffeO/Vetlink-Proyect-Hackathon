from __future__ import annotations

import hashlib
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, UploadFile
from sqlmodel import select

from ..config import settings
from ..context import ApiContext, ApiCtx
from ..errors import BAD_REQUEST, ensure, require_found
from ..models import ImportJob, ImportStatus, utcnow
from ..schemas import import_job_dict
from ..seed import NEEDS_REVIEW_MESSAGE, READY_MESSAGE, build_import_cache

router = APIRouter(prefix="/imports", tags=["imports"])


def _safe_name(filename: str) -> str:
    cleaned = re.sub(r"[^0-9A-Za-zÀ-ÿ._-]+", "_", filename or "upload.bin")
    return cleaned.strip("._") or "upload.bin"


def _write_upload(data: bytes, filename: str) -> Path:
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    dest = settings.uploads_dir / f"{uuid.uuid4().hex[:8]}_{_safe_name(filename)}"
    dest.write_bytes(data)
    return dest


def _import_job(filename: str, data: bytes, cache: dict[str, str]) -> ImportJob:
    digest = hashlib.sha256(data).hexdigest()
    record_id = cache.get(digest)
    return ImportJob(
        id=f"imp_{uuid.uuid4().hex[:10]}",
        filename=filename,
        status=ImportStatus.READY if record_id else ImportStatus.NEEDS_REVIEW,
        sha256=digest,
        record_id=record_id,
        message=READY_MESSAGE if record_id else NEEDS_REVIEW_MESSAGE,
        created_at=utcnow(),
    )


def _register_upload(ctx: ApiContext, upload: UploadFile, cache: dict[str, str]) -> ImportJob:
    data = upload.file.read()
    filename = upload.filename or "upload.bin"
    _write_upload(data, filename)
    job = _import_job(filename, data, cache)
    ctx.session.add(job)
    ctx.session.commit()
    ctx.session.refresh(job)
    ctx.audit("ImportJob", job.id, "IMPORT_FILE")
    return job


@router.post("", summary="Subir 1..N ficheros del PMS")
def upload_files(
    ctx: ApiCtx,
    files: list[UploadFile] = File(..., description="Ficheros del PMS (docx, xlsx, json, csv)"),
) -> dict:
    ensure(bool(files), "Envía al menos un fichero", BAD_REQUEST)
    cache = build_import_cache()
    jobs = [_register_upload(ctx, upload, cache) for upload in files]
    ready = sum(1 for job in jobs if job.status == ImportStatus.READY)
    return {
        "job_id": jobs[0].id,
        "files": [import_job_dict(job) for job in jobs],
        "summary": {"total": len(jobs), "ready": ready, "needs_review": len(jobs) - ready},
    }


@router.get("/{job_id}", summary="Estado de una importación")
def get_import(job_id: str, ctx: ApiCtx) -> dict:
    job = require_found(ctx.session.get(ImportJob, job_id), "Importación no encontrada")
    return {"job_id": job.id, "files": [import_job_dict(job)]}


@router.get("", summary="Historial de importaciones")
def list_imports(ctx: ApiCtx) -> dict:
    statement = select(ImportJob).order_by(ImportJob.created_at.desc()).limit(50)
    jobs = list(ctx.session.exec(statement).all())
    return {"files": [import_job_dict(job) for job in jobs], "count": len(jobs)}
