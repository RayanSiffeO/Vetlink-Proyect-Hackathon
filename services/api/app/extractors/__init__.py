from __future__ import annotations

from .base import ExtractFn
from .csv_extractor import extract as extract_csv
from .docx_extractor import extract as extract_docx
from .json_extractor import extract as extract_json
from .xlsx_extractor import extract as extract_xlsx

EXTRACTORS: dict[str, ExtractFn] = {}


def _normalize(extension: str) -> str:
    key = str(extension or "").strip().lower()
    if not key:
        return ""
    return key if key.startswith(".") else f".{key}"


def register(extension: str, extractor: ExtractFn) -> None:
    EXTRACTORS[_normalize(extension)] = extractor


def get_extractor(extension: str) -> ExtractFn | None:
    return EXTRACTORS.get(_normalize(extension))


register(".csv", extract_csv)
register(".json", extract_json)
register(".xlsx", extract_xlsx)
register(".docx", extract_docx)
