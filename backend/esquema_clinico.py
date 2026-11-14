"""Esquema clínico unificado y reglas de descarte/mapeo de columnas."""
import re
import unicodedata

DESCARTAR = "DESCARTAR"

# seccion -> {campo: descripcion}. El orden de este diccionario es el orden de salida.
ESQUEMA = {
    "clave": {
        "paciente_id": "identificador interno del paciente (para enlazar tablas)",
        "visita_id": "identificador de la visita (para enlazar tablas)",
    },
    "paciente": {
        "nombre": "nombre del animal",
        "especie": "especie (perro, gato...)",
        "raza": "raza",
        "sexo": "sexo del animal",
        "esterilizado": "estado reproductivo (castrado/esterilizado o entero)",
        "fecha_nacimiento": "fecha de nacimiento del animal",
        "edad": "edad del animal",
        "color": "capa o color",
        "microchip": "numero de microchip",
        "peso_actual_kg": "peso actual en kg",
        "condicion_corporal": "condicion corporal actual (BCS)",
        "alimentacion": "dieta o alimentacion",
        "estilo_vida": "estilo de vida y actividad fisica",
        "temperamento": "caracter y manejo del animal",
        "bozal": "si requiere bozal",
    },
    "origen": {
        "clinica": "clinica o centro que aporta el historial",
        "veterinario_referencia": "veterinario de referencia",
    },
    "alertas": {
        "tipo": "tipo: alergia, alerta, problema activo, reaccion adversa",
        "descripcion": "descripcion de la alergia, alerta o problema",
        "estado": "estado (activo, resuelto...)",
        "gravedad": "gravedad",
        "fecha_inicio": "fecha de inicio",
        "fecha_resolucion": "fecha en que se resolvio",
    },
    "visitas": {
        "fecha": "fecha de la visita",
        "tipo": "tipo de visita",
        "motivo": "motivo de consulta",
        "anamnesis": "anamnesis / relato del tutor (S de SOAP)",
        "exploracion": "exploracion y hallazgos en texto (O de SOAP)",
        "diagnostico": "diagnostico o valoracion (A de SOAP)",
        "tratamiento": "actuacion y tratamiento en texto (P de SOAP)",
        "proxima_cita": "fecha o plan de la proxima cita",
    },
    "exploracion": {
        "tipo": "tipo de dato (constante, hallazgo...)",
        "parametro": "nombre del parametro (temperatura, FC, FR...)",
        "valor": "valor medido",
        "unidad": "unidad",
        "temperatura_c": "temperatura en grados C",
        "frecuencia_cardiaca": "frecuencia cardiaca (lpm)",
        "frecuencia_respiratoria": "frecuencia respiratoria (rpm)",
        "peso_kg": "peso en kg tomado en la visita",
        "condicion_corporal": "condicion corporal tomada en la visita",
    },
    "pruebas": {
        "panel": "panel o grupo de pruebas",
        "prueba": "nombre de la prueba o analito",
        "resultado": "resultado",
        "unidad": "unidad",
        "referencia": "rango de referencia",
        "indicador": "indicador normal/alto/bajo",
    },
    "tratamientos": {
        "orden": "numero de orden",
        "medicamento": "medicamento",
        "dosis": "dosis y pauta",
        "indicacion": "indicacion o pauta en texto",
        "duracion": "duracion",
        "suspension": "motivo de suspension del tratamiento",
    },
    "procedimientos": {
        "procedimiento": "cirugia o procedimiento realizado",
        "premedicacion": "premedicacion anestesica",
        "induccion": "induccion anestesica",
        "mantenimiento": "mantenimiento anestesico",
        "duracion_anestesia_min": "duracion de la anestesia en minutos",
        "asa": "clasificacion ASA (riesgo anestesico)",
        "complicaciones": "complicaciones anestesicas o quirurgicas",
    },
    "notas": {
        "seccion": "seccion de la nota (anamnesis, diagnostico...)",
        "texto": "texto de la nota clinica",
    },
    "prevencion": {
        "concepto": "vacuna, test o antiparasitario",
        "tipo": "tipo (vacuna, desparasitacion interna/externa...)",
        "fecha_ultima": "fecha de la ultima aplicacion",
        "fecha_proxima": "fecha de la proxima aplicacion",
        "lote": "lote del producto",
        "vencida": "indica si esta vencida o pendiente de renovar",
    },
    "peso": {
        "fecha": "fecha de la pesada",
        "peso_kg": "peso en kg",
        "condicion_corporal": "condicion corporal (BCS)",
    },
    "seguimiento": {
        "concepto": "revision o control pendiente",
        "fecha_prevista": "fecha prevista",
        "estado": "estado (pendiente, hecho...)",
    },
}

