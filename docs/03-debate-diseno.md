# 03 · Debate de diseño — VetLink

**Red-team para:** Lead y equipo. **Fecha:** 14/11/2026, 01:15 CET. **Deadline asumido:** domingo 15/11, 15:00 CET; verificar el anuncio oficial, el README dice que la organización comunicará hora y zona.
**Regla de esta nota:** si una idea no sobrevive a “enséñamelo y pregúntame por el dato”, se cae. No hay tiempo para dos productos.

## 0. Resumen ejecutivo

- La propuesta del Lead (C) apunta bien, pero está sobredimensionada: son 55–65 h de trabajo real, no 30. Tal cual, el domingo se entrega a medias.
- El reto no son tres features: es un traspaso de historia clínica con permiso, contexto y trazabilidad. El marketplace es el canal; el informe pre-visita es el producto.
- La IA debe extraer, no redactar ni decidir. Briefing determinista, revisión humana y procedencia por campo.
- Recorte a 5 pantallas y 40–48 h. Si no hay 4 personas capaces de comprometer ese tiempo, el plan B es A+D y no llamarlo marketplace.
- Notas: C' 8,35/10; C 7,65; A 5,90; B 4,80; D 5,20. El detalle, abajo.

## 1. Lectura del reto y riesgo de malinterpretarlo

### 1.1 Tres lecturas válidas; el error es elegir una sola

| Lectura | Qué prioriza | Si se adopta sola |
|---|---|---|
| Literal: los 3 bullets | Cubrir 1, 2 y 3 por separado | Tres silos: un parser, un directorio y un enlace. El jurado no ve un producto. |
| Sistémica: el traspaso | Que la historia llegue completa, ordenada y con permiso al especialista antes de la visita | Tentación de construir un EHR completo; se pierde el marketplace y el tiempo. |
| Comprador IT | Que el dato no se pierda, que el acceso esté controlado y que la demo no se caiga | Se convierte en una demo de arquitectura; el jurado no ve el flujo clínico. |

La lectura que debe gobernar es la sistémica. Las otras dos son medios, no fines. Un director de IT no puntúa un logo: puntúa que el dato tenga origen, que el acceso tenga límite y que la demo no dependa de la wifi.

### 1.2 Lo que el reto pide de verdad

- **“Formato único comprensible por cualquier veterinario”** tiene dos caras: un JSON canónico para la máquina y un informe legible para el clínico. Si solo entregas una, no cumples.
- **“Homogeneizar dinámicamente”** no es tener tres importadores hardcodeados. Es poder mapear columnas y campos que no habías visto sin recompilar. Sin mapeador, el bullet 1 se queda en un script.
- **“Marketplace”** no es un directorio con estrellas. Exige servicio, precio, disponibilidad, solicitud, aceptación y cita. Una lista sin estado de contratación es una página web.
- **“Conectar ambas piezas”** no es poner un enlace al historial. Es conceder acceso a una historia concreta, a un profesional concreto, para una cita concreta, con un informe generado antes de la visita y con registro de quién lo vio.
- **“Funciona”** no es “tiene muchas pantallas”. Un botón muerto es peor que una feature ausente. Cinco pantallas sin callejones sin salida valen más que doce con tres muertas.

### 1.3 El error de lectura más caro

Creer que el jurado va a evaluar la idea. Va a evaluar si el prototipo aguanta que él lo toque. En cuatro minutos pedirá esto: entrar, subir un fichero, preguntar “¿de dónde sale este dato?”, preguntar “¿quién puede verlo?”, preguntar “¿y con un formato que no es de los vuestros?”, preguntar “¿esto es un dispositivo médico?” y pulsar “contratar”. Si esas seis respuestas no están ensayadas, la presentación no salva el proyecto.

El segundo error es convertir esto en una demo de IA. La IA es un ingrediente, no el producto. Si el momento central es un chat que escribe bonito, el jurado probará la parte más frágil y con más riesgo legal.

