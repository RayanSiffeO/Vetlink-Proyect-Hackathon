"""Convierte las filas ya clasificadas en registros para las 5 tablas del MVP.

Supuesto: cada fila de entrada es un paciente (o, en un CSV plano, una fila de la
tabla de ese paciente). Los IDs de paciente y visita se generan aqui (UUID).
"""
import re
import unicodedata
import uuid
from collections import Counter
from datetime import date

from esquema_clinico import DESCARTAR

# Columnas de cada tabla (sin los ids). Siempre se escriben todas, haya dato o no.
COLUMNAS = {
    "paciente": ["nombre", "especie", "raza", "sexo", "esterilizado", "fecha_nacimiento",
                 "edad", "color", "microchip", "peso_actual_kg", "condicion_corporal",
                 "alimentacion", "estilo_vida", "temperamento", "bozal",
                 "clinica", "veterinario_referencia"],
    "visita": ["fecha", "tipo", "motivo", "anamnesis", "exploracion", "diagnostico",
               "tratamiento", "proxima_cita", "temperatura_c", "frecuencia_cardiaca",
               "frecuencia_respiratoria", "peso_kg", "condicion_corporal"],
    "prueba": ["panel", "prueba", "resultado", "unidad", "referencia", "indicador"],
    "tratamiento": ["orden", "medicamento", "dosis", "indicacion", "duracion", "suspension"],
    "otros": ["seccion", "registro", "campo", "valor"],
}
IDS = {
    "paciente": ["paciente_id", "archivo"],
    "visita": ["visita_id", "paciente_id"],
    "prueba": ["paciente_id", "visita_id"],
    "tratamiento": ["paciente_id", "visita_id"],
    "otros": ["paciente_id", "visita_id"],
}
ORDEN_TABLAS = ["paciente", "visita", "prueba", "tratamiento", "otros"]

_EXPLORACION_EN_VISITA = {"temperatura_c", "frecuencia_cardiaca", "frecuencia_respiratoria",
                          "peso_kg", "condicion_corporal"}


# ---------------------------------------------------------------- conversiones
# Devuelven None si no pueden interpretar el valor (entonces va a 'otros' como texto).

def _plano(v):
    return unicodedata.normalize("NFKD", str(v)).encode("ascii", "ignore").decode().lower().strip()


def conv_fecha(v):
    t = str(v).strip()
    m = re.match(r"(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})", t)
    if m:
        a, mes, d = map(int, m.groups())
    else:
        m = re.match(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})", t)   # dia primero
        if not m:
            return None
        d, mes, a = map(int, m.groups())
        if a < 100:
            a += 2000 if a <= 30 else 1900
    try:
        return date(a, mes, d)
    except ValueError:
        return None


def conv_sexo(v):
    t = _plano(v)
    if re.search(r"hembra|female|\bfem", t) or t in {"h", "f"}:
        return "hembra"
    if re.search(r"macho|male|\bmasc", t) or t == "m":
        return "macho"
    return None


def conv_bool(v):
    t = _plano(v)
    if re.match(r"(no|sin|not|false|0|n|entero|entera|intact\w*)\b", t):
        return False
    if re.match(r"(si|yes|y|true|1|s|requiere|castrad\w*|esteriliz\w*|neutered|spayed|capad\w*|"
                r"ovariohisterectomi\w*)\b", t):
        return True
    return None


def conv_num(v):
    m = re.match(r"\s*(-?\d+(?:[.,]\d+)?)", str(v))
    return float(m.group(1).replace(",", ".")) if m else None


def conv_entero(v):
    n = conv_num(v)
    return None if n is None else int(round(n))


def conv_peso(v):
    """Devuelve kg. Acepta '4,5', '4.5 kg', '4500 g', '10 lb'. Un numero sin unidad
    mayor de 200 se interpreta como gramos."""
    m = re.match(r"\s*(-?\d+(?:[.,]\d+)?)\s*([a-zA-Z]*)", str(v))
    if not m:
        return None
    n, u = float(m.group(1).replace(",", ".")), m.group(2).lower()
    if u in ("", "kg", "kgs", "kilo", "kilos"):
        return round(n / 1000, 3) if (u == "" and n > 200) else n
    if u in ("g", "gr", "grs", "gramos"):
        return round(n / 1000, 3)
    if u in ("lb", "lbs"):
        return round(n * 0.45359, 2)
    return None


CONV = {
    ("paciente", "sexo"): conv_sexo,
    ("paciente", "esterilizado"): conv_bool,
    ("paciente", "bozal"): conv_bool,
    ("paciente", "fecha_nacimiento"): conv_fecha,
    ("paciente", "peso_actual_kg"): conv_peso,
    ("visita", "fecha"): conv_fecha,
    ("visita", "temperatura_c"): conv_num,
    ("visita", "frecuencia_cardiaca"): conv_entero,
    ("visita", "frecuencia_respiratoria"): conv_entero,
    ("visita", "peso_kg"): conv_peso,
}


