# 02 · Modelo de datos — VetLink Record v1

Contrato canónico que produce la capa de ingesta: una historia clínica veterinaria heterogénea (Word, Excel de PMS, JSON de API) se convierte en un registro único, tipado y trazable, listo para el marketplace y para el briefing pre-visita. Versión `vetlink.record/1.0`, implementada y validada en [canonico-kira.json](ejemplos/canonico-kira.json), [canonico-bruno.json](ejemplos/canonico-bruno.json) y [canonico-luna.json](ejemplos/canonico-luna.json) (3/3 `json.load` OK, 0 errores de integridad referencial).

## 1. Inventario de fuentes

| Fuente | Qué trae | Granularidad | Claves | Unidades | Límites |
|---|---|---|---|---|---|
| Word Vall del Sol (29,9 KB, 5 tablas) | Ficha de tutor y paciente, 11 visitas en prosa, 6 filas de vacunación, 5 observaciones/alertas, PII completa | 1 fila = visita, sin hora ni ID de visita | Nº ficha `VS-2024-00387`, microchip, pasaporte `ES-0412345` | kg, BCS `6/9`, fechas `dd/mm/yyyy` | Sin facturación ni adjuntos; sin código de vacuna (solo lote `RB-2231`); meses sin día («mayo de 2027»); actualizado 03/11/2026 |
| Excel PMS (41,1 KB, 13 hojas) | Mascota, tutor (anonimizado), 4 alertas/problemas, 5 conceptos preventivos, 3 recordatorios, 5 pesos, 6 visitas, y detalle completo (anamnesis, exploración, pruebas, tratamiento, albarán, documentos) solo de la última visita | 1 fila = evento; hojas relacionales por `ID_MASCOTA`/`ID_VISITA` | `MAS-0004587`, `CLI-0002193`, `VIS-2026-11-06-0458`, `ALB-2026-11-06-0312` | kg, °C, lpm, rpm, EUR | Sin nombre/contacto/microchip; snapshot 06/11/2026 12:15; fechas con `00:00:00`; `ULTIMA_APLICACION` vacía; fila `TOTAL`; BOM UTF-8; saldo 14,93 EUR |
| JSON VetNexo Cloud v3.2.1 (22,0 KB) | 9 encuentros con SOAP, 4 vacunas, 2 antiparasitarios, 7 pesos, 4 recordatorios, 5 adjuntos, 5 problemas, 2 flags, 9 facturas con IVA | 1 objeto = evento con id propio | `patient.uuid`, `HVB-PAC-018842`, `enc_*`, `rx_*`, `invoice_no`, `RMD-*`, `fil_*` | kg, °C, EUR declaradas en `_meta` | Seudonimizado: microchip/pasaporte enmascarados, tutor `TUTOR_8F2C` sin contacto; sin dirección ni fecha de emisión de factura; adjuntos solo metadatos; export 10/11/2026 08:42 |

- Volumen normalizado: **26 encuentros, 19 vacunas, 21 pesos, 14 problemas, 11 prescripciones, 10 facturas, 8 documentos, 11 recordatorios, 6 antiparasitarios** → 132 entidades y 1.785 campos poblados.
- Los tres registros son **pacientes distintos** (Bruno/Carmen Roldán, Luna/CLI-0002193, Kira/TUTOR_8F2C): no hay duplicado real entre fuentes, pero el matching se prueba con sus tres niveles de identificabilidad.
- Cada fuente tiene su `as_of` (Word 03/11, Excel 06/11, JSON 10/11/2026): el briefing debe declarar la antigüedad del dato, no asumir tiempo real.

## 2. Modelo canónico (FHIR-inspired)

12 entidades raíz + Provenance embebida. Todas: `_type`, `id` (PK string), `_meta` (Provenance) y, si aplica, `field_provenance`. Los nombres v1.0 entre paréntesis se conservan en los JSON para no romper los ejemplos; `fhir_profile` mapea 1:1.

