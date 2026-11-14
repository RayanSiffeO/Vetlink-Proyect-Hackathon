# `services/api` — API VetLink (FastAPI)

**Stack:** Python 3.12 + FastAPI + Pydantic v2 + SQLAlchemy async + PostgreSQL (Supabase).

## Estructura prevista

```
services/api/
├── app/
│   ├── main.py               # FastAPI app + routers + CORS
│   ├── config.py             # variables de entorno
│   ├── auth.py               # verificación JWT Supabase + RBAC
│   ├── extractors/           # registry de adaptadores
│   │   ├── base.py           # interfaz Extractor
│   │   ├── docx_extractor.py # python-docx (tablas + texto)
│   │   ├── xlsx_extractor.py # openpyxl (13 hojas → entidades)
│   │   ├── json_extractor.py # mapeo de esquema de API PMS
│   │   └── generic_extractor.py # LLM structured output + confianza
│   ├── canonical/            # schema, normalize, merge, alerts
│   ├── briefing/             # generador de briefing pre-visita
│   ├── routers/              # endpoints (contrato en docs/05)
│   └── seed/                 # datos demo reproducibles
├── tests/
├── Dockerfile
└── pyproject.toml
```

## Contrato API (MVP)

Ver tabla de endpoints en `docs/05-arquitectura-mvp.md` §API. OpenAPI autogenerado en `/docs` de FastAPI: **enseñarlo en el pitch** como prueba de viabilidad técnica.

## Reglas

- **El pipeline nunca devuelve error global** si puede devolver resultado parcial: `NEEDS_REVIEW` y campos problemáticos marcados.
- Cada campo extraído lleva `provenance` (`source_system`, `source_ref`, `confidence`).
- Adaptadores como registry: añadir formato = añadir módulo, no tocar el core.
- Datos demo: los 3 ficheros de `data/samples/` deben producir las fichas de `docs/01-reto-analisis.md`.
- Sin secretos en el repo; `.env.example` con las variables necesarias.
