# Checkpoint 2 · Propuesta de solución

> **Criterio evaluado:** idea clara, alineada con el reto y lista para desarrollar.  
> **Cuándo:** sábado 14/11 **18:00** (15 min, sala virtual del jurado, cámara encendida).  
> **Propuesta:** **VetLink — la historia clínica llega completa al especialista antes de la visita.**  
> **Estado:** lista para desarrollar (modelo, contrato, datos y flujos ya construidos).

## Para copiar/pegar (resumen de 30 segundos)

> VetLink convierte el papeleo veterinario en una historia clínica única y compartible: sube los datos en cualquier formato que use la clínica (Word, Excel, JSON o CSV), los normaliza a un registro canónico con trazabilidad, y los entrega al especialista en un briefing antes de la visita. Al mismo tiempo es el marketplace donde la clínica generalista encuentra y contrata a ese especialista. Resuelve los tres requisitos del reto en un solo flujo.

## 1. El problema (en 2 frases)

La información clínica de una mascota existe, pero está partida entre Word, Excel de distintos PMS, JSON y texto libre. Cuando Laura (veterinaria generalista) necesita un especialista, no sabe a quién llamar; cuando Marc (especialista ambulante) llega, dedica los primeros minutos de cada visita a reconstruir una historia que le llega incompleta y desordenada.

## 2. La solución: 3 pilares, un flujo

| Pilar | Qué hace | Se ve en |
|---|---|---|
| **VetRecord** | Ingesta multi-formato → registro canónico con procedencia, confianza y alertas | Pantalla 2 |
| **VetNetwork** | Marketplace de especialistas: especialidad, zona, precio, disponibilidad, solicitud y agenda | Pantallas 3–4 |
| **VetBriefing** | Resumen pre-visita determinista, con niveles de acceso (no identificativo antes de aceptar; historia completa después) | Pantalla 5 |

**El "wow" diferencial:** el especialista ve el caso **antes** de ver al paciente, y cada dato sabe de dónde sale.

## 3. Encaje con el reto (requisito → cómo lo cumplimos → dónde se demuestra)

| Requisito literal del dossier | Cómo lo cumplimos | Dónde se demuestra |
|---|---|---|
| Subir información en formatos distintos y homogeneizarla dinámicamente en un formato único comprensible | Extractores deterministas para Word/Excel/JSON + **mapeador asistido** para tabulares con columnas no vistas + revisión humana + registro canónico versionado | Importación de los 3 ficheros del reto + CSV con cabeceras raras |
| Marketplace: clínicas encuentran/contratan especialistas; especialistas ofrecen servicios y organizan su agenda | Perfil con servicio, zona, tarifa y disponibilidad; solicitud → aceptación → cita en calendario de ambos | Búsqueda de dermatología + solicitud + aceptación |
| Conectar ambas piezas: la historia completa y ordenada, visible antes de ver al paciente | Briefing generado del registro; resumen no identificativo pre-aceptación; historia completa post-aceptación; auditoría | Pantalla de briefing de Marc antes de aceptar |

## 4. Usuarios

- **Laura** — veterinaria generalista de clínica pequeña: no puede tener especialista en plantilla, quiere resolver el caso sin perder al cliente ni re-teclear historias.
- **Marc** — especialista ambulante: quiere llegar preparado y no perder los primeros 15 minutos de cada visita.
- **Tutora (fase 2)** — recordatorios y ficha compartida; fuera del MVP, dentro del roadmap.

## 5. Alcance MVP (5 pantallas) y no-alcance

**MVP:** login/rol · paciente + subida + revisión · búsqueda + ficha de especialista · reserva + agenda · briefing/informe.

**Fuera del MVP (y por qué):** pagos reales (no aportan a la demo técnica), OCR/PDF escaneado, chat en tiempo real, app móvil nativa, área del dueño, integración directa con PMS (fase 2). El detalle está en [`PLAYBOOK.md` §3](../../PLAYBOOK.md).

## 6. Listo para desarrollar: qué ya existe

| Evidencia | Estado |
|---|---|
| Modelo canónico "VetLink Record" con provenance y 11 reglas de alerta | ✅ [`docs/02-modelo-datos.md`](../02-modelo-datos.md) |
| 3 registros canónicos reales de los ficheros del reto (132 entidades, 1.785 campos, 22 alertas con evidencia) | ✅ [`docs/ejemplos/`](../ejemplos/) |
| Contrato de API congelado (~20 endpoints) y arquitectura de un solo proceso | ✅ [`docs/05-arquitectura-mvp.md`](../05-arquitectura-mvp.md) |
| Flujos de usuario y de uso pantalla a pantalla | ✅ [`docs/04-flujos-usuarios.md`](../04-flujos-usuarios.md) |
| 3 ficheros del reto + CSV de robustez | ✅ [`data/samples/`](../../data/samples/README.md) |
| Diagramas navegables (flujos, arquitectura, secuencia) | ✅ [`docs/diagramas/`](../diagramas/README.md) |
| Plan de ejecución de 6–8 h con 2 personas + agentes | ✅ [`PLAYBOOK.md` §8.5](../../PLAYBOOK.md) |

