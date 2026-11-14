# VetLink · Salud animal, a un clic

> **Reto 3 — "Menos papeleo, más cuidado: los datos al servicio de la clínica"**  
> VIII Hackathon Boehringer Ingelheim España · 13–15 de noviembre de 2026 · Equipo **Joniha**

VetLink convierte el papeleo veterinario en **una historia clínica única y compartible**, conecta a la clínica generalista con el **especialista** que necesita y genera un **briefing pre-visita** para que el especialista vea al paciente antes de verlo.

## El problema

Laura es veterinaria generalista: no puede tener especialistas en plantilla y no sabe quién trabaja en su zona, qué ofrece, cuánto cuesta ni cuándo puede venir. Marc es especialista ambulante: cada clínica usa un software distinto y la historia del paciente le llega como Word, Excel, JSON o texto libre, incompleta y desordenada. Los primeros minutos de cada visita los dedica a reconstruir el caso. **La información existe, pero no llega a tiempo.**

## La solución: tres pilares

| Pilar | Qué hace |
|---|---|
| **VetRecord** | Ingesta Word/Excel/JSON → registro canónico con provenance, alertas y revisión humana |
| **VetNetwork** | Marketplace de especialistas: especialidad, zona, disponibilidad, tarifas, solicitud y agenda |
| **VetBriefing** | Briefing pre-visita generado del registro canónico, con niveles de acceso a datos |

## Estado del proyecto

| Área | Estado |
|---|---|
| Documentación (contexto, reto, datos, debate, flujos, arquitectura) | ✅ |
| Diagramas navegables (`docs/diagramas/`) | ✅ 4 HTML validados |
| Datos de ejemplo (3 pacientes, 3 formatos + CSV de robustez) | ✅ |
| Modelo canónico + reglas de normalización | ✅ 3 registros JSON canónicos validados (1.785 campos, 22 alertas con evidencia) |
| Aplicación (React + FastAPI + SQLite) | ✅ **MVP C' funcional**: 5 pantallas (9 rutas), login demo, seed, import cache, ficha con alertas, marketplace, solicitud, briefing con niveles de acceso, agenda y auditoría. Backend limpio (`ruff` 0, `pytest` 5/5) y contrato de 23 endpoints congelado |
| Estado de la demo | ✅ SPA compilada y servida por FastAPI en un solo proceso (`:8000`); seed/reset verificado; pasada E2E de navegador y vídeo de 3 min planificados para el cierre (D-07) |
| Build de CP2 (congelada) | ✅ `releases/cp2/` con SPA + hashes (`build-info.json`) y tag local `cp2-build`; se presenta con `scripts\serve-cp2.ps1` |
| Tests E2E | ✅ API **27/27** (`scripts\e2e-api.ps1`) · navegador Edge headless **10/10** con capturas (`scripts\e2e-browser.ps1`); reportes en `releases/cp2/e2e/` |
| Entrega final | 🟡 Pendiente de cierre: E2E en navegador, vídeo, README final y paquete local. GitHub congelado por indicación del equipo |

## Documentación

| Documento | Contenido |
|---|---|
| [`PLAYBOOK.md`](PLAYBOOK.md) | Plan maestro: contexto, debate, alcance, estructura y ritmo de trabajo |
| [`docs/00-contexto-hackathon.md`](docs/00-contexto-hackathon.md) | La hackathon, reglas de entrega, estado y deadline |
| [`docs/01-reto-analisis.md`](docs/01-reto-analisis.md) | El reto entendido: requisitos, personas, datos y criterios de éxito |
| [`docs/02-modelo-datos.md`](docs/02-modelo-datos.md) | Modelo canónico "VetLink Record" y mapeo de los 3 formatos |
| [`docs/03-debate-diseno.md`](docs/03-debate-diseno.md) | Debate de producto, riesgos y objeciones del jurado |
| [`docs/04-flujos-usuarios.md`](docs/04-flujos-usuarios.md) | Flujos de usuario y de uso de la aplicación (pantalla a pantalla) |
| [`docs/05-arquitectura-mvp.md`](docs/05-arquitectura-mvp.md) | Arquitectura, pipeline, contrato de API, seguridad y despliegue |
| [`docs/06-investigacion-mercado.md`](docs/06-investigacion-mercado.md) | Mercado, estándares, competencia y encaje con Boehringer |
| [`docs/checkpoints/`](docs/checkpoints/README.md) | Paquete de los 3 checkpoints oficiales: organización, propuesta de solución y demo |
| [`docs/decisiones.md`](docs/decisiones.md) | Registro de decisiones del equipo (plan vivo y coordinado) |
| [`docs/extractores-integracion.md`](docs/extractores-integracion.md) | Encargo R1: interfaz de extractores, mapeo por formato, tests y gate para backend/data |
| `docs/diagramas/` | Flujos y arquitectura en HTML navegable |

## Diagramas navegables

| Diagrama | Qué muestra |
|---|---|
| [Flujo de usuarios](docs/diagramas/flujo-usuarios.html) | Viaje completo Laura → VetLink → Marc, con ramas |
| [Flujo de uso de la app](docs/diagramas/flujo-uso-app.html) | Recorrido pantalla a pantalla (guion de demo) |
| [Arquitectura de componentes](docs/diagramas/arquitectura-vetlink.html) | Componentes, fronteras y plano de datos |
| [Secuencia importación → briefing](docs/diagramas/secuencia-importacion-briefing.html) | Pipeline técnico y aceptación |

