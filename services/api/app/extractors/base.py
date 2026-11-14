from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable


class UnsupportedFormat(Exception):
    pass


@dataclass
class ExtractResult:
    record: dict
    warnings: list[str] = field(default_factory=list)
    needs_review: bool = False


ExtractFn = Callable[[Path], ExtractResult]
