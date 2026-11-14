# Pendientes de código para tener el hackathon completo y funcional

> Estado verificado en código el 14/11/2026, 11:00. Base actual: 5 pantallas, 23 endpoints, SQLite + seed, E2E API **27/27** y navegador **10/10**, build de CP2 congelada (`releases/cp2`).

## 1. Qué está terminado y verificado

| Pieza | Estado |
|---|---|
| R2 · Marketplace (directorio, búsqueda, ficha, slots, solicitud, aceptar/declinar/cancelar, agenda) | ✅ Funcional |
| R3 · Briefing (resumen no identificativo, 403→200, determinista, auditoría, provenance visible) | ✅ Funcional con los registros seed |
| Pantallas, roles demo, estados vacío/error, reset de demo, banner de datos ficticios | ✅ |
| Contrato API congelado (`openapi-v1.json`, 23 endpoints) y E2E | ✅ |
| **R1 con los ficheros exactos del reto** | ✅ vía cache sha256 (los reconoce al instante) |
| **R1 con cualquier otro fichero o variante** | ❌ **Es el hueco real** |

## 2. Imprescindible para "completo y funcional" (las 3 piezas del reto con cualquier fichero)

| # | Tarea | Por qué | Dueño | Est. |
|---|---|---|---|---|
| **P1** | Extractores reales `.csv` `.xlsx` `.json` `.docx` | Hoy solo se reconocen los 3 ficheros exactos por hash; una variante cae a `NEEDS_REVIEW` | Rayan (13:45) + Lead cablea | 2–3 h |
| **P2** | Cablear el registry de extractores en `POST /api/imports` y persistir el canónico | Unir la pieza de Rayan con la API real sin romper el contrato | Lead | 1 h |
| **P3** | **Motor de alertas** para registros nuevos | La API **lee** `canonical["alerts"]`; los extractores no las generan. Sin motor, una ficha nueva no tiene alertas ni briefing | Lead | 2–3 h |
| **P4** | Matching/dedupe de paciente (microchip → nombre+fecha nac.) | Sin él, subir una variante del mismo paciente **duplica** en vez de actualizar | Lead | 1–2 h |
| **P5** | Flujo de revisión humana (`PATCH …/review` + UI mínima) | El contrato ya lo contempla pero no existe endpoint ni UI; es la prueba de "la IA propone, el veterinario confirma" | Lead | 1,5–2 h |

**Sin P3 y P4 no se integran los extractores:** la demo quedaría peor que ahora (fichas sin alertas o duplicadas). Ese es el orden correcto.

## 3. Recomendable (sube el nivel técnico y cierra el círculo)

| # | Tarea | Valor | Est. |
|---|---|---|---|
| **P6** | Cierre de visita del especialista (nota → ficha de la clínica, estado `COMPLETED`) | Hoy el caso muere en la cita; el retorno de la nota completa la historia y es un buen momento de CP3 | 2–3 h |
| **P7** | Responsive/móvil del briefing | Marc trabaja desde el móvil; el E2E actual es solo desktop | 0,5–1 h |
| **P8** | E2E de los flujos nuevos + release de CP3 | Mantener el gate y la build de CP3 separada de `releases/cp2` | 1–2 h |
| **P9** | Gestión de disponibilidad del especialista | "Organizar su actividad" del enunciado; hoy los slots son fijos del seed | 1–2 h (opcional) |

## 4. Fuera de alcance (ya decidido, no lo metas)

Pagos reales, OCR/PDF escaneado, chat, reseñas/estrellas, portal del tutor, notificaciones reales, deploy cloud, app nativa y LLM en el camino crítico.

## 5. Definición de "completo y funcional" (criterio de aceptación)

- [ ] Cualquier `.docx/.xlsx/.json/.csv` subido produce ficha canónica con provenance.
- [ ] Variante de un fichero conocido → se normaliza o cae a `NEEDS_REVIEW` **sin romper**.
- [ ] Los registros nuevos generan alertas y su briefing tiene contenido real.
- [ ] Subir dos ficheros del mismo paciente **actualiza, no duplica**.
- [ ] La revisión humana se puede completar y queda registrada.
- [ ] (P6) La nota del especialista aparece en la ficha de la clínica y la solicitud pasa a `COMPLETED`.
- [ ] `ruff` 0 · `pytest` verde · `check-code` 0 · E2E API y navegador verdes.
- [ ] Build de CP3 generada aparte, sin tocar `releases/cp2`.

## 6. Orden y ventanas de tiempo

| Ventana | Qué |
|---|---|
| Hasta 12:00 | **CP1**. No se toca código (main congelado para CP2) |
| 12:15–13:45 | Preparar en rama `feat/r1-extractores`: P3 (motor de alertas) y P4 (dedupe), que no dependen de Rayan |
| 13:45–14:00 | Recibir extractores; gate ruff/pytest/check-code; P2 en la rama |
| 14:00–17:15 | P5 si P2–P4 están verdes; ensayo y preparación de CP2 con **main congelado** |
| 17:45–18:15 | CP2 (build y main congelados) |
| 18:15–24:00 | Merge de la rama **solo si el E2E sigue verde**; P6/P7; release CP3; vídeo |
| Domingo 08:00–12:00 | QA final, ensayo, congelaciones (10:00 features / 12:00 código) |
| Domingo 14:15–14:45 | Demo final congelada y **CP3** |

## 7. Riesgos principales

1. **Integrar extractores sin motor de alertas/dedupe** → demo peor que la actual. No hacerlo.
2. **Romper CP2** → todo cambio va en rama; `main` no se mergea hasta después de las 18:00.
3. **GitHub congelado** → el push final es entrega, no opcional. Decidir ventana hoy (recomendado: tras CP2, nunca a las 14:00 del domingo).
4. **Tiempo**: P1–P5 suman 8–11 h de trabajo; con 2 personas + agentes cabe en la tarde-noche, pero P6 compite con el vídeo. Orden: P3 → P4 → P2 → P5 → P6.
