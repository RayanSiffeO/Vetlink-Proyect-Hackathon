import json
import re
import unicodedata
import urllib.request
import urllib.error
from collections import Counter

from esquema_clinico import (
    ESQUEMA, DESTINOS_VALIDOS, GENERICOS, DESCARTAR,
    descomponer, aplicar_reglas,
)

OLLAMA_URL = "http://localhost:11434/api/chat"
MODELO_POR_DEFECTO = "llama3.2"
LOTE = 25   # columnas por consulta al LLM (los modelos pequeños fallan con listas largas)


class OllamaError(Exception):
    pass


# ---------------------------------------------------------------- Ollama

def _preguntar_ollama(mensajes, modelo, url):
    cuerpo = {
        "model": modelo, "stream": False, "format": "json",
        "options": {"temperature": 0}, "messages": mensajes,
    }
    req = urllib.request.Request(
        url, data=json.dumps(cuerpo).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read().decode("utf-8"))["message"]["content"]
    except (urllib.error.URLError, TimeoutError) as e:
        raise OllamaError(f"no se pudo contactar con Ollama ({e})")
    except (KeyError, ValueError) as e:
        raise OllamaError(f"respuesta inesperada de Ollama ({e})")


def _snake(texto):
    t = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", t).strip("_") or "campo"


def _prompt(lote, contexto):
    campos = "\n".join(f"- {s}.{c}: {d}" for s, cs in ESQUEMA.items() for c, d in cs.items())
    items = "\n".join(
        f"- {patron}: " + (", ".join(repr(m) for m in muestras) or "(vacio)")
        for patron, muestras in lote
    )
    return (
        "Se estan unificando historiales clinicos de pacientes veterinarios (animales de "
        "compania) que llegan de clinicas distintas. El objetivo es que un veterinario "
        "especialista que ve al paciente por primera vez entienda el caso.\n\n"
        "Para cada columna elige UNA opcion:\n"
        "1) un campo estandar de la lista de abajo (formato seccion.campo);\n"
        "2) DESCARTAR, si no encaja en ningun campo estandar o no aporta informacion clinica: "
        "datos personales o de contacto del tutor, facturacion, importes, seguros, "
        "identificadores internos, metadatos de exportacion, ficheros adjuntos, estados "
        "administrativos.\n\n"
        f"Campos estandar:\n{campos}\n\n"
        f"Todas las columnas de la tabla (para contexto): {', '.join(contexto)}\n\n"
        f"Columnas a clasificar, con valores de ejemplo:\n{items}\n\n"
        'Responde SOLO con un objeto JSON {"columna": "destino"} que incluya todas las '
        "columnas a clasificar, con el nombre de columna tal cual aparece arriba."
    )


def _validar_destino(d):
    if not isinstance(d, str):
        return None
    d = d.strip()
    if d.upper() == DESCARTAR:
        return DESCARTAR
    if d in DESTINOS_VALIDOS:
        return d
    if d.startswith("extra."):          # lo que no encaja en el esquema se descarta
        return DESCARTAR
    return None


def _muestras(plan, filas):
    """Hasta 3 valores distintos y no vacios por patron de columna."""
    out = {}
    for p in plan:
        lista = out.setdefault(p["patron"], [])
        for fila in filas:
            if len(lista) >= 3:
                break
            v = fila[p["i"]] if p["i"] < len(fila) else ""
            v = str(v).strip()
            if v and v[:60] not in lista:
                lista.append(v[:60])
    return out


def _clasificar_con_llm(pendientes, plan, filas, modelo, url):
    muestras = _muestras(plan, filas)
    patrones = list(dict.fromkeys(p["patron"] for p in pendientes))
    contexto = list(dict.fromkeys(p["patron"] for p in plan))
    for k in range(0, len(patrones), LOTE):
        lote = [(pt, muestras.get(pt, [])) for pt in patrones[k:k + LOTE]]
        mensajes = [
            {"role": "system", "content": "Eres un asistente experto en historiales clinicos veterinarios."},
            {"role": "user", "content": _prompt(lote, contexto)},
        ]
        try:
            mapa = json.loads(_preguntar_ollama(mensajes, modelo, url))
        except ValueError:
            raise OllamaError("Ollama no devolvio un JSON valido")
        if not isinstance(mapa, dict):
            raise OllamaError("Ollama no devolvio un objeto JSON")
        for p in pendientes:
            destino = _validar_destino(mapa.get(p["patron"]))
            if destino and p["destino"] is None:
                p["destino"], p["origen"] = destino, "llm"


# ---------------------------------------------------------------- planificacion

