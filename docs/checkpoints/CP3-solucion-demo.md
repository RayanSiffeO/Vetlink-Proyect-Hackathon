# Checkpoint 3 · Solución y demo

> **Criterio evaluado:** resuelve el problema, aporta valor y **demo funcional con buen nivel técnico**.  
> **Cuándo:** domingo 15/11 **14:45** (15 min, sala virtual del jurado, cámara encendida; demo final congelada a las 14:15).  
> **Estado:** guion, dossier técnico y checklist listos; la demo se implementa con el plan de [`PLAYBOOK.md` §8.5](../../PLAYBOOK.md) (2 personas + agentes). Este documento es lo que se muestra y se dice en el checkpoint.

## 1. Qué se va a demostrar (y qué no)

**Demo funcional (5 pantallas):**
1. Login por rol (clínica / especialista) — sin passwords, selector demo.
2. Paciente + subida multi-fichero (Word/Excel/JSON) + panel de revisión con procedencia.
3. Búsqueda de especialista + ficha con servicio, precio y disponibilidad.
4. Solicitud de derivación → aceptación → cita en calendario de ambos.
5. Briefing pre-visita: resumen no identificativo antes de aceptar; historia completa después; auditoría del acceso.

**No se demuestra (y se dice):** pagos reales, OCR/PDF escaneado, chat en tiempo real, app nativa, integración directa con PMS. El roadmap está en `PLAYBOOK.md` §3.

## 2. Guion de demo (3 minutos — el que se ensaya)

| Tiempo | Qué se hace | Qué se dice |
|---|---|---|
| 0:00–0:20 | Abrir login y entrar como Laura | "Cada clínica usa un software distinto. Cuando Laura necesita un especialista, empieza el papeleo." |
| 0:20–1:00 | Subir `Clínica Vall del Sol.docx`, `export_MAS-0004587.xlsx`, `historial.json` | "Tres formatos, tres ontologías. El sistema detecta el adaptador y normaliza." |
| 1:00–1:20 | Abrir ficha de Bruno/Luna/Kira; señalar alertas y procedencia | "Mismo registro canónico, con la fuente de cada dato. La alergia de Bruno o el carprofeno de Kira salen solos." |
| 1:20–1:45 | Subir `export_clinica_norte.csv` con cabeceras raras; confirmar mapeo | "Un cuarto formato que no habíamos visto: el mapeador propone columnas y yo confirmo. Cero pérdida de datos." |
| 1:45–2:15 | Buscar "dermatología, Barcelona, esta semana"; abrir ficha de Marc; solicitar derivación | "Aquí está el marketplace: servicio, precio y hueco real. Solicito con resumen no identificativo." |
| 2:15–2:45 | Cambiar a Marc; abrir briefing **antes** de aceptar; aceptar | "Marc ve el caso antes de ver al paciente. Acepta, y la cita aparece en el calendario de los dos." |
| 2:45–3:00 | Volver a Laura; ver cita y auditoría | "Tres pacientes, tres formatos, uno desconocido, cero datos reales y todo trazable. Menos papeleo, más cuidado." |

**Versión de 6 minutos:** añade el detalle de la revisión humana (campo con confianza <0,8), el panel de auditoría y el cierre del especialista (si está implementado).

## 3. Dossier técnico (lo que se enseña si preguntan "¿cómo funciona?")

| Pieza | Qué contar | Evidencia en repo |
|---|---|---|
| **Pipeline de importación** | sniff de formato → adaptador → extracción con provenance/confidence → revisión humana → normalización → matching → merge → registro canónico | `docs/05` §Pipeline · diagrama `secuencia-importacion-briefing.html` |
| **Registro canónico** | FHIR-inspired, versionado, 12 entidades + Provenance; 1.785 campos validados de los 3 ficheros | `docs/02` · `docs/ejemplos/*.json` |
| **Provenance** | cada campo enlaza a su origen; los dudosos van a revisión; umbrales en campos críticos (alergia 0,95 · medicación 0,90 · microchip 1,0) | `docs/02` §6 y §10 |
| **Mapeador asistido** | columnas desconocidas → propuesta + confirmación + plantilla reutilizable; 4º CSV en vivo | `docs/02` §9 · `data/samples/export_clinica_norte.csv` |
| **Alertas** | 11 reglas deterministas (alergias, medicación, vencimientos, citas, peso) → 22 alertas con evidencia en los 3 casos | `docs/02` §7 |
| **Briefing determinista** | plantilla sobre el registro, sin LLM; mismo input → mismo output; enlace a la fuente | `docs/05` · `docs/02` §10 |
| **Privacidad** | dos niveles: resumen no identificativo pre-aceptación vs historia completa post-aceptación; auditoría de accesos | `docs/02` §8 · `docs/05` §Seguridad |
| **Arquitectura** | un proceso FastAPI que sirve SPA y API sobre SQLite; sin Supabase/Docker/LLM en el camino crítico; Postgres-ready | `docs/05` · `arquitectura-vetlink.html` |
| **Contrato API** | ~20 endpoints; Swagger autogenerado en `/docs` | `docs/05` §API |

