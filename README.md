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
| Aplicación (React + FastAPI + Supabase) | 🚧 en construcción |

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
├── apps/web/              # frontend React + Vite + TypeScript (en construcción)
├── services/api/          # API FastAPI + extractores (en construcción)
├── data/samples/          # los 3 ficheros de ejemplo del reto
└── docker-compose.yml     # entorno local (previsto)
```

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + TanStack Query.
- **Backend:** FastAPI (Python 3.12) + Pydantic v2 + SQLAlchemy async.
- **Datos:** PostgreSQL + Auth + Storage en Supabase (RLS activo).
- **IA:** extracción estructurada con validación de esquema y provenance; el veterinario confirma.
- **Despliegue:** Vercel/Netlify (web) + Render/Fly (API) + Supabase; fallback local con Docker.

## Cómo arrancar

> Se completará cuando el esqueleto de la aplicación esté creado (ver `docs/05-arquitectura-mvp.md`).

```bash
# previsto
cp .env.example .env        # configurar Supabase y API
docker compose up           # postgres + api + web
# o
pnpm --dir apps/web dev     # frontend
uvicorn app.main:app --reload --dir services/api   # API
```

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
