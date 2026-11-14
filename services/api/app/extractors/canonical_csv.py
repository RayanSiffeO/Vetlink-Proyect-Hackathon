from __future__ import annotations

import hashlib
from datetime import date, datetime, timezone
from typing import Any

from .base import UnsupportedFormat
from .mapping import (
    clean,
    group_rows,
    is_negative_allergy,
    map_headers,
    parse_date,
    parse_sex,
    parse_weight,
    slug,
    species_code,
    stable_id,
)


def _weight_of(data: dict[str, str]) -> tuple[float | None, str | None]:
    kilograms = parse_weight(data.get("weight_kg"), "kg") if data.get("weight_kg") else None
    pounds = parse_weight(data.get("weight_lb"), "lb") if data.get("weight_lb") else None
    return kilograms or pounds, "kg" if kilograms is not None else ("lb" if pounds is not None else None)


def _patient(data: dict[str, str], patient_id: str, owner_id: str | None) -> dict[str, Any]:
    weight, _ = _weight_of(data)
    species_label = data.get("species")
    return {
        "_type": "Patient",
        "id": patient_id,
        "external_ids": [{"system": "CSV", "id": data["external_id"]}] if data.get("external_id") else [],
        "name": data.get("name") or "Paciente sin nombre",
        "species_code": species_code(species_label),
        "species_label": species_label,
        "breed_label": data.get("breed"),
        "sex": parse_sex(data.get("sex")),
        "birth_date": parse_date(data.get("birth_date")),
        "microchip": data.get("microchip"),
        "weight_current_kg": weight,
        "bcs": data.get("bcs"),
        "owner_ids": [owner_id] if owner_id else [],
        "status": "ACTIVE",
        "deceased": False,
    }


def _owner(data: dict[str, str]) -> dict[str, Any] | None:
    display = data.get("owner")
    if not display:
        return None
    return {
        "_type": "Owner",
        "id": stable_id("own", display),
        "display_name": display,
        "is_primary": True,
        "data_classification": "PSEUDONYMIZED",
        "_meta": {"source_format": "CSV", "method": "direct", "confidence": 0.9},
    }


def _encounter(index: int, data: dict[str, str], patient_id: str, filename: str) -> dict[str, Any] | None:
    visit_date = parse_date(data.get("date"))
    reason = data.get("reason")
    diagnosis = data.get("diagnosis")
    treatment = data.get("treatment")
    weight, _ = _weight_of(data)
    next_visit = parse_date(data.get("next_visit"))
    if not any((visit_date, reason, diagnosis, treatment, weight)):
        return None
    ref = f"{filename}#/row/{index + 1}"
    return {
        "_type": "Encounter",
        "id": stable_id("enc", f"{visit_date}|{reason}|{index}"),
        "patient_id": patient_id,
        "date": visit_date,
        "reason": reason or None,
        "type": "VISIT",
        "status": "SIGNED",
        "vitals": {"weight_kg": weight} if weight is not None else {},
        "soap": {"s": None, "o": None, "a": diagnosis or None, "p": treatment or None},
        "diagnosis_summary": diagnosis or None,
        "next_visit_date": next_visit,
        "_meta": {
            "source_system": "CSV",
            "source_format": "CSV",
            "source_ref": ref,
            "method": "heuristic",
            "confidence": 0.8,
        },
    }


def _problem(data: dict[str, str], patient_id: str, index: int) -> dict[str, Any] | None:
    value = clean(data.get("allergy"))
    if not value or is_negative_allergy(value):
        return None
    return {
        "_type": "Problem",
        "id": stable_id("prb", f"{patient_id}|{value}|{index}"),
        "patient_id": patient_id,
        "label": value,
        "category": "ALLERGY",
        "status": "ACTIVE",
        "certainty": "REPORTED",
        "severity": "MODERATE",
        "notes": value,
        "_meta": {
            "source_format": "CSV",
            "method": "heuristic",
            "confidence": 0.85,
            "source_ref": f"row/{index + 1}",
        },
    }


def _problems(rows: list[tuple[int, dict[str, str]]], patient_id: str) -> list[dict[str, Any]]:
    found: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, data in rows:
        problem = _problem(data, patient_id, index)
        if problem is None or problem["label"].casefold() in seen:
            continue
        seen.add(problem["label"].casefold())
        found.append(problem)
    return found


def _weights(rows: list[tuple[int, dict[str, str]]], patient_id: str) -> list[dict[str, Any]]:
    values: list[dict[str, Any]] = []
    for _, data in rows:
        weight, _ = _weight_of(data)
        if weight is None:
            continue
        values.append({"patient_id": patient_id, "date": parse_date(data.get("date")), "weight_kg": weight})
    return values


