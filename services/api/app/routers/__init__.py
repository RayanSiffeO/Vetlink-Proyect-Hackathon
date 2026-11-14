"""Routers de la API VetLink. `main` los monta bajo /api."""

from __future__ import annotations

from . import appointments, audit, auth, demo, imports, patients, requests, specialists

ALL_ROUTERS = [
    auth.me_router,
    auth.router,
    patients.router,
    imports.router,
    specialists.router,
    requests.router,
    appointments.router,
    audit.router,
    demo.router,
]

__all__ = ["ALL_ROUTERS"]