def _resolver_genericos(plan):
    """Columnas como 'tipo', 'estado' o 'fecha' se interpretan segun el resto de la tabla."""
    gen = [p for p in plan if p["destino"] is None and p["patron"] in GENERICOS]
    if not gen:
        return
    cuenta = Counter(
        p["destino"].split(".")[0] for p in plan
        if p["destino"] and p["destino"] != DESCARTAR and not p["destino"].startswith("clave.")
    )
    candidatas = set.intersection(*[set(GENERICOS[p["patron"]]) for p in gen])
    ordenadas = [s for s, _ in cuenta.most_common() if s in candidatas]
    if ordenadas:
        elegida = ordenadas[0]
    elif len(candidatas) == 1:
        elegida = next(iter(candidatas))
    else:
        return
    for p in gen:
        campo = GENERICOS[p["patron"]][elegida]
        p["destino"] = DESCARTAR if campo == DESCARTAR else f"{elegida}.{campo}"
        p["origen"] = "contexto"


def _resolver_identificadores(plan, filas):
    """identifiers.N.value: solo es microchip si identifiers.N.type lo dice."""
    for p in plan:
        if p["destino"] is None and p["patron"].endswith("identifiers.#.value"):
            tipo = next((q for q in plan if q["idx"] == p["idx"]
                         and q["patron"].endswith("identifiers.#.type")), None)
            valor = ""
            if tipo:
                valor = next((str(f[tipo["i"]]) for f in filas if tipo["i"] < len(f) and f[tipo["i"]]), "")
            es_chip = "chip" in valor.lower()
            p["destino"] = "paciente.microchip" if es_chip else DESCARTAR
            p["origen"] = "regla"


def planificar(cabecera, filas, usar_llm=True, modelo=MODELO_POR_DEFECTO, url=OLLAMA_URL):
    """Decide para cada columna: campo estandar, DESCARTAR o extra. Devuelve (plan, avisos)."""
    plan = []
    for i, c in enumerate(cabecera):
        patron, idx = descomponer(c)
        # raiz: lista de la que cuelgan los indices (p. ej. 'encounters'); vacia en tablas planas
        raiz = patron.split(".#")[0] if "#" in patron else ""
        plan.append({"i": i, "columna": c, "patron": patron, "idx": idx, "raiz": raiz,
                     "destino": None, "origen": None})

    # 1) reglas fijas (los datos personales nunca dependen del LLM ni se le envian)
    for p in plan:
        d = aplicar_reglas(p["patron"])
        if d:
            p["destino"], p["origen"] = d, "regla"
    _resolver_identificadores(plan, filas)

    # 2) nombres genericos segun el contexto de la tabla
    _resolver_genericos(plan)

    # 3) lo que sigue sin clasificar, al LLM
    avisos = []
    pendientes = [p for p in plan if p["destino"] is None]
    if pendientes and usar_llm:
        try:
            _clasificar_con_llm(pendientes, plan, filas, modelo, url)
        except OllamaError as e:
            avisos.append(f"Ollama no disponible ({e}).")

    # 4) lo que aun queda sin clasificar se descarta
    for p in plan:
        if p["destino"] is None:
            p["destino"] = DESCARTAR
            p["origen"] = "ambiguo" if p["patron"] in GENERICOS else "sin_clasificar"
    return plan, avisos


# ---------------------------------------------------------------- utilidades

def tiene_contenido_clinico(plan):
    return any(p["destino"] != DESCARTAR and not p["destino"].startswith("clave.") for p in plan)


def informe(plan, avisos):
    cons = [p for p in plan if p["destino"] != DESCARTAR]
    desc = [p for p in plan if p["destino"] == DESCARTAR and p["origen"] != "sin_clasificar"]
    sin = [p for p in plan if p["origen"] == "sin_clasificar"]
    n_desc = len(desc) + len(sin)
    pat = lambda lista: list(dict.fromkeys(p["patron"] for p in lista))
    lineas = [f"Columnas: {len(plan)} | conservadas: {len(cons)} | descartadas: {n_desc}"]
    lineas += [f"Aviso: {a}" for a in avisos]
    if sin:
        lineas.append("Sin clasificar (se DESCARTAN; si alguna es clinica, hay que anadir una regla):")
        lineas += [f"  - {x}" for x in pat(sin)]
    lineas.append("Descartadas (patrones):")
    por_origen = Counter(p["origen"] for p in desc)
    lineas += [f"  - {x}" for x in pat(desc)]
    lineas.append("  (por: " + ", ".join(f"{k}={v}" for k, v in por_origen.items()) + ")")
    return "\n".join(lineas)