def _latest_weight(rows: list[tuple[int, dict[str, str]]]) -> tuple[float | None, str | None]:
    dated: list[tuple[str, float]] = []
    for _, data in rows:
        weight, _ = _weight_of(data)
        if weight is None:
            continue
        dated.append((parse_date(data.get("date")) or "", weight))
    if not dated:
        return None, None
    latest = max(dated, key=lambda item: item[0])
    return latest[1], latest[0] or None


def _canonical_patient(
    data: dict[str, str], patient_id: str, owner_id: str | None, rows: list[tuple[int, dict[str, str]]]
) -> dict[str, Any]:
    patient = _patient(data, patient_id, owner_id)
    patient["weight_current_kg"], patient["weight_current_on"] = _latest_weight(rows)
    return patient


def _source(data: dict[str, str], filename: str, encounters: int, problems: int) -> dict[str, Any]:
    return {
        "system": "CSV genérico",
        "format": "CSV",
        "file": filename,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "row_counts": {"encounters": encounters, "problems": problems},
        "clinic": data.get("clinic"),
        "vet": data.get("vet"),
    }


def _provenance(entities: int, fields_populated: int) -> dict[str, Any]:
    return {
        "entities": entities,
        "fields_populated": fields_populated,
        "provenance": {
            "entity_coverage_pct": 100.0,
            "source_systems": ["CSV genérico"],
            "source_refs": entities,
            "field_level_entries": fields_populated,
            "assumed_fields": 0,
        },
        "alerts": {"total": 0, "by_severity": {}},
        "rules_applied": [],
    }


def _count_fields(patient: dict, owners: list, encounters: list, problems: list, weights: list) -> int:
    entities = [patient, *owners, *encounters, *problems, *weights]
    return sum(1 for entity in entities for value in entity.values() if value not in (None, "", [], {}))


def _identity(data: dict[str, str], key: str) -> dict[str, Any]:
    confidence = 0.9 if data.get("microchip") else 0.5
    return {
        "match_key": key,
        "identity_confidence": confidence,
        "status": "PSEUDONYMIZED",
        "basis": [name for name in ("name", "microchip", "owner") if data.get(name)],
        "notes": "Mapeo heurístico desde CSV; revisar identidad antes de compartir.",
    }


def build_record(headers: list[str], rows: list[list[str]], filename: str) -> tuple[dict[str, Any], list[str]]:
    columns, unknown = map_headers(headers)
    if not any(column and column.section in {"patient", "encounter", "problem"} for column in columns):
        raise UnsupportedFormat("CSV sin columnas clínicas reconocidas")
    groups, warnings = group_rows(rows, columns)
    if not groups:
        raise UnsupportedFormat("CSV sin filas de paciente")
    key, group = next(iter(groups.items()))
    data = group["data"]
    patient_rows = group["rows"]
    patient_id = stable_id("pat", key)
    owner = _owner(data)
    owner_id = owner["id"] if owner else None
    patient = _canonical_patient(data, patient_id, owner_id, patient_rows)
    encounters = [item for index, row in patient_rows if (item := _encounter(index, row, patient_id, filename))]
    problems = _problems(patient_rows, patient_id)
    weights = _weights(patient_rows, patient_id)
    owners = [owner] if owner else []
    dates = [item["date"] for item in encounters if item.get("date")]
    as_of = max(dates) if dates else date.today().isoformat()
    record_id = f"vlr_{slug(patient['name'])}_{hashlib.sha1(key.encode('utf-8')).hexdigest()[:8]}"
    entities = 1 + len(owners) + len(encounters) + len(problems) + len(weights)
    fields = _count_fields(patient, owners, encounters, problems, weights)
    record = {
        "schema_version": "vetlink.record/1.0",
        "record_id": record_id,
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "as_of": as_of,
        "source": _source(data, filename, len(encounters), len(problems)),
        "privacy": {
            "classification": "PSEUDONYMIZED",
            "pii_present": False,
            "masked_fields": [],
            "note": "Datos de demo; el tutor se conserva solo como identificador de visualización.",
        },
        "identity": _identity(data, key),
        "patient": patient,
        "owners": owners,
        "encounters": encounters,
        "problems": problems,
        "immunizations": [],
        "parasite_control": [],
        "weights": weights,
        "reminders": [],
        "prescriptions": [],
        "invoices": [],
        "documents": [],
        "alerts": [],
        "briefing": {},
        "provenance_summary": _provenance(entities, fields),
        "review": {
            "policy": "Mapeo heurístico de CSV; revisar identidad, alergias y campos críticos.",
            "critical_fields": [],
            "pending_review": 0,
            "reviewed_by": None,
        },
        "fhir_profile": None,
    }
    warnings = [*unknown, *warnings]
    if unknown:
        warnings.append(f"Columnas no reconocidas: {', '.join(unknown)}.")
    return record, warnings
