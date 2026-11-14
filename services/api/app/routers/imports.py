from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, UploadFile
from sqlmodel import select

from ..config import settings
from ..context import ApiContext, ApiCtx
from ..errors import BAD_REQUEST, ensure, require_found
from ..extractors import get_extractor
from ..extractors.base import ExtractResult, UnsupportedFormat
from ..ingestion import ingest_canonical
from ..models import ImportJob, ImportStatus, utcnow
from ..schemas import import_job_dict
from ..seed import NEEDS_REVIEW_MESSAGE, READY_MESSAGE, build_import_cache, sha256_of

router = APIRouter(prefix="/imports", tags=["imports"])

EXTRACTION_REVIEW_MESSAGE = "Extracción marcada para revisión manual"
UNSUPPORTED_FORMAT_MESSAGE = "Formato no soportado por los extractores; revisión manual"
FAILED_MESSAGE = "No se pudo procesar el fichero"


def _safe_name(filename: str) -> str:
    cleaned = re.sub(r"[^0-9A-Za-zÀ-ÿ._-]+", "_", filename or "upload.bin")
    return cleaned.strip("._") or "upload.bin"


def _write_upload(data: bytes, filename: str) -> Path:
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    dest = settings.uploads_dir / f"{uuid.uuid4().hex[:8]}_{_safe_name(filename)}"
    dest.write_bytes(data)
    return dest


def _new_job(filename: str, sha256: str) -> ImportJob:
    return ImportJob(
        id=f"imp_{uuid.uuid4().hex[:10]}",
        filename=filename,
        status=ImportStatus.NEEDS_REVIEW,
        sha256=sha256,
        created_at=utcnow(),
    )


def _cached_job(filename: str, digest: str, record_id: str) -> ImportJob:
    job = _new_job(filename, digest)
    job.status = ImportStatus.READY
    job.record_id = record_id
    job.message = READY_MESSAGE
    return job


def _review_job(filename: str, digest: str, message: str) -> ImportJob:
    job = _new_job(filename, digest)
    job.message = message
    return job


def _failed_job(filename: str, digest: str, message: str) -> ImportJob:
    job = _review_job(filename, digest, message)
    job.status = ImportStatus.FAILED
    return job


def _store(ctx: ApiContext, job: ImportJob) -> ImportJob:
    ctx.session.add(job)
    ctx.session.commit()
    ctx.session.refresh(job)
    ctx.audit("ImportJob", job.id, "IMPORT_FILE")
    return job


def _unsupported_message(exc: UnsupportedFormat) -> str:
    detail = str(exc).strip()
    return f"{UNSUPPORTED_FORMAT_MESSAGE} ({detail})" if detail else UNSUPPORTED_FORMAT_MESSAGE


def _review_message(base: str | None, warnings: list[str]) -> str:
    detail = "; ".join(warning.strip() for warning in warnings if warning and warning.strip())
    return " · ".join(part for part in (EXTRACTION_REVIEW_MESSAGE, base or "", detail) if part)


def _apply_extraction_flags(ctx: ApiContext, job: ImportJob, result: ExtractResult) -> ImportJob:
    if not (result.needs_review or result.warnings):
        return job
    job.status = ImportStatus.NEEDS_REVIEW
    job.message = _review_message(job.message, result.warnings)
    ctx.session.add(job)
    ctx.session.commit()
    ctx.session.refresh(job)
    return job


def _process_upload(ctx: ApiContext, upload: UploadFile, cache: dict[str, str]) -> ImportJob:
    data = upload.file.read()
    filename = upload.filename or "upload.bin"
    path = _write_upload(data, filename)
    digest = sha256_of(path)
    record_id = cache.get(digest)
    if record_id is not None:
        return _store(ctx, _cached_job(filename, digest, record_id))
    extractor = get_extractor(path.suffix)
    if extractor is None:
        return _store(ctx, _review_job(filename, digest, NEEDS_REVIEW_MESSAGE))
    try:
        result = extractor(path)
        job = ingest_canonical(ctx, result.record, filename, digest)
    except UnsupportedFormat as exc:
        ctx.session.rollback()
        return _store(ctx, _review_job(filename, digest, _unsupported_message(exc)))
    except Exception as exc:
        ctx.session.rollback()
        return _store(ctx, _failed_job(filename, digest, f"{FAILED_MESSAGE}: {exc}"))
    return _apply_extraction_flags(ctx, job, result)


def _summary(jobs: list[ImportJob]) -> dict[str, int]:
    ready = sum(1 for job in jobs if job.status == ImportStatus.READY)
    review = sum(1 for job in jobs if job.status == ImportStatus.NEEDS_REVIEW)
    return {"total": len(jobs), "ready": ready, "needs_review": review, "failed": len(jobs) - ready - review}


@router.post("", summary="Subir 1..N ficheros del PMS")
def upload_files(
    ctx: ApiCtx,
    files: list[UploadFile] = File(..., description="Ficheros del PMS (docx, xlsx, json, csv)"),
) -> dict:
    ensure(bool(files), "Envía al menos un fichero", BAD_REQUEST)
    cache = build_import_cache()
    jobs = [_process_upload(ctx, upload, cache) for upload in files]
    return {
        "job_id": jobs[0].id,
        "files": [import_job_dict(job) for job in jobs],
        "summary": _summary(jobs),
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