**Frase de nivel técnico:** "No es un chat que resume: es un pipeline determinista con esquema, procedencia, confianza y control de acceso, y una demo que funciona sin red."

## 4. Checklist pre-demo (se comprueba 30 min antes)

**Técnico:**
- [ ] `POST /api/demo/reset` deja la base en estado inicial y la demo arranca en frío.
- [ ] Importación de los 3 ficheros + CSV → 4 resultados correctos, en <30 s.
- [ ] Alertas esperadas: Bruno (alergia pollo, control 17/11), Luna (otitis, revisión 13/11), Kira (carprofeno, control 14/11, collar vencido).
- [ ] Búsqueda de especialista devuelve a Marc; perfil con precio y hueco.
- [ ] Solicitud → aceptación → cita en ambos calendarios.
- [ ] Briefing: resumen no identificativo visible antes de aceptar; historia completa después.
- [ ] Auditoría muestra el acceso.
- [ ] Demo repetible ×3 sin tocar código; vídeo de 3 min grabado.
- [ ] Un solo comando de arranque probado en el portátil de la demo (sin red).

**Narrativa:**
- [ ] Guion de 3 min ensayado y cronometrado (2 pasadas).
- [ ] Respuestas a las 10 preguntas del jurado (ver [`PLAYBOOK.md` §9.3](../../PLAYBOOK.md)).
- [ ] Roles claros: **Jose Miguel narra** (producto/frontend) y **[NOMBRE COMPAÑERO] pulsa** (backend); acordado antes del ensayo.
- [ ] Cierre con métricas: 3+1 formatos → 1 registro <30 s; 1.785 campos; 22 alertas; 10–15 min → 90 s; 0 datos reales.

## 5. Valor que se demuestra

| Valor | Cómo se ve en la demo |
|---|---|
| **Menos papeleo** | 3 formatos entran, 1 registro sale; el veterinario no re-teclea |
| **Más cuidado** | El especialista llega con el caso leído; alertas críticas visibles |
| **Confianza** | Cada dato con fuente; revisión humana de lo dudoso; auditoría de accesos |
| **Encaje con el reto** | Los tres requisitos (normalizar, marketplace, conectar) en un solo flujo |
| **Encaje con Boehringer** | Datos estructurados de prevención/adherencia (vacunas, desparasitación, revisiones), con consentimiento |

## 6. Preguntas del jurado y respuesta corta

| Pregunta | Respuesta |
|---|---|
| "¿Y si la clínica usa otro formato?" | Mapeador asistido + adaptadores; el CSV en vivo demuestra que no está hardcodeado. |
| "¿La IA inventa datos?" | En la demo no hay LLM en el camino crítico; extracción determinista + revisión humana. |
| "¿De quién son los datos?" | La clínica es responsable; VetLink encargado; consentimiento del tutor; auditoría y niveles de acceso. |
| "¿Sin pagos no es un marketplace?" | Oferta, servicio, precio, disponibilidad, solicitud, aceptación y cita; el cobro es un rail posterior. |
| "¿No es otro PMS?" | No competimos: capa de ingesta y derivación PMS-agnóstica. |
| "¿Aguanta dos clínicas y permisos?" | Roles, niveles de compartición, auditoría y permisos con caducidad. |
| "¿Por qué Boehringer?" | Prevención y adherencia es su negocio; VetLink estructura los datos que ya necesitan (y el RD 986/2026 los pedirá en 2027). |

## 7. Mapa criterio → evidencia

| Lo que pide el checkpoint | Cómo se cubre |
|---|---|
| Resuelve el problema | Demo de los 3 requisitos del reto en un solo flujo (§2) |
| Aporta valor | Valor por rol + métricas + encaje BI (§5) |
| Demo funcional | Checklist técnico §4 + plan local-first con seed y vídeo |
| Buen nivel técnico | Dossier §3: pipeline, canónico, provenance, mapper, briefing determinista, privacidad |

## 8. Estado actual y siguiente paso

- **Listo:** guion (3/6 min), dossier técnico, checklist, preguntas y respuestas, evidencias documentales (modelo, 3 JSON validados, diagramas, contrato API).
- **En construcción:** las 5 pantallas (plan de 6–8 h con 2 personas + agentes; ver [`PLAYBOOK.md` §8.5](../../PLAYBOOK.md)).
- **Siguiente paso:** arrancar H+0 (scaffold + contrato + seed) y llegar al primer gate "importar 3 ficheros en `curl`" en la primera hora.