> HTML autocontenido: se abre en el navegador sin servidor. Generados con Archify; los recibos de validación están junto a cada fichero. Ver [`docs/diagramas/README.md`](docs/diagramas/README.md).

## Estructura del repositorio

```
Joniha/
├── README.md              # este documento
├── PLAYBOOK.md            # plan de trabajo y ritmo
├── docs/                  # contexto, reto, datos, debate, flujos, arquitectura
│   ├── diagramas/         # diagramas HTML navegables
│   └── ejemplos/          # registros canónicos JSON de ejemplo
├── apps/web/              # frontend React + Vite + TS + DaisyUI (5 pantallas; build en dist/)
├── services/api/          # API FastAPI + SQLModel + SQLite (23 endpoints, seed y contrato v1)
├── data/samples/          # los 3 ficheros de ejemplo del reto + CSV de robustez
├── data/vetlink.db        # SQLite de la demo (gitignored; se genera al arrancar)
└── scripts/               # demo:reset y utilidades
```

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + **DaisyUI** + TanStack Query + react-dropzone.
- **Backend:** FastAPI (Python 3.12) + Pydantic v2 + **SQLModel**.
- **Datos:** **SQLite** en archivo (`data/vetlink.db`) + documentos en disco local. *Postgres-ready*: migrar es cambiar la URL de conexión.
- **Demo:** **un solo proceso** — FastAPI sirve la SPA compilada y la API (`/api`), sin CORS ni servicios externos.
- **IA:** extracción estructurada con validación de esquema y provenance; en la demo, extractores deterministas (sin LLM). El veterinario confirma.

## Cómo arrancar (H+0)

> En este equipo **`pnpm` no está en el PATH** (está dentro del runtime de DSH) pero **`npm` sí funciona** con las dependencias ya instaladas. Los wrappers de `scripts/` eligen pnpm si existe y, si no, npm.

```powershell
# Opción rápida con wrappers (desde la raíz del repo)
powershell -ExecutionPolicy Bypass -File scripts\api.ps1     # API + SQLite + seed → :8000
powershell -ExecutionPolicy Bypass -File scripts\dev.ps1     # Vite dev → :5173 (otra terminal)

# Modo demo: compila la SPA y la sirve FastAPI en un solo proceso
powershell -ExecutionPolicy Bypass -File scripts\demo.ps1    # → http://127.0.0.1:8000
# si el 8000 está ocupado, usa el siguiente libre y lo imprime en pantalla
powershell -ExecutionPolicy Bypass -File scripts\stop.ps1    # libera 8000/8001/5173

# Demo de CP2: sirve la build congelada (sin rebuild) con la API actual
powershell -ExecutionPolicy Bypass -File scripts\serve-cp2.ps1

# Tests E2E
powershell -ExecutionPolicy Bypass -File scripts\e2e-api.ps1
powershell -ExecutionPolicy Bypass -File scripts\e2e-browser.ps1
```

**Manual (equivalente):**

```powershell
# 1) Backend, una sola vez (crear venv e instalar dependencias)
C:\Users\Usuario\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe -m venv services/api/.venv
services/api/.venv\Scripts\python.exe -m pip install -r services/api/requirements.txt

# 2) API + SQLite + seed (terminal 1)
cd services/api; .venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
#    → http://127.0.0.1:8000/api/health  ·  Swagger: http://127.0.0.1:8000/docs

# 3) Frontend en desarrollo (terminal 2) — usa npm si pnpm no está en PATH
cd apps/web; npm run dev
#    → http://127.0.0.1:5173  (proxy /api → :8000)

# 4) Demo "un proceso" (la que se enseña el sábado)
cd apps/web; npm run build
cd services/api; .venv\Scripts\python.exe -m uvicorn app.main:app --port 8000
#    → http://127.0.0.1:8000 sirve la SPA y /api, sin CORS

# 5) Reset de datos demo (botón en la Nav una vez logueado, o)
curl.exe -b cookies.txt -X POST http://127.0.0.1:8000/api/demo/reset
```

- **Login demo:** dos botones en la app (Laura/Clínica y Marc/Especialista), sin password.
- **Datos:** SQLite en `data/vetlink.db` (gitignored); se genera y reseeda al arrancar.
- **Contrato:** `docs/contracts/openapi-v1.json` (23 endpoints) y Swagger en `/docs`.
- **GitHub:** congelado por indicación del equipo; todo se guarda en local.

## Datos de ejemplo

`data/samples/` contiene los tres ficheros del reto (datos ficticios y anonimizados):

| Fichero | Paciente | Origen |
|---|---|---|
| `Clínica Veterinaria Vall del Sol.docx` | Bruno | Ficha manual de clínica |
| `export_MAS-0004587_anonimizado.xlsx` | Luna | Exportación de PMS |
| `historial.json` | Kira | API VetNexo Cloud v3.2.1 |

## Privacidad

Todos los datos son ficticios y anonimizados. El prototipo aplica el principio de mínimo privilegio: roles, niveles de compartición (`CLINICAL` / `FULL`) y registro de auditoría. El entorno se identifica como demostración en la interfaz. Base legal prevista para producción: consentimiento del tutor + contrato de encargado del tratamiento clínica↔VetLink (RGPD / LOPDGDD).

## Entrega

- Repositorio: <https://github.com/HackathonBoehringerIT/Joniha>
- Todo el trabajo final debe estar en la rama `main` antes del deadline anunciado por la organización.
- Checklist de entrega: ver [`PLAYBOOK.md` §11](PLAYBOOK.md#11-checklist-de-entrega-domingo).
