from __future__ import annotations

import csv
import io
from pathlib import Path

from .base import ExtractResult, UnsupportedFormat
from .canonical_csv import build_record

DELIMITERS = (";", ",", "\t", "|")
MIN_COLUMNS = 2
HEURISTIC_WARNING = "CSV genérico: mapeo heurístico; revisar identidad, alergias y campos críticos."


def _decode(path: Path) -> str:
    data = path.read_bytes()
    if b"\x00" in data[:4096]:
        raise UnsupportedFormat("el CSV parece binario")
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("latin-1")


def _delimiter(text: str) -> str | None:
    sample = [line for line in text.splitlines() if line.strip()][:25]
    if not sample:
        return None
    for candidate in DELIMITERS:
        rows = list(csv.reader(io.StringIO("\n".join(sample)), delimiter=candidate))
        widths = {len(row) for row in rows}
        if len(widths) == 1 and widths.pop() >= MIN_COLUMNS:
            return candidate
    return None


def _table(text: str, delimiter: str) -> tuple[list[str], list[list[str]]]:
    rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    if not rows:
        raise UnsupportedFormat("CSV vacío")
    headers = [header.strip() for header in rows[0]]
    data = [row for row in rows[1:] if any(cell.strip() for cell in row)]
    if not data:
        raise UnsupportedFormat("CSV sin filas de datos")
    return headers, data


def extract(path: Path) -> ExtractResult:
    text = _decode(path)
    delimiter = _delimiter(text)
    if delimiter is None:
        raise UnsupportedFormat("no se pudo detectar el delimitador del CSV")
    headers, rows = _table(text, delimiter)
    record, warnings = build_record(headers, rows, path.name)
    messages = [HEURISTIC_WARNING, *warnings]
    return ExtractResult(record=record, warnings=messages, needs_review=True)