def _poner(reg, tabla, campo, valor):
    """Guarda el valor convertido (el primero no vacio gana). False si no se pudo interpretar."""
    conv = CONV.get((tabla, campo))
    if conv:
        valor = conv(valor)
        if valor is None:
            return False
    reg.setdefault(campo, valor)
    return True


# ---------------------------------------------------------------- construccion

def _tabla(seccion, campo):
    if seccion in ("paciente", "origen"):
        return "paciente"
    if seccion == "visitas" or (seccion == "exploracion" and campo in _EXPLORACION_EN_VISITA):
        return "visita"
    if seccion == "pruebas":
        return "prueba"
    if seccion == "tratamientos":
        return "tratamiento"
    return "otros"      # alertas, prevencion, procedimientos, seguimiento, peso, notas, extra...


def _vkey(raiz, idx):
    """Identifica una visita dentro de una fila: ('encounters', (3,)) o ('', ()) en tablas planas."""
    return (raiz, idx[:1]) if raiz else ("", ())


def _lista(patron):
    """'encounters.#.lab.results.#.analyte' -> 'encounters.#.lab.results.#' (la lista de origen)."""
    return patron[:patron.rfind("#") + 1]


def _registro(lista, idx, n):
    """'problem.list.#' + (0,) -> 'problem.list.0'; en tablas planas, 'f<fila>'."""
    if not lista:
        return f"f{n}"
    it = iter(idx)
    return re.sub(r"#", lambda m: str(next(it)), lista)


def construir(plan, filas, archivo):
    """Devuelve {tabla: [dict, ...]} para paciente, visita, prueba, tratamiento y otros."""
    cons = [p for p in plan if p["destino"] != DESCARTAR]
    raices_visita = {p["raiz"] for p in cons
                     if _tabla(*p["destino"].split(".", 1)) == "visita"}

    pacientes, visitas = {}, {}
    ids_pac, ids_vis = {}, {}          # id de origen -> UUID (para unir filas del mismo paciente/visita)
    t = {"prueba": [], "tratamiento": [], "otros": []}

    def otros(pid, vid, seccion, registro, campo, valor):
        t["otros"].append({"paciente_id": pid, "visita_id": vid, "seccion": seccion,
                           "registro": registro, "campo": campo, "valor": str(valor)})

    for n, fila in enumerate(filas):
        celdas = []
        for p in cons:
            v = fila[p["i"]] if p["i"] < len(fila) else ""
            v = "" if v is None else str(v).strip()
            if v:
                celdas.append((p, v))
        if not celdas:
            continue

        # paciente: id de origen > microchip > una fila = un paciente
        clave = (next((("id", v) for p, v in celdas if p["destino"] == "clave.paciente_id"), None)
                 or next((("chip", v) for p, v in celdas if p["destino"] == "paciente.microchip"), None)
                 or ("fila", n))
        pid = ids_pac.setdefault(clave, uuid.uuid4())
        pac = pacientes.setdefault(pid, {"paciente_id": pid, "archivo": archivo})

        grupos, src_visita = {}, {}
        for p, v in celdas:
            seccion, campo = p["destino"].split(".", 1)
            if seccion == "clave":
                if campo == "visita_id":
                    src_visita[_vkey(p["raiz"], p["idx"])] = v
                continue
            tabla = _tabla(seccion, campo)
            if tabla == "paciente":
                if not _poner(pac, "paciente", campo, v):
                    otros(pid, None, "sin_interpretar", "0", f"paciente.{campo}", v)
                continue
            sub = seccion if tabla == "otros" else ""
            grupos.setdefault((tabla, sub, p["raiz"], p["idx"], _lista(p["patron"])), {}).setdefault(campo, v)

        en_fila = {}                   # visita (clave local) -> visita_id

        def visita(vk):
            if vk not in en_fila:
                s = src_visita.get(vk)
                vid = ids_vis.setdefault((pid, s), uuid.uuid4()) if s else uuid.uuid4()
                visitas.setdefault(vid, {"visita_id": vid, "paciente_id": pid})
                en_fila[vk] = vid
            return en_fila[vk]

        # primero las visitas, para poder enlazar el resto
        for (tabla, sub, raiz, idx, lista), campos in sorted(grupos.items(), key=lambda kv: kv[0][0] != "visita"):
            vk = _vkey(raiz, idx)
            if tabla == "visita":
                vid = visita(vk)
                for c, v in campos.items():
                    if not _poner(visitas[vid], "visita", c, v):
                        otros(pid, vid, "sin_interpretar", _registro(lista, idx, n),
                              f"visita.{c}", v)
                continue

            vid = None
            if (raiz and raiz in raices_visita) or vk in en_fila or vk in src_visita:
                vid = visita(vk)
            if tabla in ("prueba", "tratamiento"):
                t[tabla].append({"paciente_id": pid, "visita_id": vid, **campos})
            else:
                registro = _registro(lista, idx, n)
                for c, v in campos.items():
                    otros(pid, vid, sub, registro, c, v)

    return {"paciente": list(pacientes.values()), "visita": list(visitas.values()), **t}


def resumen(tablas):
    return ", ".join(f"{k}={len(tablas.get(k, []))}" for k in ORDEN_TABLAS)