## 7. Nivel técnico (en una frase cada uno)

- **Registro canónico inspirado en FHIR** (Patient, Encounter, Condition, MedicationStatement, Immunization, Observation, DocumentReference) con `provenance` por campo y export-ready.
- **Provenance + confidence:** cada dato enlaza a su fuente (`historial.json#/...`, `tabla3/fila7`, `Medicina_Preventiva!fila5`); lo dudoso va a revisión humana.
- **Mapeador asistido:** propone el mapeo de columnas desconocidas y el usuario confirma → "formato único" de verdad, no 3 scripts.
- **Briefing determinista:** plantilla sobre el registro; el LLM no redacta informes clínicos.
- **Privacidad por diseño:** resumen no identificativo antes de aceptar, historia completa después, auditoría de accesos.
- **Demo local-first:** SQLite + un proceso, sin Supabase/Docker/LLM en el camino crítico; Postgres-ready.

## 8. Valor e impacto

- **Para la clínica:** menos tiempo reconstruyendo historias, acceso a especialistas que no puede tener en plantilla, menos papeleo.
- **Para el especialista:** llega preparado; 10–15 min → ~90 s de lectura del briefing.
- **Métrica de demo:** 3 formatos + 1 desconocido → 1 registro en <30 s, 1.785 campos trazados, 22 alertas con evidencia.
- **Mercado** (fuente [`docs/06`](../06-investigacion-mercado.md)): 7.032 clínicas en España, ~92% independientes, ~70% con 1–2 veterinarios, ~400 especialistas diplomados y más de la mitad fuera; **64%** de los veterinarios encuestados por la FVE dice que el papeleo se ha duplicado.
- **Encaje Boehringer:** prevención y adherencia (vacunas, desparasitación, revisiones) es su negocio; VetLink estructura justo esos datos.

## 9. Plan de demo (3 minutos)

1. **0:00** Laura entra; bandeja con Bruno (Word), Luna (Excel) y Kira (JSON).
2. **0:30** Sube un CSV con cabeceras raras → el mapeador propone columnas → confirma → alertas con procedencia.
3. **1:15** Busca especialista por especialidad/zona → ficha con precio y hueco → solicita derivación con resumen **no identificativo**.
4. **2:00** Cambia a Marc → acepta → ve la historia completa y el briefing; audita el acceso.
5. **2:45** Cierre: 3 pacientes, 3 formatos, 1 desconocido, 0 datos reales, todo trazable.

## 10. Riesgos y respuesta preparada

| Riesgo | Respuesta |
|---|---|
| "Es otro PMS" | No competimos: capa de ingesta y derivación PMS-agnóstica; el sistema de registro sigue siendo el de la clínica |
| "Sin pagos no es marketplace" | Oferta, servicio, precio, disponibilidad, solicitud, aceptación y cita; el cobro es un rail posterior |
| "La IA puede inventar" | En la demo no hay LLM en el camino crítico; todo es determinista con revisión humana |
| "Solo funciona con vuestros 3 ficheros" | Mapeador asistido + CSV con columnas no vistas en vivo |
| "¿De quién son los datos?" | Clínica = responsable; VetLink = encargado; consentimiento del tutor; auditoría y nivel de acceso |

## 11. Mapa criterio → evidencia

| Lo que pide el checkpoint | Dónde está la evidencia |
|---|---|
| Idea clara | §2 en una frase + pitch del bloque "Para copiar/pegar" |
| Alineada con el reto | Tabla requisito → cumplimiento → demo (§3) |
| Lista para desarrollar | §6: modelo, contrato, datos, flujos, diagramas y plan de 6–8 h ya hechos |

## 12. Guion de 90 segundos (si es una llamada)

1. "El reto tiene tres piezas: normalizar formatos, marketplace y conectar ambas. Nuestra propuesta las une en un solo flujo: VetLink."
2. "La clínica sube Word/Excel/JSON/CSV; normalizamos a un registro canónico con trazabilidad y alertas."
3. "El especialista lo ve en un briefing antes de la visita; antes de aceptar, solo un resumen no identificativo."
4. "Está lista para desarrollar: modelo canónico y 3 registros validados, contrato de API, 4 diagramas y plan de 6–8 h con 2 personas y agentes."
5. "La demo de 3 minutos enseña los tres requisitos del reto de principio a fin."

> **Pendiente del usuario:** confirmar si el checkpoint se entrega como documento o en llamada; este documento sirve para ambos.