## 2. Debate de opciones

Pesos de la nota: encaje con los 3 bullets 35%, funcionamiento demostrable 25%, viabilidad técnica 20%, “wow” 10%, riesgo 10% (10 = riesgo bajo). La nota no es una preferencia estética; es una apuesta de dónde se gana el premio.

| Opción | Encaje 35% | Funciona 25% | Viabilidad 20% | Wow 10% | Riesgo 10% | Nota | Esfuerzo |
|---|---:|---:|---:|---:|---:|---:|---|
| A) Normalizador puro | 4 | 8 | 7 | 4 | 7 | **5,90** | 25–30 h |
| B) Marketplace puro | 3 | 7 | 5 | 4 | 6 | **4,80** | 30–35 h |
| C) Capa + marketplace + briefing | 9 | 6 | 8 | 9 | 5 | **7,65** | 55–65 h |
| C') C recortado (recomendado) | 9 | 8 | 8 | 9 | 7 | **8,35** | 40–48 h |
| D) Solo briefing con IA | 3 | 7 | 6 | 8 | 4 | **5,20** | 15–20 h |

### A) Normalizador puro

Sube Word/Excel/JSON, mapea, genera un registro canónico y un informe. No hay especialista ni agenda.

- **Pro:** determinista, demo técnicamente sólida, el jurado IT ve profundidad; cubre el bullet 1 y parte del 3.
- **Contra:** incumple el bullet 2 de forma explícita; no hay a quién entregar la historia; la demo es seca; el “wow” es una tabla.
- **Encaje:** 1 sí, 2 no, 3 parcial. **Esfuerzo:** 25–30 h. **Wow:** 4/10. **Nota:** 5,90.
- **Veredicto:** buen plan B para 2–3 personas. No es el reto.

### B) Marketplace puro

Fichas, búsqueda, agenda y solicitud. El historial es un PDF adjunto.

- **Pro:** se entiende en 30 segundos; cubre el bullet 2; CRUD rápido; visual.
- **Contra:** commodity; los bullets 1 y 3 no existen; sin dato clínico no hay defensa técnica; chat, reseñas y pagos son sumideros de horas; el jurado preguntará “¿y los formatos?”.
- **Encaje:** 1 no, 2 sí, 3 no. **Esfuerzo:** 30–35 h. **Wow:** 4/10. **Nota:** 4,80.
- **Veredicto:** no. Es la mitad fácil y la que cualquier equipo puede copiar.

### C) Capa de interoperabilidad + marketplace + briefing

La propuesta del Lead: los tres pilares conectados.

- **Pro:** cubre los tres bullets y los une; una sola narrativa; profundidad técnica más producto; el informe pre-visita es el mejor momento de demo.
- **Contra:** 55–65 h en bruto; tres integraciones; LLM y red en vivo; riesgo alto de hacer tres cosas a medias; un equipo pequeño no llega.
- **Encaje:** 1 sí, 2 sí, 3 sí (9/10). **Esfuerzo:** 55–65 h. **Wow:** 9/10. **Nota:** 7,65.
- **Veredicto:** dirección correcta, ejecución inviable tal cual. No es un problema de idea; es de alcance.

### C') C recortado — la recomendación

No es una versión tímida de C. Es C con el 40% del alcance que no puntúa eliminado y con dos cambios que sí puntúan:

1. **Fuera:** área del dueño, chat, reseñas/estrellas/distancia, landing con vídeos/FAQ, “informes separados por veterinario” como módulo y notificaciones reales. Ahorro bruto estimado: 18–22 h; el mapeador y el acceso suman 8–12 h.
2. **Adentro:** mapeador asistido para tabulares y un cuarto formato CSV/XML plano con cabeceras no vistas. El “desconocido” no será un PDF escaneado. Coste: 4–6 h; convierte el bullet 1 en algo dinámico de verdad.
3. **Briefing determinista:** plantilla sobre el registro canónico; el LLM solo extrae texto libre. Cero alucinación en la pantalla que más mira el jurado.
4. **Antes de aceptar, resumen no identificativo:** especie, raza, edad, peso, motivo, alertas, servicio, precio y urgencia. La historia completa se abre al aceptar. Es RGPD y es la mejor demostración de “conectar”.
5. **Demo local-first:** seed, botón de reset y vídeo grabado. La nube es un extra, no la columna vertebral.

