from __future__ import annotations

import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, UploadFile
from sqlmodel import select

from ..config import settings
from ..context import ApiContext, ApiCtx
from ..db import dumps_json, loads_json
from ..errors import BAD_REQUEST, UNPROCESSABLE, ensure, require_found
from ..extractors import get_extractor
from ..extractors.base import ExtractResult, UnsupportedFormat
from ..extractors.canonical_csv import build_record
from ..extractors.preview import apply_mapping, plan, read_table, targets
from ..ingestion import ingest_canonical, persist_canonical
from ..models import ImportDraft, ImportJob, ImportStatus, Record, Role, utcnow
from ..schemas import MappingConfirmIn, import_job_dict, role_value
from ..seed import NEEDS_REVIEW_MESSAGE, READY_MESSAGE, build_import_cache, sha256_of

router = APIRouter(prefix="/imports", tags=["imports"])

EXTRACTION_REVIEW_MESSAGE = "Extracción marcada para revisión manual"
UNSUPPORTED_FORMAT_MESSAGE = "Formato no soportado por los extractores; revisión manual"
FAILED_MESSAGE = "No se pudo procesar el fichero"
MAPPING_CONFIRMED_MESSAGE = "Mapeo confirmado por la clínica"
MAPPING_READY_DETAIL = "Mapeo disponible para revisión"


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


def _save_draft(ctx: ApiContext, job: ImportJob, path: Path) -> None:
    try:
        headers, rows = read_table(path)
    except (UnsupportedFormat, ValueError, OSError):
        return
    draft = ImportDraft(
        job_id=job.id,
        format=path.suffix.lower().lstrip("."),
        headers_json=dumps_json(headers),
        rows_json=dumps_json(rows),
        mapping_json=dumps_json(plan(headers)),
    )
    ctx.session.add(draft)
    ctx.session.commit()


def _file_payload(ctx: ApiContext, job: ImportJob) -> dict:
    data = import_job_dict(job)
    data["mapping_available"] = ctx.session.get(ImportDraft, job.id) is not None
    return data


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
    job = _apply_extraction_flags(ctx, job, result)
    _save_draft(ctx, job, path)
    return job


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
        "files": [_file_payload(ctx, job) for job in jobs],
        "summary": _summary(jobs),
    }


def _draft_payload(draft: ImportDraft) -> dict:
    headers = loads_json(draft.headers_json, [])
    rows = loads_json(draft.rows_json, [])
    return {
        "job_id": draft.job_id,
        "format": draft.format,
        "rows_count": len(rows),
        "columns": plan(headers),
        "targets": targets(),
        "mapping_available": True,
    }


@router.get("/{job_id}", summary="Estado de una importación")
def get_import(job_id: str, ctx: ApiCtx) -> dict:
    job = require_found(ctx.session.get(ImportJob, job_id), "Importación no encontrada")
    return {"job_id": job.id, "files": [_file_payload(ctx, job)]}


@router.get("/{job_id}/mapping", summary="Mapeo propuesto para una importación")
def get_mapping(job_id: str, ctx: ApiCtx) -> dict:
    ensure(role_value(ctx.user) == Role.CLINIC.value, "Solo la clínica puede revisar el mapeo")
    require_found(ctx.session.get(ImportJob, job_id), "Importación no encontrada")
    draft = require_found(ctx.session.get(ImportDraft, job_id), "Esta importación no tiene mapeo editable")
    return _draft_payload(draft)


@router.post("/{job_id}/mapping", summary="Confirmar o corregir el mapeo de columnas")
def confirm_mapping(job_id: str, payload: MappingConfirmIn, ctx: ApiCtx) -> dict:
    ensure(role_value(ctx.user) == Role.CLINIC.value, "Solo la clínica puede confirmar el mapeo")
    job = require_found(ctx.session.get(ImportJob, job_id), "Importación no encontrada")
    draft = require_found(ctx.session.get(ImportDraft, job_id), "Esta importación no tiene mapeo editable")
    headers = loads_json(draft.headers_json, [])
    rows = loads_json(draft.rows_json, [])
    mapping = {item.index: item.target for item in payload.mapping}
    mapped_headers = apply_mapping(headers, mapping)
    try:
        record, _ = build_record(mapped_headers, rows, job.filename)
    except (UnsupportedFormat, ValueError, KeyError) as exc:
        ensure(False, f"No se pudo aplicar el mapeo: {exc}", UNPROCESSABLE)
    existing = ctx.session.get(Record, job.record_id) if job.record_id else None
    outcome = persist_canonical(ctx, record, existing.patient_id if existing else None)
    job.status = ImportStatus.READY
    job.record_id = outcome.record.id
    job.message = MAPPING_CONFIRMED_MESSAGE
    draft.mapping_json = dumps_json(plan(mapped_headers))
    ctx.session.add(job)
    ctx.session.add(draft)
    ctx.session.commit()
    ctx.session.refresh(job)
    return {"job": _file_payload(ctx, job), "mapping": _draft_payload(draft)}


@router.get("", summary="Historial de importaciones")
def list_imports(ctx: ApiCtx) -> dict:
    statement = select(ImportJob).order_by(ImportJob.created_at.desc()).limit(50)
    jobs = list(ctx.session.exec(statement).all())
    return {"files": [_file_payload(ctx, job) for job in jobs], "count": len(jobs)}