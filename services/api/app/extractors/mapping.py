from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass
from datetime import date
from typing import Any


@dataclass(frozen=True)
class Column:
    key: str
    section: str
    confidence: float = 0.95


ALIASES: dict[str, Column] = {
    "microchip": Column("microchip", "patient"),
    "chip": Column("microchip", "patient"),
    "numero_microchip": Column("microchip", "patient"),
    "nombre": Column("name", "patient"),
    "name": Column("name", "patient"),
    "nombre_paciente": Column("name", "patient"),
    "nombre_completo": Column("name", "patient"),
    "paciente": Column("name", "patient"),
    "mascota": Column("name", "patient"),
    "animal": Column("name", "patient"),
    "especie": Column("species", "patient"),
    "species": Column("species", "patient"),
    "raza": Column("breed", "patient"),
    "breed": Column("breed", "patient"),
    "sexo": Column("sex", "patient"),
    "sex": Column("sex", "patient"),
    "genero": Column("sex", "patient"),
    "fecha_nacimiento": Column("birth_date", "patient"),
    "nacimiento": Column("birth_date", "patient"),
    "birth_date": Column("birth_date", "patient"),
    "dob": Column("birth_date", "patient"),
    "bcs": Column("bcs", "patient"),
    "condicion_corporal": Column("bcs", "patient"),
    "peso_kg": Column("weight_kg", "patient"),
    "weight_kg": Column("weight_kg", "patient"),
    "peso": Column("weight_kg", "patient"),
    "weight": Column("weight_kg", "patient"),
    "peso_lb": Column("weight_lb", "patient"),
    "peso_libras": Column("weight_lb", "patient"),
    "weight_lb": Column("weight_lb", "patient"),
    "id_paciente": Column("external_id", "patient"),
    "patient_id": Column("external_id", "patient"),
    "id_mascota": Column("external_id", "patient"),
    "tutor": Column("owner", "owner"),
    "propietario": Column("owner", "owner"),
    "owner": Column("owner", "owner"),
    "owner_name": Column("owner", "owner"),
    "cliente": Column("owner", "owner"),
    "clinica": Column("clinic", "source"),
    "clinic": Column("clinic", "source"),
    "centro": Column("clinic", "source"),
    "veterinario": Column("vet", "source"),
    "vet": Column("vet", "source"),
    "fecha_visita": Column("date", "encounter"),
    "fecha_consulta": Column("date", "encounter"),
    "visit_date": Column("date", "encounter"),
    "fecha": Column("date", "encounter"),
    "date": Column("date", "encounter"),
    "motivo": Column("reason", "encounter"),
    "motivo_consulta": Column("reason", "encounter"),
    "reason": Column("reason", "encounter"),
    "consulta": Column("reason", "encounter"),
    "diagnostico": Column("diagnosis", "encounter"),
    "diagnosis": Column("diagnosis", "encounter"),
    "tratamiento": Column("treatment", "encounter"),
    "treatment": Column("treatment", "encounter"),
    "pauta": Column("treatment", "encounter"),
    "proxima_cita": Column("next_visit", "encounter"),
    "next_visit": Column("next_visit", "encounter"),
    "alergias": Column("allergy", "problem"),
    "alergia": Column("allergy", "problem"),
    "allergies": Column("allergy", "problem"),
    "allergy": Column("allergy", "problem"),
}

HEURISTICS: tuple[tuple[str, Column, float], ...] = (
    (r"^(nombre|name)(_completo)?$", Column("name", "patient"), 0.85),
    (r"^(peso|weight)(_lb|lbs)$", Column("weight_lb", "patient"), 0.85),
    (r"^(peso|weight)(_kg|kgs)?$", Column("weight_kg", "patient"), 0.85),
    (r"^(fecha|date)(_visita|_consulta|_visit)?$", Column("date", "encounter"), 0.8),
    (r"^(motivo|reason|consulta)", Column("reason", "encounter"), 0.8),
    (r"^(diagnostico|diagnosis)", Column("diagnosis", "encounter"), 0.8),
    (r"^(tratamiento|treatment|pauta)", Column("treatment", "encounter"), 0.8),
    (r"^(alergia|allerg)", Column("allergy", "problem"), 0.85),
    (r"^(tutor|owner|propietario|cliente)", Column("owner", "owner"), 0.8),
    (r"^(microchip|chip)", Column("microchip", "patient"), 0.85),
    (r"^(especie|species)", Column("species", "patient"), 0.8),
    (r"^(raza|breed)", Column("breed", "patient"), 0.8),
)