**Encaje:** 1 sí, 2 sí, 3 sí. **Esfuerzo:** 40–48 h. **Wow:** 9/10. **Nota:** 8,35.

**Esfuerzo de C':**

| Bloque | Horas |
|---|---:|
| Modelo canónico, migraciones, seed | 3 |
| XLSX/CSV + mapeador asistido | 7 |
| JSON + validación de esquema | 2 |
| DOCX + extracción LLM | 5 |
| Revisión, procedencia y auditoría | 4 |
| Marketplace: lista y ficha | 4 |
| Reserva + agenda simple | 4 |
| Briefing pre-visita | 3 |
| Auth, roles y tenant | 3 |
| Demo, vídeo y README | 4 |
| **Total nominal** | **39** |
| **Con buffer del 20%** | **47** |

Con 4 personas × 12 h efectivas = 48 h, cabe justo. Con 3 personas = 36 h, no cabe. Ojo: el 00-contexto estima 20–24 h de trabajo real; si eso es total del equipo y no por persona, C' es ficción y hay que bajar a A+D. El “~30 h” del Lead no es C': es A, o C' sin DOCX, sin briefing y sin agenda.

**Conflicto con lo ya escrito:** 05 propone 13 pantallas y Supabase Auth/Storage; aquí se recomiendan 5 y backend único. Si ya están construidas, no se borran: se quedan fuera del guion.

### D) Solo briefing con IA

Subes lo que sea, un LLM escribe un informe bonito. No hay normalizador ni marketplace.

- **Pro:** 15–20 h; muy visual; se enseña en dos minutos; parece magia.
- **Contra:** incumple el bullet 2 de forma explícita; sin registro canónico no hay formato único ni trazabilidad; el jurado IT lo desmonta con “¿de dónde sale esta frase?”; la alucinación es el máximo riesgo posible en datos clínicos.
- **Encaje:** 3/10. **Esfuerzo:** 15–20 h. **Wow:** 8/10. **Nota:** 5,20.
- **Veredicto:** no es un producto; es la pantalla 5 de C'. Úsalo como feature, nunca como tesis.

### Lo que no es una opción

Integrarse con el PMS/FHIR real de una clínica: no hay acceso, contrato ni tiempo; es una fase 2. App móvil: no. Chat con IA: no. Blockchain: no. Microservicios: no. Un monolito modular bien hecho es la respuesta correcta para 48 h y para un director de IT.

## 3. Los supuestos más peligrosos

