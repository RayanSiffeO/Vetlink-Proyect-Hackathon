"""Configuración de la API VetLink (demo local, sin secretos en repo)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# services/api/app/config.py -> parents[3] == raíz del repositorio
REPO_ROOT = Path(__file__).resolve().parents[3]

API_TITLE = "VetLink API"
API_VERSION = "0.1.0-h0"


@dataclass(frozen=True)
class Settings:
    """Rutas y parámetros de la demo. Todo relativo a la raíz del repo."""

    repo_root: Path = field(default_factory=lambda: REPO_ROOT)
    data_dir: Path = field(default_factory=lambda: REPO_ROOT / "data")
    docs_dir: Path = field(default_factory=lambda: REPO_ROOT / "docs")
    samples_dir: Path = field(default_factory=lambda: REPO_ROOT / "data" / "samples")
    canonical_dir: Path = field(default_factory=lambda: REPO_ROOT / "docs" / "ejemplos")
    web_dist: Path = field(default_factory=lambda: REPO_ROOT / "apps" / "web" / "dist")

    db_filename: str = "vetlink.db"
    secret_key: str = os.environ.get("VETLINK_SECRET_KEY", "vetlink-demo-dev-secret")
    session_cookie: str = "session"
    session_max_age: int = 60 * 60 * 12  # 12 h de demo
    allowed_origins: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")
    api_prefix: str = "/api"

    @property
    def db_path(self) -> Path:
        return self.data_dir / self.db_filename

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.db_path}"

    @property
    def uploads_dir(self) -> Path:
        return self.data_dir / "uploads"


settings = Settings()
