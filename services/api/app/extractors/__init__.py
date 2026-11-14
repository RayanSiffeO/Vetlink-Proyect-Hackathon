from __future__ import annotations

from .base import ExtractFn
from .csv_extractor import extract as extract_csv

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