| Entidad (FHIR) | v1.0 | Campos (tipos) | Relaciones |
|---|---|---|---|
| `Patient` | Patient | `id:uuid` · `external_ids:[{system,id}]` · `name:str` · `species_code:enum(CAN,FEL,OTHER)` · `species_label:str` · `breed_code:str?` · `breed_label:str` · `sex:enum(MALE,FEMALE,UNKNOWN)` · `neutered:bool?` · `neutered_on:date?` · `birth_date:date?` · `birth_precision:enum(DAY,MONTH,YEAR,ESTIMATED)` · `coat:str?` · `microchip:str?` · `microchip_implanted_on:date?` · `passport:str?` · `registry:str?` · `owner_ids:[uuid]` · `weight_current_kg:dec?` · `weight_current_on:date?` · `bcs:int?` · `bcs_scale:str` · `status:enum(ACTIVE,DECEASED,TRANSFERRED)` · `deceased:bool` · `insured:bool?` · `insurance:{provider_ref,coverage}?` · `temperament:{score,scale,muzzle_required,notes}?` · `diet:str?` · `lifestyle:[str]` · `flags:[{code,severity,text,since}]` | 1-N `RelatedPerson`; 1-N resto |
| `RelatedPerson` (Owner) | Owner | `id:uuid` · `external_ids[]` · `display_name:str` · `legal_name:str?` · `tax_id_masked:str?` · `birth_date:date?` · `profession:str?` · `address:{line,city,province,postal_code,country}` · `phones:[{type,e164,raw}]` · `emails:[{address}]` · `languages:[str]` · `preferred_language:str` · `preferred_channel:enum(SMS,EMAIL,WHATSAPP,PHONE,UNKNOWN)` · `consents:{reminders,marketing,source_ref}` · `account:{balance,currency,status}?` · `payment_method:str?` · `data_classification:enum(PSEUDONYMIZED,IDENTIFIED_PII)` · `is_primary:bool` | 1-N `Patient` |
| `Encounter` | Encounter | `id:uuid` · `patient_id:uuid` · `external_id:str` · `date:date` · `time:HH:MM?` · `started_at:ts?` · `timezone:str` · `type:enum(FIRST_VISIT,WELLNESS,ACUTE,EMERGENCY,SURGERY,RECHECK,VACCINATION,PREVENTIVE)` · `reason:str` · `clinic:{code,name}` · `clinician_ref:str?` · `status:enum(SIGNED,OPEN,CANCELLED)` · `vitals:{temperature_c,heart_rate_bpm,respiratory_rate_rpm,weight_kg,bcs,mucous_membranes,crt_s,crt_comparator}` · `soap:{s,o,a,p}` · `diagnosis_summary:str?` · `procedures:[{code,name,anesthesia}]` · `lab_results:[{panel,analyte,value,unit,ref,flag}]` · `next_visit_date:date?` · `next_visit_precision:enum?` · `next_visit_text:str?` | N-1 `Patient`; 1-N `Condition`, `Observation`, `DocumentReference` |
| `Condition` (Problem) | Problem | `id:uuid` · `patient_id:uuid` · `label:str` · `code:str?` · `category:enum(ALLERGY,ADVERSE_REACTION,DERMATOLOGIC,OTIC,GI,DENTAL,OPHTHALMIC,ORTHOPEDIC,REPRODUCTIVE,TRAUMA,NUTRITION,INFECTIOUS,OTHER)` · `status:enum(ACTIVE,CONTROLLED,RESOLVED,RULED_OUT,SUSPECTED)` · `certainty:enum(CONFIRMED,SUSPECTED,REPORTED)` · `onset_date:date?` · `resolved_date:date?` · `severity:enum(MILD,MODERATE,SEVERE,UNKNOWN)` · `first_encounter_ref:str?` · `notes:str?` | N-1 `Patient`; N-N `Encounter` |
| `Immunization` | Immunization | `id:uuid` · `patient_id:uuid` · `encounter_ref:str?` · `vaccine_code:enum(RABIES,DHPPI,DHPPI_L4,LEPTOSPIRA,KENNEL_COUGH,LEISHMANIA,POLYVALENT,OTHER)` · `vaccine_label:str` · `product_ref:str?` · `batch:str?` · `given_on:date` · `due_on:date?` · `due_precision:enum?` · `route:enum(SC,IM,IN,ORAL,UNKNOWN)` · `status:enum(GIVEN,DUE,OVERDUE,UNKNOWN)` | N-1 `Patient`; N-1 `Encounter` |
| `Observation` (Weight) | Weight | `id:uuid` · `patient_id:uuid` · `measured_on:date` · `kg:dec(5,2)` · `bcs:int?` · `encounter_ref:str?` | N-1 `Patient`; N-1 `Encounter` |
| `MedicationStatement` (Prescription) | Prescription | `id:uuid` · `patient_id:uuid` · `encounter_ref:str` · `drug_name:str?` · `drug_name_raw:str` · `dose_text:str?` · `duration_days:int?` · `started_on:date?` · `ends_on:date?` · `status:enum(ACTIVE,COMPLETED,DISCONTINUED)` · `stop_reason:str?` · `notes:str?` | N-1 `Patient`; N-1 `Encounter` |
| `MedicationStatement` preventivo | ParasiteControl | `id:uuid` · `patient_id:uuid` · `type:enum(ENDO,ECTO)` · `product:str?` · `last_given:date?` · `next_due:date?` · `given_at:enum(HOME,CLINIC,UNKNOWN)` · `status:enum(CURRENT,DUE,OVERDUE,UNKNOWN)` | N-1 `Patient` |
| `Task` (Reminder) | Reminder | `id:uuid` · `patient_id:uuid` · `type:enum(VACCINE,PARASITE,RECHECK,DENTAL,CONTROL,OTHER)` · `text:str` · `due:date?` · `due_precision:enum?` · `status:enum(PENDING,DUE,OVERDUE,DONE,CONDITIONAL,UNKNOWN)` · `channel:str?` · `origin_encounter_ref:str?` · `source_status:str?` | N-1 `Patient` |
| `DocumentReference` | Document | `id:uuid` · `patient_id:uuid` · `encounter_ref:str?` · `kind:enum(LAB_REPORT,DENTAL_CHART,PHOTO,PRESCRIPTION,REPORT,CYTOLOGY,OTHER)` · `filename:str` · `mime:str` · `size_bytes:int?` · `size_text:str?` · `sha256:str?` · `contains_pii:bool` | N-1 `Patient`; N-1 `Encounter` |
| `Invoice` | Invoice | `id:uuid` · `patient_id:uuid` · `encounter_ref:str?` · `document_type:enum(FACTURA,ALBARAN,TICKET)` · `invoice_no:str` · `issued_on:date?` · `lines:[{sku,description,qty,unit_price,vat_rate,line_total}]` · `net:dec?` · `vat:dec?` · `total:dec` · `currency:str` · `paid:bool?` · `balance:dec?` | N-1 `Patient`; N-1 `Encounter` |
| `Alert` (Flag VetLink) | Alert | `id:str` · `patient_id:uuid` · `code:str` · `rule_id:enum(R01..R11)` · `severity:enum(CRITICAL,HIGH,MEDIUM,LOW,INFO)` · `category:enum(ALLERGY,MEDICATION,PROBLEM,PREVENTIVE,APPOINTMENT,WEIGHT,DATA_QUALITY,RISK)` · `title:str` · `message:str` · `evidence:[{entity,id,source_system,source_ref}]` · `action:str` · `due_date:date?` · `confidence:dec` · `generated_at:ts` | N-1 `Patient` (calculada) |
| `Provenance` | `_meta` | `source_system:str` · `source_format:enum(JSON_API,DOCX,XLSX,CSV)` · `source_ref:str` · `extracted_at:ts` · `extracted_by:str` · `reviewed_by:str?` · `method:enum(direct,normalized,derived,derived_cross_sheet,masked,absent_in_source)` · `confidence:dec` · `assumed:bool?` | 1:1 con cada entidad; `field_provenance` por campo |

