# `apps/web` — Frontend VetLink

**Stack:** React 18/19 + Vite + TypeScript + Tailwind CSS + React Router + TanStack Query.

## Pantallas (ver `docs/04-flujos-usuarios.md`)

| ID | Pantalla | Ruta propuesta | Rol |
|---|---|---|---|
| S1 | Landing | `/` | público |
| S2 | Login / registro | `/login` | ambos |
| S3 | Home clínica | `/clinic` | CLINIC |
| S4 | Importar historia | `/clinic/import` | CLINIC |
| S5 | Ficha canónica | `/clinic/patients/:id` | CLINIC |
| S6 | Marketplace | `/clinic/specialists` | CLINIC |
| S7 | Perfil de especialista | `/clinic/specialists/:id` | CLINIC |
| S8 | Nueva solicitud | `/clinic/requests/new` | CLINIC |
| S9 | Home especialista | `/specialist` | SPECIALIST |
| S10 | Briefing pre-visita | `/specialist/requests/:id/briefing` | SPECIALIST |
| S11 | Calendario | `/calendar` | ambos |
| S12 | Chat del caso | `/requests/:id/chat` | ambos |
| S13 | Cierre de visita | `/specialist/requests/:id/close` | SPECIALIST |
| S14 | Configuración | `/settings` | ambos |

## Estado

🚧 Pendiente de scaffold (ver `docs/05-arquitectura-mvp.md`).

## Reglas

- **Mock-first:** arrancar contra fixtures de la API (contrato en `docs/05-arquitectura-mvp.md`) mientras el backend termina.
- **Marca:** navy `#1D2B4F`, teal `#1E8E82`, blanco; logo monograma "VL" (origen en `D:\hackaton\Ideas\Logo 5 · Monograma VL@2x.png`).
- **Estados obligatorios:** vacío, carga, error y éxito en cada pantalla que entre en la demo.
- El **briefing (S10) debe verse bien en móvil**: es el escenario real del especialista.
- No añadir librerías de UI pesadas a estas alturas del hackathon.
