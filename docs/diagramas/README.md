# Diagramas VetLink (Archify)

Diagramas **HTML autocontenidos** generados con el plugin/skill **Archify** (3.2.0) e instalados en el perfil DSH. Se abren directamente en el navegador (sin servidor): doble clic o arrastrar al navegador. Tienen tema claro/oscuro, navegación/zoom y exportación a imagen.

| Diagrama | Tipo | Qué muestra | Fuente |
|---|---|---|---|
| [Flujo de usuarios](flujo-usuarios.html) | `workflow` | Viaje completo **Laura (clínica) → VetLink → Marc (especialista)**: importación de 3 formatos, ficha canónica, búsqueda y solicitud, briefing pre-visita, aceptación, día de la visita y cierre. Incluye ramas: formato desconocido → revisión humana, declinar → alternativa, aceptar → calendario. | `docs/04-flujos-usuarios.md` (A–D) |
| [Flujo de uso de la app](flujo-uso-app.html) | `workflow` | Recorrido **pantalla a pantalla** de la demo (S1–S13) agrupado en fases: entrar · importar · entender · conectar · cerrar. Es el guion visual de la demo. | `docs/04-flujos-usuarios.md` (flujo E) |
| [Arquitectura de componentes](arquitectura-vetlink.html) | `architecture` | SPA React → API FastAPI (extractores, canónico/alertas, briefing, marketplace) → PostgreSQL/Supabase como plano de datos; LLM solo para texto libre; frontera de privacidad (niveles `CLINICAL`/`FULL`, auditoría). | `docs/05-arquitectura-mvp.md` |
| [Secuencia importación → briefing](secuencia-importacion-briefing.html) | `sequence` | Pipeline técnico con evidencia: subida de 3 ficheros → detección de adaptador → extracción con confianza → revisión humana → registro `READY` con alertas (Bruno/Luna/Kira) → solicitud → briefing **antes** de aceptar → cita → cierre. | `docs/05-arquitectura-mvp.md` + `04` |

## Recibos de validación

Cada HTML tiene a su lado los recibos de la herramienta: `*.delivery.json` (provenance de la entrega), `*.finalize-summary.json`, `*.finalize.json` y `*.browser-check.json`. Los diagramas entregados pasaron los cuatro gates (`validate`, `deliver`, `check` estricto y `browser-check` en Chrome real) con 0 diagnósticos. Los candidatos editables viven en `.archify/` (fuera del repo por `.gitignore`).

## Cómo regenerarlos

```powershell
# desde la raíz del repo
node "C:\Users\Usuario\.dsh\profiles\desktop\node_modules\@tt-a1i\archify-dsh\skills\archify\bin\archify.mjs" finalize <type> .archify/<carpeta>/candidate.json docs/diagramas/<nombre>.html --quality showcase --json
```

> Si cambias contenido, no edites el HTML a mano: edita el `candidate.json` y vuelve a ejecutar `finalize`. Los diagramas son documentación de producto, no artefactos de build.