| # | Supuesto | Falsador concreto | Mitigación | Si falla |
|---|---|---|---|---|
| 1 | “Con los 3 ficheros del reto basta; el jurado no probará otro.” | Pide a alguien ajeno al equipo un Excel/CSV sintético con otra estructura y súbelo. Prueba 10 variantes; si falla más de una, no está listo. | Mapeador asistido, matriz de soporte y error claro. | El jurado concluye que es un script, no un producto. |
| 2 | “El LLM extrae bien dosis, alergias y medicación.” | 10–20 documentos sintéticos no usados en desarrollo; mide acierto en campos críticos. Menos del 90% = no. | Reglas para lo estructurado; LLM solo texto libre; confianza, procedencia y revisión; nada automático. | Un dato clínico mal extraído destruye la credibilidad y puede ser peligroso. |
| 3 | “La demo en vivo saldrá.” | Tres ensayos con la red de la presentación, arranque en frío y otro navegador; si tarda más de 2 s o falla, local. | Demo local, seed, reset, vídeo grabado y segundo portátil. | Cero puntos en “funciona”. |
| 4 | “3 formatos + 1 desconocido es fácil.” | El Word/Excel real puede ser .doc/.xls binario o PDF escaneado; comprueba extensiones hoy, no el domingo. | .docx/.xlsx soportados; .doc/.xls se convierten o se rechazan; el cuarto será CSV/XML plano; OCR fuera. | Prometes robustez y el directo te deja en evidencia. |
| 5 | “30 h alcanzan.” | Burn-down el sábado a las 20:00: ¿flujo end-to-end? Si no, recorta ese mismo día. | Vertical slice primero; congelación de alcance; cinco pantallas. | Entrega a medias y sin demo. |
| 6 | “GitHub/org y deadline están claros.” | Push a main antes de las 10:00. Lee el anuncio oficial de deadline, no tu suposición. | Verifica invitación y rama; plan B zip + organizador; trata las 13:30 del domingo como deadline real. | No hay entrega, o se pierde por dos horas. |
| 7 | “Supabase es estable y suficiente.” | Latencia y cold start desde la red de la presentación; si supera 500 ms o cae, Postgres local. | Supabase solo como Postgres; backend único; Docker local; migraciones y seed; sin Auth/Storage/Realtime. | La demo se cae o el jurado ve datos cruzados. |
| 8 | “Equipo pequeño = poca coordinación.” | Revisa ramas y PRs el sábado a las 14:00; si dos personas tocan el mismo fichero, hay merge hell. | Contrato de API, ownership por carpeta e integración cada 3 h. | Se pierde la tarde del domingo en conflictos. |
| 9 | “El briefing puede decir lo que sea; es un resumen.” | Revisión veterinaria del texto: si sugiere diagnóstico, tratamiento o dosis, fuera. | Plantilla determinista, sin recomendaciones, disclaimers y enlace a la fuente. | Riesgo clínico/legal y pregunta incómoda del jurado. |

## 4. Decision log

| # | Decisión | Recomendación | Por qué | Si se ignora |
|---|---|---|---|---|
| 1 | ¿LLM o reglas? | Reglas para lo estructurado; LLM solo para texto libre, con esquema, confianza y revisión. Briefing por plantilla, no por LLM. | La clínica y la demo no toleran alucinación; el ~80% de los campos viene de tablas. | Un campo inventado en directo; el jurado IT pierde la confianza. |
| 2 | ¿Qué ve el especialista antes de contratar? | Resumen no identificativo: especie, raza, edad, peso, motivo, 2–3 alertas, servicio, precio y urgencia. Nombre, contacto e historia completa, solo tras aceptar. | Minimización RGPD, confianza y la mejor demostración de “conectar”; el criterio 4 de 01 (“briefing antes de aceptar”) se cumple con este resumen, no con el historial completo. | O acepta a ciegas, o expones datos antes de tiempo. |
| 3 | ¿Pagos/comisiones? | No. Solicitud → aceptación → cita confirmada + resumen de servicio con precio. Facturación fuera. | Stripe, KYC, impuestos y devoluciones no caben; “contratar” se demuestra con estado, no con cobro. | Scope y riesgo legal; si el pago falla, el flujo se rompe. |
| 4 | ¿Incluimos dueño? | No login ni área de dueño. Datos mínimos del tutor y consentimiento; recordatorios, fase 2. | El reto nombra a Laura y Marc; el dueño añade RBAC, RGPD y UI sin puntuar. | Duplicas auth y permisos y llegas peor a la demo. |
| 5 | ¿Nombre/marca? | Congelar VetLink; sin logo ni naming nuevo. Tagline descriptivo: “La historia clínica llega completa al especialista”. 30 minutos máximo. | El jurado no puntúa marca; “a un clic” es falso e invita a probarlo. | Pierdes horas y el eslogan promete algo que no haces. |
| 6 | ¿Stack? | React + FastAPI + PostgreSQL. Supabase solo como DB; demo local con Docker; un solo origen; sin Supabase Auth/Storage/Realtime. | Menos servicios = menos fallos; el backend es la única puerta; RLS y Auth de Supabase comen horas. | CORS, claves en frontend, cold starts y demo frágil. |
| 7 | ¿Qué es “terminado”? | 5 pantallas (login/rol; paciente+subida+revisión; búsqueda/ficha; reserva/agenda; informe), 3 formatos + 1 desconocido, seed, procedencia, auditoría, README, vídeo, main y 0 bugs P0 (bloqueantes). | “Funciona” es un jurado pidiendo que pulses sin callejones sin salida, no una lista de features. | Se sigue puliendo UI y no hay flujo completo. |
| 8 | ¿Qué NO se toca? | Auth; esquema después del sábado 18:00; landing, chat, pagos, OCR e integraciones; refactors; dependencias nuevas después de las 20:00. Si ya está construido, no se borra: se queda fuera del guion. | Cada cambio tardío rompe la demo; el domingo no perdona. | Regresiones y merge hell. |
| 9 | ¿Cómo tratar formatos desconocidos? | Mapeador asistido para tabulares; matriz de soporte explícita; PDF escaneado fuera con estado claro; nada de “cualquier formato”. | “Dinámico” es mapear columnas, no tener tres importadores hardcodeados. | El bullet 1 se queda en tres scripts y el cuarto fichero te delata. |
| 10 | ¿Modelo de datos? | JSON canónico inspirado en FHIR (Patient, Encounter, Condition, MedicationStatement, AllergyIntolerance, Immunization, Observation, DocumentReference), versionado, con procedencia por campo y audit log. | Es el idioma que un director de IT respeta; permite enseñar el “de dónde sale”. | Un JSON ad hoc; preguntan por interoperabilidad y no hay respuesta. |