- `Owner` 1-N `Patient` (co-tutores); `Patient` 1-N todo; `Encounter` N-1 `Patient`; `Prescription`/`Invoice`/`DocumentReference` N-1 `Encounter`; `Condition` N-N `Encounter` (vía `first_encounter_ref`/`linked_problems`).
- Campos estructurados en JSONB (vitals, soap, procedures, lab_results, address, phones, consents, lines, evidence) para no crear 30 tablas en el hackathon; en PostgreSQL cada colección es una tabla con FK e índices por `patient_id`.
- **Nota de implementación demo (v1.3):** la demo persiste el registro canónico completo como `records.canonical_json` en **SQLite** (JSON serializado) + proyecciones (`alerts`, `patients`); el esquema es portable a PostgreSQL (`JSONB`) sin cambiar el contrato. Ver `docs/05-arquitectura-mvp.md`.
- Fechas sin hora = `date`; con hora = `time` + `started_at` con offset `Europe/Madrid`. Nunca se inventa una hora.

## 3. Mapeo fuente → canónico

| Canónico | Word | Excel (PMS) | JSON (API) |
|---|---|---|---|
| `Patient.name` | tabla 2 «Nombre» | `Mascota.NOMBRE` | `patient.name` |
| `Patient.species/breed` | «Especie: Canina», «Raza» | `ESPECIE`, `RAZA` | `species.code/display`, `breed.code/display` |
| `Patient.sex/neutered` | «Macho castrado», «Hembra esterilizada» | `SEXO` | `sex` + `neutered` |
| `Patient.birth_date` | «02/02/2024» + edad en prosa | `FECHA_NACIMIENTO` | `birth_date` (+`birth_date_estimated`) |
| `Patient.microchip/passport` | «Nº microchip», «Pasaporte/cartilla» | — (anonimizado) | `identifiers[MICROCHIP,PASSPORT_EU]` |
| `Patient.weight/bcs` | «Peso actual 32,4 kg (03/11/2026)», «6/9» | `PESO_ACTUAL_KG`, `CONDICION_CORPORAL` | `vitals.weight`, `weights[-1]` |
| `Patient.insurance/temperament/diet` | «Seguro/mutua», «Carácter», «Alimentación» | solo `ETIQUETAS` | `insured`, `temperament`, `diet` |
| `Owner.legal_name/tax_id` | tabla 1 (nombre, DNI/NIE) | — | — (seudonimizado) |
| `Owner.address` | «Dirección», «Población/CP» | `Tutor.POBLACION` | `municipality`, `postal_code_prefix` |
| `Owner.phones/emails` | móvil, alternativo, correo | — | — |
| `Owner.language/channel/consents` | «Idioma preferido», «Contacto preferido», «Consentimiento» | — | `language`, `preferred_channel`, `reminder_consent` |
| `Owner.account/payment` | «Forma de pago» (sin saldo) | `SALDO_PENDIENTE_EUR`, `ESTADO_SALDO` | `account.balance`, `payment_method_default` |
| `Encounter.date/time` | «Fecha» (sin hora) | `FECHA` + `HORA` | `start` (offset → `date`+`time`) |
| `Encounter.type/reason` | «Motivo» (tipo inferido) | `TIPO_VISITA`, `MOTIVO` | `type`, `reason` |
| `Encounter.vitals` | pesos y hallazgos en prosa | `Visita_Exploracion` | `vitals` |
| `Encounter.soap` | «Exploración/Hallazgos», «Actuación/Tratamiento» | `Visita_Anamnesis` + `RESUMEN_DIAGNOSTICO` | `soap.S/O/A/P` |
| `Encounter.lab_results/procedures` | «test leishmania negativo», «orquiectomía» en prosa | `Visita_Pruebas` | `lab_results`, `procedures` |
| `Condition` | «Alertas y observaciones» + diagnósticos | `Alertas_Problemas` | `problem_list` + `flags` |
| `Immunization` | tabla 4 + prosa de cada visita | `Medicina_Preventiva` | `immunizations` |
| `MedicationStatement` preventivo | tabla 4 (interna/externa) | `Medicina_Preventiva` | `parasite_control` |
| `Observation` (peso) | pesos dentro de la tabla 3 | `Evolucion_Peso` | `weights` |
| `Task` (recordatorio) | «Próxima cita» | `Recordatorios` | `reminders` |
| `MedicationStatement` | «Actuación/Tratamiento» | `Visita_Tratamiento` | `prescriptions` |
| `Invoice` | — | `Visita_Facturacion` | `invoice` |
| `DocumentReference` | — | `Visita_Documentos` | `attachments` |
| `Alert` | derivada de alergias/vencimientos | derivada de `Alertas_Problemas` | derivada de `flags` + reglas |

