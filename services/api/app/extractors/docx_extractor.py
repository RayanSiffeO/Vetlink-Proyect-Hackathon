from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from docx import Document
from docx.opc.exceptions import PackageNotFoundError

from .base import ExtractResult, UnsupportedFormat
from .canonical_csv import build_record
from .mapping import clean, normalize_header, parse_date, parse_weight

LABELS = {
    "nombre": "name",
    "nombre_y_apellidos": "owner",
    "especie": "species",
    "raza": "breed",
    "sexo": "sex",
    "fecha_de_nacimiento": "birth_date",
    "fecha_de_alta": "birth_date",
    "n_de_microchip": "microchip",
    "n_microchip": "microchip",
    "n_o_de_microchip": "microchip",
    "no_de_microchip": "microchip",
    "nro_de_microchip": "microchip",
    "numero_de_microchip": "microchip",
    "peso_actual": "weight_kg",
    "condicion_corporal": "bcs",
    "alergias_conocidas": "allergy",
    "clinica": "clinic",
    "veterinaria_de_referencia": "vet",
}
VISIT_LABELS = (
    ("fecha", "date"),
    ("motivo", "reason"),
    ("exploracion", "diagnosis"),
    ("actuacion", "treatment"),
    ("tratamiento", "treatment"),
    ("proxima", "next_visit"),
)
OWNER_LABELS = {"nombre_y_apellidos", "tutor", "propietario"}
HEADER_HINTS = {"fecha", "motivo", "exploracion", "actuacion", "tratamiento", "proxima"}
VISIT_WEIGHT = re.compile(r"\bpeso\b\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(kg|kilos?|lb|libras?)?", re.IGNORECASE)


def _rows(table) -> list[list[str]]:
    return [[clean(cell.text) for cell in row.cells] for row in table.rows]


def _pairs(rows: list[list[str]]) -> dict[str, str]:
    pairs: dict[str, str] = {}
    for row in rows:
        for index in range(0, len(row) - 1, 2):
            label = normalize_header(row[index])
            value = row[index + 1]
            if label and value:
                pairs[label] = value
    return pairs


def _patient(data: dict[str, str], rows: list[list[str]]) -> dict[str, str]:
    pairs = _pairs(rows)
    for label, value in pairs.items():
        key = LABELS.get(label)
        if key:
            data[key] = value
    return data


def _is_visit_table(rows: list[list[str]]) -> bool:
    headers = {normalize_header(cell) for cell in rows[0]} if rows else set()
    return len(headers & HEADER_HINTS) >= 2


def _visit_key(header: str) -> str | None:
    normalized = normalize_header(header)
    if normalized in LABELS:
        return LABELS[normalized]
    for hint, key in VISIT_LABELS:
        if hint in normalized:
            return key
    return None


def _visits(rows: list[list[str]]) -> list[dict[str, str]]:
    headers = rows[0]
    keys = [_visit_key(header) for header in headers]
    visits = []
    for row in rows[1:]:
        values = {key: row[index] for index, key in enumerate(keys) if key and index < len(row) and row[index]}
        if values:
            visits.append(values)
    return visits


def _allergy(document, data: dict[str, str]) -> str | None:
    if data.get("allergy"):
        return data["allergy"]
    for paragraph in document.paragraphs:
        text = clean(paragraph.text)
        if re.search(r"alerg|adverse|reacci", text, re.IGNORECASE):
            return text
    return None


def _document(path: Path):
    try:
        return Document(path)
    except (PackageNotFoundError, OSError, ValueError) as exc:
        raise UnsupportedFormat(f"Word inválido: {exc}") from exc


def _read(path: Path) -> tuple[dict[str, str], list[dict[str, str]], int]:
    document = _document(path)
    patient: dict[str, str] = {}
    visits: list[dict[str, str]] = []
    ignored = 0
    for table in document.tables:
        rows = _rows(table)
        if _is_visit_table(rows):
            visits.extend(_visits(rows))
            continue
        patient = _patient(patient, rows)
        if not _pairs(rows):
            ignored += 1
    allergy = _allergy(document, patient)
    patient["allergy"] = allergy or ""
    if not patient.get("name"):
        raise UnsupportedFormat("Word sin tabla de paciente reconocible")
    return patient, visits, ignored


def _table_rows(patient: dict[str, str], visits: list[dict[str, str]]) -> tuple[list[str], list[list[str]]]:
    headers = list(dict.fromkeys([*patient.keys(), "date", "reason", "diagnosis", "treatment", "next_visit"]))
    source = visits or [{}]
    rows = [[{**patient, **visit}.get(header, "") for header in headers] for visit in source]
    return headers, rows


def read_table(path: Path) -> tuple[list[str], list[list[str]]]:
    patient, visits, _ = _read(path)
    return _table_rows(patient, visits)


def _visit_weight(visit: dict[str, str]) -> float | None:
    text = " ".join(visit.get(key) or "" for key in ("reason", "diagnosis", "treatment"))
    match = VISIT_WEIGHT.search(text)
    if match is None:
        return None
    unit = "lb" if (match.group(2) or "").casefold().startswith("lb") else "kg"
    return parse_weight(match.group(1), unit)


def _apply_visit_weights(record: dict[str, Any], visits: list[dict[str, str]]) -> None:
    weights_by_date: dict[str, float] = {}
    for visit in visits:
        visit_date = parse_date(visit.get("date"))
        weight = _visit_weight(visit)
        if visit_date is not None and weight is not None:
            weights_by_date[visit_date] = weight

    for encounter in record.get("encounters") or []:
        vitals = encounter.setdefault("vitals", {})
        weight = weights_by_date.get(str(encounter.get("date")))
        if weight is None:
            vitals.pop("weight_kg", None)
        else:
            vitals["weight_kg"] = weight

    kept_weights = []
    for item in record.get("weights") or []:
        weight = weights_by_date.get(str(item.get("date")))
        if weight is None:
            continue
        item["weight_kg"] = weight
        kept_weights.append(item)
    record["weights"] = kept_weights


def extract(path: Path) -> ExtractResult:
    patient, visits, ignored = _read(path)
    headers, rows = _table_rows(patient, visits)
    record, warnings = build_record(headers, rows, path.name)
    _apply_visit_weights(record, visits)
    record["source"]["system"] = "Word genérico"
    record["source"]["format"] = "DOCX"
    warnings = ["Word genérico: tablas + texto de alertas; revisar identidad, dosis y alergias.", *warnings]
    if ignored:
        warnings.append(f"Tablas sin campos reconocidos: {ignored}.")
    return ExtractResult(record=record, warnings=warnings, needs_review=True)