## 5. Scope killers

Lo que no se hace y qué contestar si el jurado lo pide. No improvises: estas respuestas van ensayadas.

| Feature | Decisión | Si el jurado lo pide |
|---|---|---|
| Landing con vídeos/FAQ | Fuera. README + una slide. | “La información está en el README y en la demo; preferimos enseñar el flujo.” |
| Chat vet-especialista | Fuera. | “Fase 2; la solicitud y el briefing cubren la comunicación previa.” |
| Estrellas, reseñas, distancia | Fuera. Foto y zona estática como máximo. | “Sin masa crítica las reseñas son ruido; la distancia sin geolocalización real es un dato falso.” |
| App/área del dueño | Fuera. | “Fase 2; el reto es la derivación entre profesionales, no el portal del tutor.” |
| Pagos/comisiones | Fuera. | “Contratación simulada con precio y servicio; el cobro es un rail posterior, no el producto.” |
| OCR/PDF escaneado | Fuera. | “Soportamos texto y tablas; un escaneo necesita OCR y validación, y no lo prometemos.” |
| Integración directa con PMS/FHIR | Fuera. | “Hoy entramos por fichero; la API FHIR es fase 2 y el modelo ya está preparado.” |
| IA diagnóstica | Fuera. | “No diagnosticamos; resumimos y marcamos alertas con fuente. El clínico decide.” |
| Notificaciones/email reales | Fuera o mock. | “El flujo se ve en la UI; el envío real es infraestructura, no valor del reto.” |
| Multi-idioma/móvil | Fuera. | “Español y desktop; el reto es el dato, no la app.” |
| Agenda recurrente/drag&drop | Fuera. Semana simple con slots. | “La agenda cubre disponibilidad y cita; la recurrencia es fase 2.” |
| Facturación/firma digital | Fuera. | “El acuerdo es entre clínicas; no somos una pasarela de pago.” |

## 6. Objeciones del jurado (7)