Campos que solo existen en una fuente: `Pet Protect Plus`/`DNI`/`pasaporte`/`censo municipal` (Word); `saldo pendiente` y `ETIQUETAS` (Excel); `uuid`, `flags`, `temperament`, `insured` y facturas con IVA (JSON). El canónico los admite como opcionales y el briefing los muestra solo si están.

## 4. Reglas de normalización

1. **Fechas**: salida ISO-8601 (`YYYY-MM-DD`); `dd/mm/yyyy` → ISO; `2019-03-14 00:00:00` → `date` (el `00:00` del PMS es artefacto); timestamps con offset `Europe/Madrid`. «Mayo de 2027» → `due_on=2027-05-31`, `due_precision=MONTH`, literal en `next_visit_text`; nunca se inventa el día.
2. **Unidades**: kg con 1 decimal (coma→punto), °C 1 decimal, `lpm`→`heart_rate_bpm`, `rpm`→`respiratory_rate_rpm`, CRT `«< 2»`→`crt_s=2`+`crt_comparator="<"`, PIO `mmHg`, Schirmer `mm/min`. No se convierten magnitudes ni se redondea el original (`unit_original` en provenance cuando se convierta lb→kg).
3. **Sexo/esterilización**: «Macho castrado»→`MALE`+`neutered=true`+`neutered_on=2025-01-10`; «Hembra esterilizada»→`FEMALE`+`true`; `F`→`FEMALE`; «hembra entera»→`false`.
4. **Especie/raza**: `Canina`/`CAN`/`Canis lupus familiaris`→`CAN`; raza con código de origen (`BRD-0412`) o código VetLink derivado (`BRD-LAB`, `BRD-BEAGLE`) + etiqueta legible.
5. **Estados**: «Activo»→`ACTIVE`, «Resuelto»→`RESOLVED`, «Controlado»→`CONTROLLED`, «Cerrada»→`SIGNED`, «Pendiente»→`PENDING`, «Condicional»→`CONDITIONAL`, «Informativo» no genera `Condition`; «Sin alergias medicamentosas conocidas»→`RULED_OUT` (negativo explícito, no alergia).
6. **Vacunas/vencimientos**: `given_on` y `due_on`; si la ficha da un intervalo («cada 3 meses») la fecha se calcula y se marca `assumed:true` con `method=interval_3_months`; estado calculado contra `as_of` (`DUE`/`OVERDUE`), no contra la fecha de importación.
7. **Moneda/IVA**: EUR con 2 decimales; IVA 21% (`0.21`) cuando consta; albarán ≠ factura (`document_type`); `total` = suma de líneas; `net`/`vat` a `null` si no constan (Excel).
8. **Contacto**: teléfonos a E.164 (`+34600123456`) conservando `raw`; emails en minúsculas; idioma ISO 639-1 (`es`,`ca`) y `UNKNOWN` si no consta.
9. **Texto libre**: `soap`, `notes` y `reason` se conservan literales; extraer a campo tipado solo si hay evidencia explícita; la extracción LLM se registra con `extracted_by=llm:<modelo>` y confianza.