UNICAS = {"paciente", "origen"}          # una sola ficha por paciente
ORDEN_SECCIONES = list(ESQUEMA) + ["extra"]
DESTINOS_VALIDOS = {f"{s}.{c}" for s, cs in ESQUEMA.items() for c in cs}

# Nombres genericos que solo se entienden por el contexto de la tabla.
# nombre -> {seccion: campo | DESCARTAR}
_FECHA = {"visitas": "fecha", "peso": "fecha"}
_TIPO = {"alertas": "tipo", "visitas": "tipo", "prevencion": "tipo", "exploracion": "tipo"}
_ESTADO = {"alertas": "estado", "seguimiento": "estado", "visitas": DESCARTAR}
_DESC = {"alertas": "descripcion", "seguimiento": "concepto"}
_VALOR = {"exploracion": "valor", "pruebas": "resultado"}
_UNIDAD = {"exploracion": "unidad", "pruebas": "unidad"}
GENERICOS = {
    "fecha": _FECHA, "date": _FECHA, "tipo": _TIPO, "type": _TIPO,
    "estado": _ESTADO, "status": _ESTADO, "descripcion": _DESC,
    "concepto": {"prevencion": "concepto", "seguimiento": "concepto"},
    "valor": _VALOR, "value": _VALOR, "unidad": _UNIDAD, "unit": _UNIDAD,
}

