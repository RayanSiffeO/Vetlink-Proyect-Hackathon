from __future__ import annotations

from pathlib import Path
from typing import Any

from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException

from .base import ExtractResult, UnsupportedFormat
from .canonical_csv import build_record
from .mapping import clean, field_for, is_negative_allergy, normalize_header, parse_date, parse_weight

PATIENT_KEYS = {
    "name",
    "microchip",
    "species",
    "breed",
    "sex",
    "birth_date",
    "bcs",
    "weight_kg",
    "weight_lb",
    "external_id",
}
OWNER_KEYS = {"owner"}
VISIT_KEYS = {"date", "reason", "diagnosis", "treatment", "next_visit"}
WEIGHT_KEYS = {"weight_kg", "weight_lb"}
ALLERGY_HINTS = ("alerg", "problem")
TEXT_HINTS = ("descripcion", "detalle", "texto")


def _table(worksheet) -> tuple[list[str], list[list[str]]] | None:
    rows = [[clean(cell.value) for cell in row] for row in worksheet.iter_rows()]
    rows = [row for row in rows if any(row)]
    if len(rows) < 2:
        return None
    headers = rows[0]
    if sum(bool(header) for header in headers) < 2:
        return None
    return headers, rows[1:]


def _mapped_row(headers: list[str], row: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    for index, header in enumerate(headers):
        field = field_for(header)
        if field is None or index >= len(row) or not row[index]:
            continue
        result[field.key] = row[index]
    return result


def _is_allergy_sheet(worksheet, headers: list[str]) -> bool:
    title = normalize_header(worksheet.title)
    has_hint = any(hint in title for hint in ALLERGY_HINTS)
    has_text = any(normalize_header(header) in TEXT_HINTS for header in headers)
    return has_hint and has_text


def _allergy_value(headers: list[str], row: list[str]) -> str | None:
    for index, header in enumerate(headers):
        if normalize_header(header) not in TEXT_HINTS or index >= len(row):
            continue
        if row[index]:
            return row[index]
    return None


def _patient_from(rows: list[list[str]], headers: list[str]) -> dict[str, str]:
    for row in rows:
        mapped = _mapped_row(headers, row)
        if mapped.get("name") or mapped.get("microchip"):
            return {key: value for key, value in mapped.items() if key in PATIENT_KEYS | OWNER_KEYS}
    return {}


def _visits_from(rows: list[list[str]], headers: list[str]) -> list[dict[str, str]]:
    visits = []
    for row in rows:
        mapped = _mapped_row(headers, row)
        if not any(key in mapped for key in ("reason", "diagnosis", "treatment", "next_visit")):
            continue
        visits.append({key: value for key, value in mapped.items() if key in VISIT_KEYS | WEIGHT_KEYS})
    return visits


def _weights_from(rows: list[list[str]], headers: list[str]) -> tuple[float | None, str | None]:
    for row in rows:
        mapped = _mapped_row(headers, row)
        weight = (
            parse_weight(mapped.get("weight_kg"), "kg")
            if mapped.get("weight_kg")
            else parse_weight(mapped.get("weight_lb"), "lb")
        )
        if weight is not None:
            return weight, parse_date(mapped.get("date"))
    return None, None


def _workbook_tables(path: Path) -> list[tuple[Any, list[str], list[list[str]]]]:
    try:
        workbook = load_workbook(path, data_only=True, read_only=True)
    except (InvalidFileException, OSError, ValueError) as exc:
        raise UnsupportedFormat(f"Excel inválido: {exc}") from exc
    tables = []
    for worksheet in workbook.worksheets:
        table = _table(worksheet)
        if table is not None:
            tables.append((worksheet, table[0], table[1]))
    workbook.close()
    return tables


def _collect(
    tables: list[tuple[Any, list[str], list[list[str]]]],
) -> tuple[dict[str, str], list[str], list[dict[str, str]], float | None, list[str]]:
    patient: dict[str, str] = {}
    allergies: list[str] = []
    visits: list[dict[str, str]] = []
    weight: float | None = None
    ignored: list[str] = []
    for worksheet, headers, rows in tables:
        patient.update({key: value for key, value in _patient_from(rows, headers).items() if not patient.get(key)})
        visits.extend(_visits_from(rows, headers))
        if _is_allergy_sheet(worksheet, headers):
            values = [value for row in rows if (value := _allergy_value(headers, row))]
            allergies.extend(value for value in values if not is_negative_allergy(value))
        if weight is None:
            weight, _ = _weights_from(rows, headers)
        if not any(field_for(header) for header in headers):
            ignored.append(worksheet.title)
    return patient, allergies, visits, weight, ignored


def _rows_for(
    patient: dict[str, str], allergies: list[str], visits: list[dict[str, str]]
) -> tuple[list[str], list[list[str]]]:
    headers = list(dict.fromkeys([*patient.keys(), "allergy", *VISIT_KEYS]))
    allergy = allergies[0] if allergies else ""
    source = visits or [{}]
    rows = [[{**patient, "allergy": allergy, **visit}.get(header, "") for header in headers] for visit in source]
    return headers, rows


def read_table(path: Path) -> tuple[list[str], list[list[str]]]:
    tables = _workbook_tables(path)
    if not tables:
        raise UnsupportedFormat("Excel sin tablas legibles")
    patient, allergies, visits, weight, _ = _collect(tables)
    if not patient:
        raise UnsupportedFormat("Excel sin datos de paciente reconocibles")
    patient = {key: value for key, value in patient.items() if value}
    if weight is not None:
        patient["weight_kg"] = str(weight)
    return _rows_for(patient, allergies, visits)


def extract(path: Path) -> ExtractResult:
    tables = _workbook_tables(path)
    if not tables:
        raise UnsupportedFormat("Excel sin tablas legibles")
    headers, rows = read_table(path)
    record, warnings = build_record(headers, rows, path.name)
    record["source"]["system"] = "Excel genérico"
    record["source"]["format"] = "XLSX"
    record["source"]["sheets"] = [worksheet.title for worksheet, _, _ in tables]
    warnings = ["Excel genérico: se importa la primera tabla clínica reconocida.", *warnings]
    return ExtractResult(record=record, warnings=warnings, needs_review=True)