## 5. Duplicados y matching de pacientes

- **Clave fuerte**: microchip exacto (15 dígitos, sin espacios) → `match_key=mch_*`, `identity_confidence=1.0`, auto-merge.
- **Sin microchip**: blocking por `owner_id`+`species`+`lower(name)`; score = nombre Jaro-Winkler ≥0,92 (0,35) + `birth_date` exacta (0,35) + teléfono/email del tutor (0,20) + raza (0,10). ≥0,85 auto-link; 0,65–0,85 revisión manual; <0,65 no se fusiona.
- **Microchip enmascarado** (Kira, `9410000XXXXX207`): solo prefijo/sufijo → no es clave; confianza máxima 0,6 y revisión manual.
- **Sin microchip ni tutor identificable** (Luna): identidad provisional `identity_confidence=0.5`, `match_key=ext_MAS-0004587`, merge automático bloqueado y verificación en el check-in.
- **Nunca** se fusiona por nombre solo; si hay conflicto de campos gana el de mayor `confidence` y el perdedor queda en `field_provenance`.
- Un merge guarda `merged_from:[record_id]` (v1.1) y conserva los `source_ref` de ambas fuentes para auditoría.

## 6. Faltantes, ambigüedad y provenance

- `null` = no informado; `UNKNOWN` = informado como desconocido; `[]` = categoría no presente en la fuente. Nunca `""`, `"N/A"` ni `0` como ausencia.
- Toda entidad lleva `_meta` (Provenance) con `source_system`, `source_format`, `source_ref`, `extracted_at`, `extracted_by`, `reviewed_by`, `method` y `confidence`; los campos derivados, cruzados o asumidos llevan además `field_provenance`.
- Confianza: `1.0` exacto · `0.9–0.95` normalizado · `0.7–0.8` derivado o cross-sheet · `0.5–0.6` enmascarado o inferido. En total: **87 entradas de provenance a nivel de campo y 11 campos `assumed:true`** (fechas de mes, intervalo de 3 meses).
- Huecos por fuente: Word sin facturación/adjuntos y con meses sin día; Excel sin contacto/microchip y con snapshot de 8 días; JSON sin fechas de emisión, sin adjuntos binarios y con microchip enmascarado.
- El briefing muestra `data_freshness_days` y `data_gaps[]` para que el especialista sepa qué falta antes de ver al paciente.