1. **“Esto ya lo hace un PMS veterinario.”** No lo sustituimos: somos la capa que convierte lo que exporta un PMS, Excel o Word en un registro canónico y lo lleva al especialista. La integración directa es fase 2; hoy el fichero es el denominador común.
2. **“La IA puede inventar una dosis.”** Por eso el ~80% de los campos se extraen con reglas y el LLM solo toca texto libre, con esquema, confianza y procedencia. Nada entra en la historia sin revisión humana; en la demo se ve rechazar un campo.
3. **“Mandáis datos clínicos a OpenAI.”** La demo usa datos de demostración sin PII y el briefing no lo genera el LLM. En producción: DPA, endpoint UE, sin entrenamiento, minimización y consentimiento; el especialista no ve datos del tutor antes de aceptar.
4. **“Sin pagos no es un marketplace.”** Hay oferta, servicio, precio, disponibilidad, solicitud, aceptación y cita confirmada; el pago es un rail posterior. El reto pide encontrar y contratar, no cobrar; el cobro añade KYC, impuestos y fraude que no se demuestran en tres minutos.
5. **“Solo funcionáis con vuestros tres ficheros.”** Hay tres fixtures y un CSV/XML con cabeceras no vistas en vivo, más un mapeador para tabulares. La matriz de soporte está en el README; un PDF escaneado se rechaza con un mensaje claro, no con un error.
6. **“¿Esto es un dispositivo médico?”** No: es documentación y comunicación entre profesionales; no diagnostica ni recomienda tratamiento. El informe resume, marca alertas y enlaza la fuente; la decisión es del veterinario.
7. **“¿Aguanta dos clínicas y permisos?”** Cada clínica es un tenant; el acceso nace de una derivación, es revocable y queda auditado. Antes de aceptar, el especialista ve solo el resumen no identificativo; después, la historia completa.

## 7. Riesgos legales/RGPD y qué debe aparecer en la UI

Esto no es asesoría jurídica. Es la lista de lo que no puede faltar para que el jurado no os desmonte.

- **Datos del tutor:** nombre, teléfono y dirección son personales. Los datos clínicos del animal no son datos de salud humana del art. 9 RGPD, pero vinculados al tutor siguen siendo personales; minimiza.
- **Ficheros del reto:** 01 dice que el Word trae PII del tutor; 05 dice que están anonimizados. Verifícalo antes de subirlos a Supabase o al LLM; si hay PII, usa copias seudonimizadas y no las enseñes.
- **Base y consentimiento:** relación profesional y consentimiento informado del tutor para compartir con el especialista. Registra quién, cuándo y para qué; permite revocar.
- **Terceros:** Supabase y el proveedor LLM necesitan contrato de encargado del tratamiento (DPA), región UE y no entrenamiento. Sin DPA no mandes datos reales: usa copias sin PII o sintéticas.
- **Seguridad:** TLS, hash de contraseñas, sesión/JWT, autorización por rol y clínica, secretos solo en backend, nada de datos clínicos en logs, backup.
- **Auditoría:** acceso y compartición visibles. “Quién ha visto esta historia” es una feature, no un log oculto.
- **Retención y derechos:** exportar y borrar; política de conservación; no prometas cumplimiento total de normativa autonómica.
- **MDR:** no es un sistema de apoyo a la decisión clínica (CDSS): no genera diagnóstico ni tratamiento, solo documenta y marca alertas con fuente. Evita “recomendamos” o “diagnóstico probable”; disclaimer: “No sustituye el juicio clínico”.
- **Contratación:** verificación de colegiación (mock), términos entre clínicas y límite de responsabilidad; no seas intermediario financiero.

| Elemento UI | Dónde | Texto/comportamiento |
|---|---|---|
| Banner de demo | Cabecera global | “Entorno de demostración — datos sin PII. No usar con datos reales.” |
| Consentimiento | Antes de compartir | Checkbox: “Autorizo compartir la historia clínica de [animal] con [especialista] para la valoración solicitada.” Con fecha y revocación. |
| Quién ve qué | Ficha del caso | “Antes de aceptar: resumen no identificativo. Después: historia completa.” |
| Procedencia | Cada dato del informe | Badge “Excel · celda B12”, “Word · párrafo 7”, “Manual”, “LLM · revisado”. |
| Auditoría | Panel del caso | “Compartido con Marc el 14/11 a las 10:32; acceso caduca el 14/12.” |
| Derechos | Ajustes | Exportar y eliminar; enlace a privacidad. |
| No diagnóstico | Pie del informe | “Resumen documental. No sustituye el juicio clínico.” |