NEGATIVE_ALLERGY = re.compile(
    r"^(ninguna|ninguno|no|sin|none|nkda|no conocida|no conocidas|no refiere)",
    re.IGNORECASE,
)
SPECIES_CODES = (("can", "CAN"), ("perro", "CAN"), ("fel", "FEL"), ("gato", "FEL"))


def normalize_header(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = text.encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", text).strip("_")


def field_for(header: object) -> Column | None:
    key = normalize_header(header)
    if not key:
        return None
    exact = ALIASES.get(key)
    if exact:
        return exact
    for pattern, column, confidence in HEURISTICS:
        if re.search(pattern, key):
            return Column(column.key, column.section, confidence)
    return None


def map_headers(headers: list[str]) -> tuple[list[Column | None], list[str]]:
    columns = [field_for(header) for header in headers]
    unknown = [header for header, column in zip(headers, columns) if column is None and str(header).strip()]
    return columns, unknown


def clean(value: object) -> str:
    return "" if value is None else str(value).strip()


def parse_date(value: object) -> str | None:
    text = clean(value)
    if not text:
        return None
    for pattern in (r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})", r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})"):
        match = re.match(pattern, text)
        if not match:
            continue
        parts = [int(part) for part in match.groups()]
        year, month, day = parts if len(parts[0].__str__()) == 4 else (parts[2], parts[1], parts[0])
        if year < 100:
            year += 2000 if year <= 30 else 1900
        try:
            return date(year, month, day).isoformat()
        except ValueError:
            return None
    return None


def parse_sex(value: object) -> str | None:
    text = clean(value).casefold()
    if not text:
        return None
    if re.search(r"hembra|female|\bfem|\bf$", text):
        return "FEMALE"
    if re.search(r"macho|male|\bmasc|\bm$", text):
        return "MALE"
    return None


def parse_weight(value: object, unit: str) -> float | None:
    text = clean(value).replace(",", ".")
    match = re.match(r"(-?\d+(?:\.\d+)?)", text)
    if not match:
        return None
    number = float(match.group(1))
    if unit == "lb":
        return round(number * 0.45359237, 2)
    if "g" in text.casefold() and "kg" not in text.casefold():
        return round(number / 1000, 3)
    return round(number, 2)


def species_code(value: object) -> str | None:
    text = clean(value).casefold()
    for hint, code in SPECIES_CODES:
        if hint in text:
            return code
    return None


def slug(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", "_", clean(value).casefold()).strip("_") or "paciente"


def stable_id(prefix: str, value: object) -> str:
    digest = hashlib.sha1(clean(value).encode("utf-8")).hexdigest()[:8]
    return f"{prefix}_{digest}"


def is_negative_allergy(value: object) -> bool:
    return bool(NEGATIVE_ALLERGY.search(clean(value)))


def _row_data(row: list[str], columns: list[Column | None]) -> dict[str, str]:
    data: dict[str, str] = {}
    for index, column in enumerate(columns):
        if column is None:
            continue
        value = clean(row[index]) if index < len(row) else ""
        if value:
            data[column.key] = value
    return data


def _patient_key(data: dict[str, str], index: int) -> str:
    return data.get("microchip") or data.get("name", "").casefold() or data.get("external_id") or f"fila_{index}"


def group_rows(
    rows: list[list[str]], columns: list[Column | None]
) -> tuple[dict[str, dict[str, Any]], list[str]]:
    groups: dict[str, dict[str, Any]] = {}
    warnings: list[str] = []
    for index, row in enumerate(rows):
        data = _row_data(row, columns)
        if not data:
            continue
        key = _patient_key(data, index)
        group = groups.setdefault(key, {"rows": [], "data": {}})
        group["rows"].append((index, data))
        group["data"].update({key: value for key, value in data.items() if value})
    if len(groups) > 1:
        warnings.append("El CSV contiene varios pacientes; se importa el primero.")
    return groups, warnings