## 7. Alertas del briefing pre-visita

| Regla | Disparador | Severidad |
|---|---|---|
| R01 | `Condition` ALLERGY/ADVERSE_REACTION activa (o flag HIGH) | CRITICAL/HIGH |
| R02 | `Condition` activa (no NUTRITION) | MEDIUM |
| R03 | `MedicationStatement` ACTIVE con fin ≤2 días o sin fecha | HIGH/MEDIUM |
| R04 | AINE terminado hace <30 días | INFO |
| R05 | cita/recordatorio ≤7 días | HIGH si vencida/hoy, MEDIUM si futura |
| R06 | BCS ≥6 o ≤3, o ±10% peso en 12 meses | MEDIUM/LOW |
| R07 | antiparasitario `OVERDUE` | HIGH (≤14 días: MEDIUM) |
| R08 | vacuna vence ≤30 días | MEDIUM (≤90: INFO); no dispara en los 3 casos |
| R09 | `identity_confidence<0.8`, `as_of` >7 días o faltan facturas/adjuntos | MEDIUM/LOW |
| R10 | flag de riesgo no cubierto por R01/R02 | INFO |
| R11 | negativo explícito (NKDA) | INFO |

- **Kira (7: 1 crítica, 3 altas, 1 media, 1 baja, 1 info)**: crítica «no administrar carprofeno» (vómitos 2024); altas tobramicina última dosis **hoy**, control ocular **hoy 14/11**, collar antiparasitario vencido **44 días**; media conjuntivitis OS; info hembra entera; baja microchip enmascarado.
- **Bruno (7: 2 altas, 3 medias, 1 baja, 1 info)**: altas alergia al pollo confirmada por reintroducción y desparasitación interna vencida **88 días**; medias cojera activa, control del 17/11 y sobrepeso BCS 6/9; info meloxicam terminado el 08/11; baja ficha Word incompleta.
- **Luna (8: 2 altas, 4 medias, 1 baja, 1 info)**: altas parásitos vencidos **74 días** y revisión ótica vencida **1 día**; medias otitis, prurito, gotas hasta 16/11 y datos débiles (sin microchip, export de hace 8 días); baja sensibilidad digestiva; info NKDA.
- Orden determinista: severidad → `due_date` → `id`. El briefing renderiza como máximo 7 alertas y agrupa el resto; cada alerta enlaza a su evidencia (`source_ref`).
- Datos de facturación **no** entran en el briefing clínico: el saldo de 14,93 EUR de Luna solo es visible en el nivel 2 administrativo.

## 8. Dos niveles de acceso (RGPD)

| Nivel | Quién | Qué ve | Qué no ve |
|---|---|---|---|
| **Resumen no identificativo pre-aceptación** | Especialista que ha hecho match, antes de contratar | Especie, raza, edad en años, sexo/esterilización, peso y BCS, motivo de consulta, 2–3 alertas resumidas, urgencia, servicio propuesto y precio orientativo | Nombre y contacto del tutor, dirección, microchip/pasaporte completos, documentos, facturas, notas libres con nombres |
| **Historia completa post-aceptación** | Especialista contratado + clínica | Todo el registro canónico, documentos descargables, PII operativa (contacto, dirección), facturación de la visita | Datos de pago, historias de otras clínicas no vinculadas, consentimientos de marketing |

