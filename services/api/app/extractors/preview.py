from __future__ import annotations

from pathlib import Path

from .mapping import Column, field_for

TARGETS: tuple[tuple[str, str], ...] = (
    ("patient.name", "Paciente · nombre"),
    ("patient.microchip", "Paciente · microchip"),
    ("patient.species", "Paciente · especie"),
    ("patient.breed", "Paciente · raza"),
    ("patient.sex", "Paciente · sexo"),
    ("patient.birth_date", "Paciente · nacimiento"),
    ("patient.weight_kg", "Paciente · peso (kg)"),
    ("patient.weight_lb", "Paciente · peso (lb)"),
    ("patient.bcs", "Paciente · condición corporal"),
    ("patient.external_id", "Paciente · id externo"),
    ("owner.display_name", "Tutor · nombre"),
    ("encounter.date", "Visita · fecha"),
    ("encounter.reason", "Visita · motivo"),
    ("encounter.diagnosis", "Visita · diagnóstico"),
    ("encounter.treatment", "Visita · tratamiento"),
    ("encounter.next_visit", "Visita · próxima cita"),
    ("problem.allergy", "Alerta · alergia"),
    ("source.clinic", "Origen · clínica"),
    ("source.vet", "Origen · veterinario"),
)

TARGET_HEADERS = {
    "patient.name": "nombre",
    "patient.microchip": "microchip",
    "patient.species": "especie",
    "patient.breed": "raza",
    "patient.sex": "sexo",
    "patient.birth_date": "fecha_nacimiento",
    "patient.weight_kg": "peso_kg",
    "patient.weight_lb": "weight_lb",
    "patient.bcs": "bcs",
    "patient.external_id": "id_paciente",
    "owner.display_name": "tutor",
    "encounter.date": "fecha_visita",
    "encounter.reason": "motivo",
    "encounter.diagnosis": "diagnostico",
    "encounter.treatment": "tratamiento",
    "encounter.next_visit": "proxima_cita",
    "problem.allergy": "alergias",
    "source.clinic": "clinica",
    "source.vet": "veterinario",
}

TARGET_BY_COLUMN = {
    ("patient", "name"): "patient.name",
    ("patient", "microchip"): "patient.microchip",
    ("patient", "species"): "patient.species",
    ("patient", "breed"): "patient.breed",
    ("patient", "sex"): "patient.sex",
    ("patient", "birth_date"): "patient.birth_date",
    ("patient", "weight_kg"): "patient.weight_kg",
    ("patient", "weight_lb"): "patient.weight_lb",
    ("patient", "bcs"): "patient.bcs",
    ("patient", "external_id"): "patient.external_id",
    ("owner", "owner"): "owner.display_name",
    ("encounter", "date"): "encounter.date",
    ("encounter", "reason"): "encounter.reason",
    ("encounter", "diagnosis"): "encounter.diagnosis",
    ("encounter", "treatment"): "encounter.treatment",
    ("encounter", "next_visit"): "encounter.next_visit",
    ("problem", "allergy"): "problem.allergy",
    ("source", "clinic"): "source.clinic",
    ("source", "vet"): "source.vet",
}


def target_for(column: Column | None) -> str | None:
    if column is None:
        return None
    return TARGET_BY_COLUMN.get((column.section, column.key))


def plan(headers: list[str]) -> list[dict[str, object]]:
    columns = [field_for(header) for header in headers]
    return [
        {
            "index": index,
            "source": header,
            "target": target_for(column),
            "confidence": column.confidence if column else 0.0,
        }
        for index, (header, column) in enumerate(zip(headers, columns))
    ]


def apply_mapping(headers: list[str], mapping: dict[int, str | None]) -> list[str]:
    result = []
    for index, header in enumerate(headers):
        target = mapping[index] if index in mapping else target_for(field_for(header))
        result.append(TARGET_HEADERS.get(str(target), "__ignorar__"))
    return result


def read_table(path: Path) -> tuple[list[str], list[list[str]]]:
    extension = path.suffix.lower()
    if extension == ".csv":
        from .csv_extractor import read_table as reader
    elif extension == ".xlsx":
        from .xlsx_extractor import read_table as reader
    elif extension == ".docx":
        from .docx_extractor import read_table as reader
    else:
        raise ValueError(f"Sin vista de mapeo para {extension}")
    return reader(path)


def targets() -> list[dict[str, str]]:
    return [{"id": target, "label": label} for target, label in TARGETS]