## 8. Veredicto final

### Qué mantengo de tu propuesta

- Los tres pilares y su orden: ingesta → marketplace → briefing.
- El híbrido determinista + LLM con validación, procedencia y revisión humana.
- El MVP sin pagos reales.
- La demo con tres formatos más uno desconocido, con la corrección de abajo.

### Qué cambiaría, y por qué

1. **Recorta a C':** fuera dueño, chat, reseñas, landing, “informes por veterinario” y notificaciones reales. Cinco pantallas. Tu C completo no cabe y el 40% que sobra no puntúa.
2. **El briefing no lo escribe el LLM:** plantilla determinista sobre el registro canónico. Es la pantalla que más mira el jurado y la que más riesgo legal tiene; no la dejes en manos de un modelo.
3. **Añade el mapeador asistido y cambia el cuarto formato a CSV/XML.** Deja de prometer “cualquier formato”. Sin mapeador no has hecho homogeneización dinámica; has hecho tres importadores.
4. **Que el especialista vea un resumen no identificativo antes de aceptar y la historia completa después.** Es RGPD, es confianza y es la demostración más clara de que las dos piezas están conectadas.
5. **Demo local-first con seed, reset y vídeo.** Nada crítico en la nube ni en la wifi de la presentación. La demo no puede depender de Supabase ni de la API del LLM.
6. **Congela:** esquema el sábado a las 18:00; dependencias a las 20:00; funcionalidad el domingo a las 10:00; código a las 12:00; repo verificado a las 13:30. El buffer no es opcional.
7. **Mide la extracción en 10–20 documentos held-out.** Si el acierto en campos críticos baja del 90%, cambia el discurso a “extracción asistida con revisión” y no prometas automatización.
8. **Cambia el tagline, no el nombre.** “Salud animal, a un clic” es falso para un flujo con subida, revisión y reserva. “La historia clínica llega completa al especialista” dice lo que haces y no invita a un test de un clic.

### Guion de demo (3 minutos)

| Min | Qué se enseña |
|---|---|
| 0:00 | Laura entra; bandeja con Bruno (Word), Luna (Excel) y Kira (JSON); banner de datos sin PII. |
| 0:30 | Sube un CSV con cabeceras raras; el mapeador propone columnas; confirma; aparecen alertas. |
| 1:15 | Busca especialista; ficha con precio y hueco; solicita derivación de Kira con resumen no identificativo. |
| 2:00 | Cambia a Marc; acepta; ve la historia completa de Kira y el briefing con procedencia; audita el acceso. |
| 2:45 | Cierra: tres pacientes, tres formatos, uno desconocido, cero datos personales, todo trazable. |

### Reloj de 38 horas

| Cuándo | Hito |
|---|---|
| Sáb 09:00 | Standup; verificar push a main y deadline oficial; congelar alcance y owners. |
| Sáb 14:00 | Esquema, auth, seed y XLSX/JSON end-to-end. |
| Sáb 20:00 | Flujo completo con DOCX y reserva; si no está, recorte inmediato. |
| Sáb 23:00 | Briefing, auditoría y datos de demo. |
| Dom 10:00 | Feature freeze; solo bugs. |
| Dom 12:00 | Code freeze; vídeo y README. |
| Dom 13:30 | Repo verificado y ensayo final. |
| Dom 15:00 | Deadline asumido. |

**Nota final:** C' 8,35/10. Si no hay cuatro personas y 45–48 h efectivas, baja a A+D y no lo llames marketplace. El jurado no compra el parseo: compra que la historia llegue completa, ordenada y trazable. Vende eso.