- PII: nombre/DNI/dirección/teléfono/email y fecha de nacimiento del tutor, microchip/pasaporte (identificadores), nombre del paciente + tutor (identificable), números de factura, texto libre con nombres.
- Seudonimización: `own_*`/`pat_*` con UUID; hash SHA-256 + salt por tenant para claves de match; PII cifrada en reposo (pgcrypto/Supabase Vault) en tabla separada; RLS por tenant y por contrato; log de accesos (actor, paciente, campos, timestamp) y permiso con caducidad al terminar el servicio.
- Consentimiento de recordatorios y marketing por separado (Word: sí recordatorios; JSON: `reminder_consent=true`, `marketing_consent=false`); retención y minimización según RGPD/LOPDGDD; por defecto se exporta seudonimizado.

## 9. Mapeador asistido y 4º caso CSV (prueba de robustez)

Para tabulares con columnas no vistas no se escribe un parser nuevo: el sistema **propone** el mapeo y el usuario **confirma**.

1. Detección de dialecto/encoding (`,`/`;`, BOM, saltos), perfilado de columnas (tipo, % nulos, cardinalidad, 3 muestras).
2. Propuesta por diccionario de sinónimos + fuzzy de cabeceras + embeddings (`peso_lb`→`Observation.kg` con `unit_original=lb`; `fecha_visita`→`Encounter.date`; `tx`→`MedicationStatement.drug_name_raw`; `alergias`→`Condition` ALLERGY).
3. UI de confirmación: campo canónico, transformación, confianza; <0,80 exige corrección manual; columnas no mapeadas van a `extra_fields` JSONB (no se descartan).
4. Dry-run de 20 filas, validación de tipos y fechas, e import con `source_ref=<fichero>#fila=N`; la plantilla se guarda por cliente/PMS y se reutiliza.
5. Cuarto fixture de prueba (no es uno de los 3 historiales): cabeceras `microchip;nombre;tutor;fecha_visita;peso_lb;motivo;tratamiento;alergias` → propuesta: `Patient.microchip`, `Patient.name`, `RelatedPerson.display_name`, `Encounter.date`, `Observation.kg` (26,4 lb→11,97 kg), `Encounter.reason`, `MedicationStatement.drug_name_raw`, `Condition(ALLERGY)`. Resultado esperado: 8/8 columnas propuestas, 2 con confianza <0,8 («tx», «alergias») que requieren confirmación; 0 pérdida de columnas.

## 10. Campos críticos, revisión humana y briefing determinista

- Umbrales: alergias/efectos adversos **0,95**; medicación y dosis **0,90**; microchip **1,0** (15 dígitos exactos, sin máscara).
- En los 3 registros hay **10 campos críticos detectados y 9 pendientes de revisión** (Kira 2, Bruno 4, Luna 3); `reviewed_by` queda `null` hasta que un veterinario confirma. El briefing no se publica con críticos pendientes.
- El briefing es **determinista**: plantilla (Jinja) sobre el canónico, mismo input → mismo output; las alertas se calculan por reglas SQL/Python, nunca por el LLM.
- El LLM solo se usa para **extraer texto libre** (SOAP, «Actuación/Tratamiento», Word narrativo): su salida entra con `extracted_by=llm:<modelo>`, `confidence` baja y revisión obligatoria si toca un campo crítico.

## 11. Contrato JSON (resumen)