# Reglas en orden: gana la primera que encaje. Se aplican al nombre normalizado
# (minusculas, sin acentos, separado por puntos, indices numericos como #).
_REGLAS = [
    # --- datos utiles que viven dentro de bloques que luego se descartan ---
    (r"\bclinic\.name\b|^(centro|clinica)$", "origen.clinica"),
    (r"\bveterinari[oa]\b.*\breferencia\b|\breferencia\b.*\bveterinari", "origen.veterinario_referencia"),
    # --- claves para enlazar tablas ---
    (r"\bid\b.*\b(visita|vis|visit|encounter)\b|\b(visita|visit|encounter)\b.*\bid\b", "clave.visita_id"),
    (r"\bid\b.*\b(mascota|paciente|animal|pet)\b|\b(mascota|paciente|animal|pet)\b.*\bid\b|\bpatient\.uuid\b", "clave.paciente_id"),
    # --- NO CLINICO: metadatos tecnicos de la exportacion ---
    (r"^meta\b|\b(export\w*|generated\w*|tenant|pseudonymized|encoding|api)\b", DESCARTAR),
    # --- NO CLINICO: ficheros adjuntos ---
    (r"\b(attachments?|adjuntos?|documentos?|filename|fichero|mime|bytes|tamano|file)\b", DESCARTAR),
    # --- NO CLINICO: datos personales y de contacto del tutor ---
    (r"\b(owner|tutor|cliente|client|propietari[oa]|dueno)\b", DESCARTAR),
    (r"\b(dni|nie|nif|apellidos?|profesion|direccion|domicilio|address|poblacion|municipio|"
     r"municipality|localidad|ciudad|postal|cp|telefono|tel|movil|phone|correo|email|mail|idioma|"
     r"language|contacto|consentimiento|consent|marketing|channel|canal|preferred)\b", DESCARTAR),
    # --- NO CLINICO: facturacion, pagos y seguros ---
    (r"\b(invoice|factura\w*|albaran|importe|precio|price|vat|iva|saldo|balance|account|pago|"
     r"payment|currency|moneda|sku|servicio|cantidad|qty|net|paid|total|seguro|mutua|poliza|"
     r"insur\w*|coverage|provider)\b|\bplan\.salud\b", DESCARTAR),
    # --- NO CLINICO: administrativo, identificadores internos y duplicados ---
    (r"\b(legacy|ficha|censo|pasaporte|passport|cartilla|registry|estimated|deceased|convivencia|"
     r"implantacion|etiquetas?|tags?|display\.name|via|route|score|scale|rx)\b|\bproduct\.ref\b", DESCARTAR),
    (r"\b(species|breed)\.code\b|\bgiven\.at\b|\bidentifiers\.#\.(type|registry|implanted\.on)\b", DESCARTAR),
    (r"\b(staff|profesional|professional|care\.team|linked)\b|(?<!primary\.)(?<!lesion\.)(?<!body\.)\blocation\b", DESCARTAR),
    (r"\bfecha(\.de)?\.(alta|exportacion)\b|\bhora\b", DESCARTAR),
    (r"^encounters\.#\.status$|^patient\.status$|^reminders\.#\.type$", DESCARTAR),
    (r"\bprocedures\b.*\bcode$|\bprescriptions\b.*\bstatus$", DESCARTAR),
    # --- paciente ---
    (r"\bvitals\b.*\bbcs\b", "exploracion.condicion_corporal"),
    (r"\bvitals\b.*\bweight\b", "exploracion.peso_kg"),
    (r"\bvitals\b.*\btemp\b", "exploracion.temperatura_c"),
    (r"\bvitals\b.*\bhr\b", "exploracion.frecuencia_cardiaca"),
    (r"\bvitals\b.*\brr\b", "exploracion.frecuencia_respiratoria"),
    (r"\bweights\b.*\bdate$", "peso.fecha"),
    (r"\bweights\b.*\bkg$", "peso.peso_kg"),
    (r"\bweights\b.*\bbcs$", "peso.condicion_corporal"),
    (r"^(patient\.)?(nombre|name)(\.(mascota|paciente|animal))?$|^mascota$", "paciente.nombre"),
    (r"\b(especie|species)\b", "paciente.especie"),
    (r"\b(raza|breed)\b", "paciente.raza"),
    (r"\b(neuter\w*|spay\w*|sterili[sz]ed|reproductive|reproductivo|esterilizad\w*|castrad\w*)\b", "paciente.esterilizado"),
    (r"^(patient\.)?(sexo|sex)$", "paciente.sexo"),
    (r"\b(nacimiento|birth\w*|dob)\b", "paciente.fecha_nacimiento"),
    (r"^(patient\.)?(edad|age)(\.(years|anos|months|meses))?$", "paciente.edad"),
    (r"\b(capa|coat|colou?r|pelaje|fur)\b", "paciente.color"),
    (r"\bmicrochip\b", "paciente.microchip"),
    (r"\b(diet|alimentacion|dieta)\b", "paciente.alimentacion"),
    (r"\b(lifestyle|estilo\.de\.vida)\b", "paciente.estilo_vida"),
    (r"\b(muzzle|bozal)\b", "paciente.bozal"),
    (r"\b(temperament|temperamento|caracter)\b", "paciente.temperamento"),
    (r"\bpeso\.actual\b|\bcurrent\.weight\b", "paciente.peso_actual_kg"),
    (r"\bcondicion\.corporal\b", "paciente.condicion_corporal"),
    (r"^(temperature|temperatura|temp)(\.(c|celsius|grados))?$", "exploracion.temperatura_c"),
    (r"^(heart\.rate|hr|frecuencia\.cardiaca|fc)(\.(bpm|lpm))?$", "exploracion.frecuencia_cardiaca"),
    (r"^(resp\w*\.rate|rr|frecuencia\.respiratoria|fr)(\.(rpm|bpm))?$", "exploracion.frecuencia_respiratoria"),
    (r"^((peso|weight)(\.(kg|kgs))?|kg)$", "exploracion.peso_kg"),
    (r"^bcs$", "peso.condicion_corporal"),
    # --- alertas y problemas ---
    (r"\balergias?\b|\ballerg(y|ies)\b", "alertas.descripcion"),
    (r"\bflags\b.*\btext$", "alertas.descripcion"),
    (r"\bflags\b.*\bseverity$", "alertas.gravedad"),
    (r"\bflags\b.*\bsince$", "alertas.fecha_inicio"),
    (r"\bflags\b", DESCARTAR),
    (r"\bproblem\.list\b.*\blabel$", "alertas.descripcion"),
    (r"\bproblem\.list\b.*\bcategory$", "alertas.tipo"),
    (r"\bproblem\.list\b.*\bstatus$", "alertas.estado"),
    (r"\bproblem\.list\b.*\bonset$", "alertas.fecha_inicio"),
    (r"\bproblem\.list\b.*\bresolved$", "alertas.fecha_resolucion"),
    # --- visitas ---
    (r"\bsoap\.s$", "visitas.anamnesis"),
    (r"\bsoap\.o$", "visitas.exploracion"),
    (r"\bsoap\.a$", "visitas.diagnostico"),
    (r"\bsoap\.p$", "visitas.tratamiento"),
    (r"^encounters\.#\.start$|^fecha\.visita$", "visitas.fecha"),
    (r"^encounters\.#\.type$|^(tipo\.visita|visit\.type)$", "visitas.tipo"),
    (r"^encounters\.#\.reason$|^(motivo|reason)$", "visitas.motivo"),
    (r"\bnext\.visit\b|\bproxima\.(cita|visita)\b", "visitas.proxima_cita"),
    (r"^(resumen\.)?diagnostico$|^diagnosis$", "visitas.diagnostico"),
    (r"^anamnesis$", "visitas.anamnesis"),
    (r"\bexploracion\b|\bhallazgos\b", "visitas.exploracion"),
    (r"^(actuacion|tratamiento)(\.|$)|\bactuacion\.tratamiento\b", "visitas.tratamiento"),
    # --- exploracion, pruebas y tratamientos ---
    (r"^(parametro|parameter)$", "exploracion.parametro"),
    (r"\bprocedures\b.*\bname$", "procedimientos.procedimiento"),
    (r"\bprocedures\b.*\bpremed$", "procedimientos.premedicacion"),
    (r"\bprocedures\b.*\binduction$", "procedimientos.induccion"),
    (r"\bprocedures\b.*\bmaintenance$", "procedimientos.mantenimiento"),
    (r"\bprocedures\b.*\bduration\.min$", "procedimientos.duracion_anestesia_min"),
    (r"\bprocedures\b.*\basa$", "procedimientos.asa"),
    (r"\bprocedures\b.*\bcomplications$", "procedimientos.complicaciones"),
    (r"\blab\.results\b.*\bpanel$", "pruebas.panel"),
    (r"\blab\.results\b.*\banalyte$", "pruebas.prueba"),
    (r"\blab\.results\b.*\bvalue$", "pruebas.resultado"),
    (r"\blab\.results\b.*\bunit$", "pruebas.unidad"),
    (r"\blab\.results\b.*\bref$", "pruebas.referencia"),
    (r"\blab\.results\b.*\bflag$", "pruebas.indicador"),
    (r"^(prueba|test)$", "pruebas.prueba"),
    (r"^(resultado|result)$", "pruebas.resultado"),
    (r"\bprescriptions\b.*\bdrug$", "tratamientos.medicamento"),
    (r"\bprescriptions\b.*\bdose$", "tratamientos.dosis"),
    (r"\bprescriptions\b.*\bdays$", "tratamientos.duracion"),
    (r"\bprescriptions\b.*\bstop\.reason$", "tratamientos.suspension"),
    (r"^orden$", "tratamientos.orden"),
    (r"^(indicacion|instruccion)$", "tratamientos.indicacion"),
    (r"^(duracion|duration)$", "tratamientos.duracion"),
    (r"^seccion$", "notas.seccion"),
    (r"^texto$", "notas.texto"),
    # --- medicina preventiva ---
    (r"^immunizations\.#\.vaccine$", "prevencion.concepto"),
    (r"^immunizations\.#\.batch$|^lote$", "prevencion.lote"),
    (r"^immunizations\.#\.given\.on$|\bultima\.(fecha|aplicacion)\b", "prevencion.fecha_ultima"),
    (r"^immunizations\.#\.due\.on$|\bproxima\.(fecha|aplicacion)\b", "prevencion.fecha_proxima"),
    (r"^parasite\.control\.#\.type$", "prevencion.tipo"),
    (r"^parasite\.control\.#\.product$", "prevencion.concepto"),
    (r"^parasite\.control\.#\.last\.given$", "prevencion.fecha_ultima"),
    (r"^parasite\.control\.#\.next\.due$", "prevencion.fecha_proxima"),
    (r"^parasite\.control\.#\.overdue$", "prevencion.vencida"),
    # --- seguimiento ---
    (r"^reminders\.#\.text$", "seguimiento.concepto"),
    (r"^reminders\.#\.due$|^fecha\.prevista$", "seguimiento.fecha_prevista"),
    (r"^reminders\.#\.status$", "seguimiento.estado"),
    # --- identificadores internos que quedan (ya se aplicaron las claves) ---
    (r"\b(id|uuid)\b", DESCARTAR),
]
REGLAS = [(re.compile(p), d) for p, d in _REGLAS]


def descomponer(columna):
    """'encounters.3.soap.S' -> ('encounters.#.soap.s', (3,))"""
    partes = str(columna).split(".")
    idx = tuple(int(p) for p in partes if p.isdigit())
    bruto = ".".join("#" if p.isdigit() else p for p in partes)
    t = unicodedata.normalize("NFKD", bruto).encode("ascii", "ignore").decode().lower()
    t = re.sub(r"[^a-z0-9#]+", ".", t).strip(".")
    return t, idx


def aplicar_reglas(patron):
    for rx, destino in REGLAS:
        if rx.search(patron):
            return destino
    return None