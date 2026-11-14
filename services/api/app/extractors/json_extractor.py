from __future__ import annotations

import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from .base import ExtractResult, UnsupportedFormat
from .mapping import (
    clean,
    clean_microchip,
    parse_bcs,
    parse_date,
    parse_sex,
    parse_weight,
    slug,
    species_code,
    stable_id,
)


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


ARRAYS = (
    "encounters",
    "problems",
    "immunizations",
    "parasite_control",
    "weights",
    "reminders",
    "prescriptions",
    "invoices",
    "documents",
)


def _read(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise UnsupportedFormat(f"JSON inválido: {exc}") from exc
    if not isinstance(data, dict):
        raise UnsupportedFormat("JSON sin estructura de ficha")
    return data


def _source(data: dict[str, Any], filename: str) -> dict[str, Any]:
    meta = data.get("_meta") if isinstance(data.get("_meta"), dict) else {}
    return {
        "system": str(meta.get("source_system") or "JSON genérico"),
        "format": str(data.get("source", {}).get("format") or "JSON"),
        "file": filename,
        "generated_at": str(meta.get("generated_at") or now()),
        "version": meta.get("api_version"),
        "row_counts": {name: len(data.get(name) or []) for name in ARRAYS if isinstance(data.get(name), list)},
    }


def _picked_weight(item: dict[str, Any]) -> object:
    value = item.get("weight_kg")
    return item.get("kg") if value is None else value


def _latest_weight(weights: list[Any]) -> tuple[float | None, str | None, int | None]:
    best: tuple[tuple[str, int], float, dict[str, Any]] | None = None
    for index, item in enumerate(weights):
        if not isinstance(item, dict):
            continue
        raw = _picked_weight(item)
        if raw is None or raw == "":
            continue
        weight = parse_weight(raw, "kg")
        if weight is None:
            continue
        measured_on = parse_date(item.get("date"))
        key = (measured_on or "", index)
        if best is None or key > best[0]:
            best = (key, weight, item)
    if best is None:
        return None, None, None
    _, weight, item = best
    return weight, parse_date(item.get("date")), parse_bcs(item.get("bcs"))


def _patient(data: dict[str, Any], patient_id: str, owner_id: str | None) -> dict[str, Any]:
    source = data.get("patient")
    if not isinstance(source, dict):
        raise UnsupportedFormat("JSON sin bloque patient")
    species = source.get("species") if isinstance(source.get("species"), dict) else {}
    breed = source.get("breed") if isinstance(source.get("breed"), dict) else {}
    identifiers = source.get("identifiers") if isinstance(source.get("identifiers"), list) else []
    chip = next(
        (
            item.get("value")
            for item in identifiers
            if isinstance(item, dict) and str(item.get("type", "")).upper() == "MICROCHIP"
        ),
        None,
    )
    weights = data.get("weights") if isinstance(data.get("weights"), list) else []
    weight, weight_on, bcs = _latest_weight(weights)
    label = species.get("display") or species.get("code")
    return {
        "_type": "Patient",
        "id": patient_id,
        "external_ids": [
            {"system": "JSON", "id": value} for value in (source.get("uuid"), source.get("legacy_ref")) if value
        ],
        "name": clean(source.get("name")) or "Paciente sin nombre",
        "species_code": species_code(label),
        "species_label": label,
        "breed_label": breed.get("display") or breed.get("code"),
        "sex": parse_sex(source.get("sex")),
        "neutered": source.get("neutered"),
        "birth_date": parse_date(source.get("birth_date")),
        "coat": source.get("coat"),
        "microchip": clean_microchip(chip),
        "weight_current_kg": weight,
        "weight_current_on": weight_on,
        "bcs": bcs,
        "owner_ids": [owner_id] if owner_id else [],
        "status": source.get("status") or "ACTIVE",
        "deceased": bool(source.get("deceased", False)),
    }


def _owner(data: dict[str, Any]) -> dict[str, Any] | None:
    source = data.get("owner") if isinstance(data.get("owner"), dict) else None
    if not source:
        return None
    display = source.get("display_name") or source.get("pseudonym") or "TUTOR"
    return {
        "_type": "Owner",
        "id": source.get("id") or stable_id("own", display),
        "display_name": display,
        "address": source.get("address"),
        "phones": source.get("phones") or [],
        "emails": source.get("emails") or [],
        "is_primary": True,
        "data_classification": "PSEUDONYMIZED",
    }


def _encounter(item: dict[str, Any], patient_id: str, index: int, filename: str) -> dict[str, Any]:
    date_value = parse_date(item.get("start") or item.get("date"))
    vitals = item.get("vitals") if isinstance(item.get("vitals"), dict) else {}
    soap = item.get("soap") if isinstance(item.get("soap"), dict) else {}
    return {
        **item,
        "_type": "Encounter",
        "id": item.get("id") or stable_id("enc", f"{date_value}|{item.get('reason')}|{index}"),
        "patient_id": patient_id,
        "date": date_value,
        "vitals": vitals,
        "soap": soap,
        "_meta": {
            **(item.get("_meta") or {}),
            "source_format": "JSON",
            "source_ref": f"{filename}#/encounters/{index}",
            "method": "direct",
            "confidence": 0.9,
        },
    }


def _problem(item: dict[str, Any], patient_id: str, index: int, filename: str) -> dict[str, Any]:
    return {
        **item,
        "_type": "Problem",
        "id": item.get("id") or stable_id("prb", f"{patient_id}|{item.get('label')}|{index}"),
        "patient_id": patient_id,
        "category": item.get("category") or "PROBLEM",
        "status": item.get("status") or "ACTIVE",
        "_meta": {
            **(item.get("_meta") or {}),
            "source_format": "JSON",
            "source_ref": f"{filename}#/problem_list/{index}",
        },
    }


def _items(name: str, data: dict[str, Any], patient_id: str, filename: str) -> list[dict[str, Any]]:
    values = data.get(name) if isinstance(data.get(name), list) else []
    result = []
    for index, item in enumerate(values):
        if not isinstance(item, dict):
            continue
        payload = {
            **item,
            "patient_id": patient_id,
            "_meta": {
                **(item.get("_meta") or {}),
                "source_format": "JSON",
                "source_ref": f"{filename}#/{name}/{index}",
            },
        }
        result.append(payload)
    return result


def _provenance(canonical: dict[str, Any]) -> dict[str, Any]:
    counts = {name: len(canonical.get(name) or []) for name in ARRAYS}
    entities = 1 + sum(counts.values())
    return {
        "entities": entities,
        "fields_populated": sum(1 for value in canonical.values() if value not in (None, "", [], {})),
        "provenance": {
            "entity_coverage_pct": 100.0,
            "source_systems": ["JSON"],
            "source_refs": entities,
            "assumed_fields": 0,
        },
        "alerts": {"total": 0, "by_severity": {}},
        "rules_applied": [],
    }


def _record(data: dict[str, Any], path: Path) -> dict[str, Any]:
    raw_patient = data["patient"]
    key = str(raw_patient.get("uuid") or raw_patient.get("legacy_ref") or raw_patient.get("name") or "json")
    patient_id = stable_id("pat", key)
    owner = _owner(data)
    patient = _patient(data, patient_id, owner["id"] if owner else None)
    encounters = [
        _encounter(item, patient_id, i, path.name)
        for i, item in enumerate(data.get("encounters") or [])
        if isinstance(item, dict)
    ]
    problems = [
        _problem(item, patient_id, i, path.name)
        for i, item in enumerate(data.get("problem_list") or [])
        if isinstance(item, dict)
    ]
    canonical = {
        "schema_version": "vetlink.record/1.0",
        "record_id": data.get("record_id") or f"vlr_{slug(patient['name'])}_{key[-8:]}",
        "generated_at": now(),
        "as_of": max((item.get("date") for item in encounters if item.get("date")), default=date.today().isoformat()),
        "source": _source(data, path.name),
        "privacy": data.get("privacy")
        or {"classification": "PSEUDONYMIZED", "pii_present": False, "masked_fields": []},
        "identity": data.get("identity")
        or {"match_key": key, "identity_confidence": 0.7, "status": "PSEUDONYMIZED", "basis": ["json"], "notes": None},
        "patient": patient,
        "owners": [owner] if owner else [],
        "encounters": encounters,
        "problems": problems,
        "immunizations": _items("immunizations", data, patient_id, path.name),
        "parasite_control": _items("parasite_control", data, patient_id, path.name),
        "weights": _items("weights", data, patient_id, path.name),
        "reminders": _items("reminders", data, patient_id, path.name),
        "prescriptions": _items("prescriptions", data, patient_id, path.name),
        "invoices": _items("invoices", data, patient_id, path.name),
        "documents": _items("documents", data, patient_id, path.name),
        "alerts": [],
        "briefing": {},
        "review": data.get("review")
        or {"policy": "JSON estructurado; revisar campos críticos.", "critical_fields": [], "pending_review": 0},
        "fhir_profile": data.get("fhir_profile"),
    }
    canonical["provenance_summary"] = _provenance(canonical)
    return canonical


def extract(path: Path) -> ExtractResult:
    data = _read(path)
    if data.get("schema_version") == "vetlink.record/1.0" and isinstance(data.get("patient"), dict):
        return ExtractResult(record=data, warnings=["JSON ya canónico; no se ha transformado."], needs_review=False)
    record = _record(data, path)
    warnings = ["JSON genérico: campos no presentes se dejan vacíos; revisar identidad y campos críticos."]
    return ExtractResult(record=record, warnings=warnings, needs_review=True)