```json
{
  "schema_version": "vetlink.record/1.0",
  "record_id": "vlr_<slug>",
  "generated_at": "2026-11-14T01:20:00+01:00",
  "as_of": "2026-11-14",
  "source": { "system": "str", "format": "JSON_API|DOCX|XLSX|CSV", "file": "str",
              "version": "str|null", "generated_at": "ts|null", "units": {}, "row_counts": {} },
  "privacy": { "classification": "PSEUDONYMIZED|IDENTIFIED_PII", "pii_present": false,
               "masked_fields": [], "pii_fields": [] },
  "identity": { "match_key": "str", "identity_confidence": 0.0, "status": "str",
                "basis": [], "notes": "str|null" },
  "patient": Patient, "owners": [RelatedPerson],
  "encounters": [Encounter], "problems": [Condition], "immunizations": [Immunization],
  "weights": [Observation], "prescriptions": [MedicationStatement],
  "parasite_control": [MedicationStatement], "reminders": [Task],
  "documents": [DocumentReference], "invoices": [Invoice], "alerts": [Alert],
  "briefing": { "headline": "str", "alert_counts": {}, "next_appointment": {},
                "priority_actions": [{"alert_id": "str", "severity": "enum", "action": "str"}] },
  "review": { "policy": "str", "critical_fields": [], "pending_review": 0, "reviewed_by": null },
  "fhir_profile": { "Patient": "Patient", "Owner": "RelatedPerson", "...": "..." },
  "provenance_summary": { "entities": 0, "fields_populated": 0, "provenance": {}, "alerts": {} },
  "_meta_entity": { "source_system": "str", "source_ref": "str", "extracted_at": "ts",
                    "extracted_by": "str", "reviewed_by": null, "method": "enum",
                    "confidence": 0.0, "assumed": false }
}
```

- `schema_version` semver: cambios aditivos → minor; renombrar/eliminar → major con migrador. En los JSON v1.0 las colecciones conservan los nombres antiguos (`problems`, `documents`) y `fhir_profile` documenta la equivalencia; v1.1 las renombra (`conditions`, `document_references`).
- `record_id` estable por paciente; `generated_at`/`as_of` siempre con zona; hash SHA-256 del JSON canónico para idempotencia (`etag`).

## 12. Qué demuestra esto al jurado

| Métrica | Resultado |
|---|---|
| Fuentes soportadas | 3 formatos (DOCX, XLSX de 13 hojas, JSON API) → 1 esquema |
| Entidades canónicas | 12 + Provenance embebida |
| Campos canónicos v1 | 163 (30 en Patient) |
| Normalización | 3 pacientes · 132 entidades · **1.785 campos poblados** |
| Volumen clínico | 26 encuentros · 19 vacunas · 21 pesos · 14 problemas · 11 prescripciones · 10 facturas |
| Trazabilidad | 100% entidades con `_meta` · **87** entradas campo a campo · **11** `assumed` · 100 `source_ref` únicos |
| Alertas | **22** (1 crítica, 7 altas, 8 medias, 3 bajas, 3 informativas), 100% con evidencia, 11 reglas |
| Tiempo | Manual estimado 40–50 min por lote (Word 20, Excel 12, JSON 8; 10–15 min/paciente) → generación <2 s + briefing legible en ~90 s |
| Validación | 3/3 `json.load` OK, integridad referencial y sumas de factura comprobadas |

- El especialista recibe el caso ya reconstruido: problemas, medicación, vencimientos y 2–3 acciones prioritarias con su fuente exacta.
- La trazabilidad permite responder «¿de dónde sale este dato?» en la demo: cada campo enlaza a `historial.json#/...`, `tabla3/fila7` o `Medicina_Preventiva!fila5`.

## 13. Ajustes v1.1 (red-team)

- **FHIR-inspired**: nombres canónicos alineados (Patient, Encounter, Condition, MedicationStatement, Immunization, Observation, DocumentReference, RelatedPerson, Task, Invoice, Alert) y `fhir_profile` 1:1 en cada JSON; los ejemplos v1.0 mantienen claves antiguas para no romper la validación y se renombran en v1.1.
- **Provenance** ampliada con `extracted_by` y `reviewed_by`; umbrales por campo crítico (alergia 0,95 · medicación/dosis 0,90 · microchip 1,0) y 9 críticos pendientes de revisión humana.
- **Resumen no identificativo pre-aceptación** y **historia completa post-aceptación** como dos vistas separadas del mismo registro (sección 8), con RLS y caducidad de permiso.
- **Mapeador asistido**: propuesta + confirmación humana para tabulares no vistos, plantilla reutilizable y 4º fixture CSV con cabeceras distintas (8/8 columnas propuestas, 2 a confirmar).
- **Briefing determinista**: plantilla sobre el canónico; el LLM solo extrae texto libre y su resultado entra marcado y sujeto a revisión.
- Riesgo abierto: renombrar colecciones en los JSON a mitad de hackathon exige tocar UI y contratos; se pospone a v1.1 y se mitiga con `fhir_profile`.
