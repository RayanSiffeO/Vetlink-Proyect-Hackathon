#!/usr/bin/env python3
"""
Motor de importación y normalización de historias clínicas veterinarias.

Recibe archivos de distintas clínicas (DOCX, XLSX/XLSM/XLS, CSV/TSV/TXT, JSON, XML, SQLite/SQL),
cualquiera que sea su estructura, y los convierte a un modelo clínico canónico en SQLite.

    [Adaptador específico o genérico] -> [normalización] -> [ids internos] -> [fusión en SQLite]
                                                                         -> [exportación JSON / vistas]

Principios de diseño
  * La base SQLite es siempre la historia MAESTRA completa. Nada se borra al importar.
  * Cada paciente tiene un identificador interno universal; el id original de cada clínica se
    conserva en la tabla `id_externo` (clínica + sistema + id original -> id interno).
  * Importar es idempotente: cada registro hijo lleva una `clave` determinista; reimportar un
    archivo no duplica nada y archivos complementarios se suman.
  * Todo dato conserva su procedencia (importación, archivo, hoja/tabla y fila) y, cuando se
    normaliza, también el valor original. Las columnas no reconocidas se guardan en
    `campo_desconocido`; las ambigüedades y problemas quedan en `aviso`.
  * La minimización para el especialista se aplica SOLO sobre una copia exportada.

Uso:
    python unificar_historiales.py ficha.docx export.xlsx datos.csv --db vet.db --clinica CLINICA-X
    python unificar_historiales.py --db vet.db --paciente PAC-xxxx
    python unificar_historiales.py --db vet.db --exportar PAC-xxxx --minimizar
"""

# =====================================================================================
#  1. IMPORTS Y CONFIGURACIÓN
# =====================================================================================
import argparse
import copy
import csv
import hashlib
import json
import math
import numbers
import os
import re
import sqlite3
import sys
import unicodedata
import uuid
import xml.etree.ElementTree as ET
from collections import defaultdict
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path

import pandas as pd

VERSION_ESQUEMA = 2

# Formato de fecha por clínica para fechas con barras ("03/04/2024"): "dmy" | "mdy" | "ymd".
# Se puede ampliar en código, con --formato-fecha o con un fichero de configuración (--config).
FORMATO_FECHA_CLINICA = {}

NS_UUID = uuid.UUID("6f1c2b1e-5d3a-4c58-9f0e-3b7a1d2c9e41")      # espacio de nombres de ids internos
PREFIJO_ID = {"paciente": "PAC", "tutor": "TUT", "visita": "VIS", "personal": "PER"}

TABLAS = ["clinica", "personal", "tutor", "paciente", "visita", "medida", "problema",
          "tratamiento", "prueba", "vacuna", "parasitos", "recordatorio",
          "factura_linea", "documento"]

# Contexto de la importación en curso (archivo, clínica, formato de fecha) y destino de avisos.
_CTX = {"archivo": None, "clinica": None, "formato_fecha": None}
_AV = {"destino": []}


@contextmanager
def _contexto(**kw):
    previo = dict(_CTX)
    _CTX.update(kw)
    try:
        yield
    finally:
        _CTX.clear()
        _CTX.update(previo)


@contextmanager
def _destino(lista):
    previo = _AV["destino"]
    _AV["destino"] = lista
    try:
        yield
    finally:
        _AV["destino"] = previo


def _limpio(x):
    """Convierte cualquier valor a algo serializable en JSON estricto (sin NaN ni Infinity)."""
    if x is None or x is pd.NaT or x is pd.NA:
        return None
    if isinstance(x, dict):
        return {str(k): _limpio(v) for k, v in x.items()}
    if isinstance(x, (list, tuple, set)):
        return [_limpio(v) for v in x]
    if isinstance(x, (datetime, date)):                  # incluye pd.Timestamp
        return x.isoformat()
    if isinstance(x, bool):
        return x
    if isinstance(x, bytes):
        return x.decode("utf-8", "replace")
    if hasattr(x, "item") and not isinstance(x, (str, int, float)):      # escalares de numpy
        try:
            x = x.item()
        except Exception:
            return str(x)
    if isinstance(x, float):
        return x if math.isfinite(x) else None
    if isinstance(x, (int, str)):
        return x
    return str(x)


def aviso(codigo, mensaje, nivel="AVISO", **ctx):
    """Registra una advertencia asociada a la importación en curso."""
    ctx.setdefault("archivo", _CTX.get("archivo"))
    _AV["destino"].append({"nivel": nivel, "codigo": codigo, "mensaje": mensaje,
                           "contexto": _limpio(ctx)})


# =====================================================================================
#  2. ESQUEMA DE BASE DE DATOS (+ migración segura)
# =====================================================================================
ESQUEMA = """
CREATE TABLE IF NOT EXISTS clinica   (clinica_id TEXT PRIMARY KEY, nombre TEXT);
CREATE TABLE IF NOT EXISTS personal  (personal_id TEXT PRIMARY KEY, nombre TEXT, rol TEXT);
CREATE TABLE IF NOT EXISTS tutor (
    tutor_id TEXT PRIMARY KEY, nombre TEXT, poblacion TEXT, idioma TEXT,
    canal_contacto TEXT, acepta_recordatorios INTEGER, telefono TEXT, email TEXT,
    saldo_eur REAL);
CREATE TABLE IF NOT EXISTS paciente (
    paciente_id TEXT PRIMARY KEY, tutor_id TEXT, clinica_id TEXT, veterinario_id TEXT,
    nombre TEXT, especie TEXT, raza TEXT, sexo TEXT, esterilizado INTEGER,
    fecha_nacimiento TEXT, color TEXT, microchip TEXT, alimentacion TEXT,
    caracter TEXT, fuente TEXT);
CREATE TABLE IF NOT EXISTS visita (
    visita_id TEXT PRIMARY KEY, paciente_id TEXT, fecha TEXT, tipo TEXT, motivo TEXT,
    anamnesis TEXT, exploracion TEXT, diagnostico TEXT, plan TEXT,
    personal_id TEXT, total_eur REAL);
CREATE TABLE IF NOT EXISTS medida (          -- peso, BCS, temperatura, FC...
    paciente_id TEXT, visita_id TEXT, fecha TEXT, tipo TEXT, valor REAL, unidad TEXT);
CREATE TABLE IF NOT EXISTS problema (        -- problemas activos/resueltos y alertas
    paciente_id TEXT, etiqueta TEXT, categoria TEXT, estado TEXT, gravedad TEXT,
    inicio TEXT, fin TEXT);
CREATE TABLE IF NOT EXISTS tratamiento (
    visita_id TEXT, paciente_id TEXT, descripcion TEXT, dosis TEXT, dias INTEGER, estado TEXT);
CREATE TABLE IF NOT EXISTS prueba (
    visita_id TEXT, paciente_id TEXT, prueba TEXT, resultado TEXT, unidad TEXT,
    referencia TEXT, marca TEXT);
CREATE TABLE IF NOT EXISTS vacuna (
    paciente_id TEXT, vacuna TEXT, aplicada TEXT, proxima TEXT, proxima_aprox INTEGER, lote TEXT);
CREATE TABLE IF NOT EXISTS parasitos (
    paciente_id TEXT, tipo TEXT, producto TEXT, ultima TEXT, proxima TEXT);
CREATE TABLE IF NOT EXISTS recordatorio (
    paciente_id TEXT, concepto TEXT, fecha TEXT, estado TEXT);
CREATE TABLE IF NOT EXISTS factura_linea (
    visita_id TEXT, concepto TEXT, cantidad REAL, importe_eur REAL);
CREATE TABLE IF NOT EXISTS documento (visita_id TEXT, tipo TEXT, fichero TEXT);
"""
# ^ Es exactamente el esquema anterior: una base antigua sigue siendo válida y se migra al abrirla.

# Columnas añadidas por el esquema v2 (se aplican con ALTER TABLE, sin perder datos).
_PROVENIENCIA = [("import_id", "INTEGER"), ("origen_ref", "TEXT"), ("original", "TEXT")]
COLUMNAS_NUEVAS = {t: list(_PROVENIENCIA) for t in TABLAS}
for _t in ("problema", "tratamiento", "prueba", "vacuna", "parasitos", "recordatorio",
           "factura_linea", "documento", "medida"):
    COLUMNAS_NUEVAS[_t].append(("clave", "TEXT"))               # clave determinista (idempotencia)
COLUMNAS_NUEVAS["visita"].append(("fecha_hora", "TEXT"))        # fecha con hora y zona horaria
COLUMNAS_NUEVAS["personal"].append(("pendiente_identificacion", "INTEGER"))
COLUMNAS_NUEVAS["medida"] += [("valor_original", "REAL"), ("unidad_original", "TEXT"),
                              ("unidad_estado", "TEXT")]

TABLAS_CON_CLAVE = [t for t, cols in COLUMNAS_NUEVAS.items() if ("clave", "TEXT") in cols]

ESQUEMA_NUEVO = """
CREATE TABLE IF NOT EXISTS importacion (
    import_id INTEGER PRIMARY KEY AUTOINCREMENT, archivo TEXT, sha256 TEXT, formato TEXT,
    sistema TEXT, clinica_id TEXT, fecha_import TEXT);
CREATE TABLE IF NOT EXISTS id_externo (          -- correspondencia id original <-> id interno
    tipo TEXT NOT NULL, clinica_id TEXT NOT NULL, id_externo TEXT NOT NULL,
    id_interno TEXT NOT NULL, sistema TEXT, import_id INTEGER,
    PRIMARY KEY (tipo, clinica_id, id_externo));
CREATE INDEX IF NOT EXISTS ix_id_externo_interno ON id_externo(tipo, id_interno);
CREATE TABLE IF NOT EXISTS paciente_import (paciente_id TEXT, import_id INTEGER,
    PRIMARY KEY (paciente_id, import_id));
CREATE TABLE IF NOT EXISTS campo_desconocido (   -- columnas/campos que ningún alias reconoce
    id INTEGER PRIMARY KEY AUTOINCREMENT, import_id INTEGER, clinica_id TEXT, archivo TEXT,
    tabla_origen TEXT, fila INTEGER, campo_original TEXT, valor TEXT, paciente_id TEXT,
    entidad_probable TEXT, estado TEXT DEFAULT 'pendiente', clave TEXT UNIQUE);
CREATE TABLE IF NOT EXISTS aviso (
    aviso_id INTEGER PRIMARY KEY AUTOINCREMENT, import_id INTEGER, nivel TEXT, codigo TEXT,
    mensaje TEXT, contexto TEXT, fecha TEXT, clave TEXT UNIQUE);
""" + "\n".join(f"CREATE UNIQUE INDEX IF NOT EXISTS ux_{t}_clave ON {t}(clave);"
                for t in TABLAS_CON_CLAVE) + """
DROP VIEW IF EXISTS v_ultimo_peso;
-- Todas las pesadas de la fecha más reciente (no se oculta ninguna medición del mismo día).
CREATE VIEW v_ultimo_peso AS
SELECT m.* FROM medida m
WHERE m.tipo='peso' AND m.fecha=(SELECT MAX(fecha) FROM medida
                                 WHERE paciente_id=m.paciente_id AND tipo='peso');
"""


def _uno(con, sql, params=()):
    cur = con.execute(sql, params)
    fila = cur.fetchone()
    return None if fila is None else dict(zip([d[0] for d in cur.description], fila))


def _todos(con, sql, params=()):
    cur = con.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, f)) for f in cur.fetchall()]


def inicializar_bd(con):
    """Crea o migra el esquema. Es seguro sobre bases antiguas: solo añade, nunca borra."""
    con.executescript(ESQUEMA)
    for tabla, cols in COLUMNAS_NUEVAS.items():
        existentes = {r[1] for r in con.execute(f"PRAGMA table_info({tabla})")}
        for col, tipo in cols:
            if col not in existentes:
                con.execute(f"ALTER TABLE {tabla} ADD COLUMN {col} {tipo}")
    con.executescript(ESQUEMA_NUEVO)
    if con.execute("PRAGMA user_version").fetchone()[0] < VERSION_ESQUEMA:
        _migrar_datos(con)


def _migrar_datos(con):
    """Datos de una base v1: ids existentes pasan a ser sus propios ids internos y se calculan
    las claves de idempotencia de los registros hijos. Una sola transacción."""
    con.execute("BEGIN IMMEDIATE")
    try:
        con.execute("""INSERT OR IGNORE INTO id_externo(tipo,clinica_id,id_externo,id_interno,sistema)
            SELECT 'paciente', COALESCE(clinica_id,'LEGACY'), paciente_id, paciente_id, 'legacy' FROM paciente""")
        con.execute("""INSERT OR IGNORE INTO id_externo(tipo,clinica_id,id_externo,id_interno,sistema)
            SELECT 'tutor', COALESCE((SELECT p.clinica_id FROM paciente p WHERE p.tutor_id=t.tutor_id LIMIT 1),'LEGACY'),
                   t.tutor_id, t.tutor_id, 'legacy' FROM tutor t""")
        con.execute("""INSERT OR IGNORE INTO id_externo(tipo,clinica_id,id_externo,id_interno,sistema)
            SELECT 'visita', COALESCE((SELECT p.clinica_id FROM paciente p WHERE p.paciente_id=v.paciente_id),'LEGACY'),
                   v.visita_id, v.visita_id, 'legacy' FROM visita v""")
        con.execute("""INSERT OR IGNORE INTO id_externo(tipo,clinica_id,id_externo,id_interno,sistema)
            SELECT 'personal', COALESCE(
                (SELECT p.clinica_id FROM paciente p WHERE p.veterinario_id=s.personal_id LIMIT 1),
                (SELECT p.clinica_id FROM visita v JOIN paciente p USING(paciente_id)
                 WHERE v.personal_id=s.personal_id LIMIT 1), 'LEGACY'),
                s.personal_id, s.personal_id, 'legacy' FROM personal s""")
        for tabla in NK:                                     # claves de idempotencia de filas antiguas
            vistos = defaultdict(int)
            for fila in _todos(con, f"SELECT rowid AS _rid, * FROM {tabla} WHERE clave IS NULL ORDER BY rowid"):
                base = _h(_nk(tabla, fila))
                clave = _h(_nk(tabla, fila), vistos[base])
                vistos[base] += 1
                con.execute(f"UPDATE OR IGNORE {tabla} SET clave=? WHERE rowid=?", (clave, fila["_rid"]))
        vistos = defaultdict(int)
        for fila in _todos(con, "SELECT rowid AS _rid, * FROM medida WHERE clave IS NULL ORDER BY rowid"):
            base = _clave_medida(fila, 0)
            clave = _clave_medida(fila, vistos[base])
            vistos[base] += 1
            con.execute("UPDATE OR IGNORE medida SET clave=? WHERE rowid=?", (clave, fila["_rid"]))
        con.execute(f"PRAGMA user_version={VERSION_ESQUEMA}")
        con.execute("COMMIT")
    except BaseException:
        con.execute("ROLLBACK")
        raise


def conectar(db):
    """Abre la base (creándola o migrándola si hace falta). Modo autocommit: las transacciones
    se gestionan de forma explícita en guardar()."""
    con = sqlite3.connect(db, isolation_level=None)
    inicializar_bd(con)
    return con


def _campos_esquema():
    con = sqlite3.connect(":memory:", isolation_level=None)
    inicializar_bd(con)
    t = [r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")]
    out = {x: [c[1] for c in con.execute(f"PRAGMA table_info({x})")] for x in t}
    con.close()
    return out


CAMPOS = _campos_esquema()          # tabla -> columnas reales (solo para validar/insertar por nombre)

# Orden de campos con el que los adaptadores específicos entregan tuplas. Es un contrato propio
# del paquete de importación, INDEPENDIENTE del esquema SQL: cambiar el SQL no altera la
# normalización. Los campos finales son opcionales (una tupla corta se completa con None).
ORDEN_PAQUETE = {
    "clinica": ["clinica_id", "nombre"],
    "personal": ["personal_id", "nombre", "rol", "pendiente_identificacion"],
    "tutor": ["tutor_id", "nombre", "poblacion", "idioma", "canal_contacto",
              "acepta_recordatorios", "telefono", "email", "saldo_eur"],
    "paciente": ["paciente_id", "tutor_id", "clinica_id", "veterinario_id", "nombre", "especie",
                 "raza", "sexo", "esterilizado", "fecha_nacimiento", "color", "microchip",
                 "alimentacion", "caracter", "fuente"],
    "visita": ["visita_id", "paciente_id", "fecha", "tipo", "motivo", "anamnesis", "exploracion",
               "diagnostico", "plan", "personal_id", "total_eur", "fecha_hora"],
    "medida": ["paciente_id", "visita_id", "fecha", "tipo", "valor", "unidad", "unidad_asumida"],
    "problema": ["paciente_id", "etiqueta", "categoria", "estado", "gravedad", "inicio", "fin"],
    "tratamiento": ["visita_id", "paciente_id", "descripcion", "dosis", "dias", "estado"],
    "prueba": ["visita_id", "paciente_id", "prueba", "resultado", "unidad", "referencia", "marca"],
    "vacuna": ["paciente_id", "vacuna", "aplicada", "proxima", "proxima_aprox", "lote"],
    "parasitos": ["paciente_id", "tipo", "producto", "ultima", "proxima"],
    "recordatorio": ["paciente_id", "concepto", "fecha", "estado"],
    "factura_linea": ["visita_id", "concepto", "cantidad", "importe_eur"],
    "documento": ["visita_id", "tipo", "fichero"],
}
IDS = {"paciente_id", "tutor_id", "visita_id", "personal_id", "clinica_id", "veterinario_id", "microchip"}
FKS = {"paciente_id", "visita_id", "tutor_id", "clinica_id", "personal_id"}


# =====================================================================================
#  3. FUNCIONES AUXILIARES (texto, booleanos, números, unidades, fechas)
# =====================================================================================
MESES = {m: i for i, m in enumerate(
    ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
     "septiembre", "octubre", "noviembre", "diciembre"], 1)}


def _h(*partes):
    return hashlib.sha1(json.dumps(partes, default=str, ensure_ascii=False).encode("utf-8")).hexdigest()


def _clave(s):
    """'Fecha de Nacimiento' -> 'fecha_de_nacimiento' (minúsculas, sin tildes, con _)."""
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def _nada(v):
    """None para nulos de pandas/numpy, NaT, NaN y cadenas vacías."""
    if v is None or v is pd.NaT or v is pd.NA:
        return None
    try:
        if pd.isna(v):
            return None
    except (TypeError, ValueError):
        pass
    return None if isinstance(v, str) and v.strip() == "" else v


def _id_texto(v):
    v = _nada(v)
    if v is None:
        return None
    if isinstance(v, numbers.Real) and not isinstance(v, bool) and float(v).is_integer():
        v = int(v)
    return str(v).strip()


_VERDAD = {"true", "1", "si", "sí", "s", "yes", "y", "x", "verdadero"}
_FALSO = {"false", "0", "no", "n", "falso"}


def _bool(v, campo=None):
    """Tres estados: 1 (verdadero), 0 (falso) y None (desconocido). Un valor no reconocido
    NUNCA se convierte en falso: queda desconocido y genera un aviso."""
    v = _nada(v)
    if v is None:
        return None
    if pd.api.types.is_bool(v):
        return int(bool(v))
    if isinstance(v, numbers.Real):
        if v == 1:
            return 1
        if v == 0:
            return 0
        aviso("BOOLEANO_DESCONOCIDO", f"Valor lógico no reconocido {v!r}; se deja como desconocido.",
              campo=campo, valor=v)
        return None
    s = str(v).strip().lower()
    if s in _VERDAD:
        return 1
    if s in _FALSO:
        return 0
    try:
        f = float(s.replace(",", "."))
        if f in (0.0, 1.0):
            return int(f)
    except ValueError:
        pass
    tok = re.split(r"[\s,;:(.\-]+", s)[0]
    if tok in ("si", "sí", "yes", "true"):
        return 1
    if tok in ("no", "false") and not re.search(r"consta|sabe|know|desconoc|proced|aplica", s):
        return 0
    aviso("BOOLEANO_DESCONOCIDO", f"Valor lógico no reconocido {v!r}; se deja como desconocido.",
          campo=campo, valor=str(v))
    return None


def _esterilizado_de_texto(texto):
    """Solo se afirma si el texto lo dice; si no, queda desconocido (None)."""
    t = _clave(texto or "")
    if re.search(r"no_(esteril|castr)|entero|intacto|intact", t):
        return 0
    if re.search(r"castr|esteril|neutered|spayed", t):
        return 1
    return None


def numero(texto):
    """'32,4 kg' -> 32.4 ; '1.234,5' -> 1234.5 ; None si no hay número."""
    if texto is None or isinstance(texto, bool):
        return None
    if isinstance(texto, numbers.Real):
        f = float(texto)
        return f if math.isfinite(f) else None
    m = re.search(r"-?\d+(?:[.,]\d+)*", str(texto))
    if not m:
        return None
    tok = m.group(0)
    if "." in tok and "," in tok:
        dec = "." if tok.rfind(".") > tok.rfind(",") else ","
        tok = tok.replace("," if dec == "." else ".", "").replace(dec, ".")
    elif tok.count(",") > 1:
        tok = tok.replace(",", "")
    elif tok.count(".") > 1:
        tok = tok.replace(".", "")
    else:
        tok = tok.replace(",", ".")
    try:
        return float(tok)
    except ValueError:
        return None


def dias(texto):
    m = re.search(r"(\d+)\s*d", str(texto or ""))
    return int(m.group(1)) if m else None


def _num_o_none(v):
    v = _nada(v)
    return None if v is None else numero(v)


# ---------------------------------------------------------------- unidades
CANONICA = {"peso": "kg", "temperatura": "°C", "fc": "lpm", "fr": "rpm", "bcs": "/9"}
_ALIAS_UNIDAD = {
    "kg": "kg", "kgs": "kg", "kilo": "kg", "kilos": "kg", "kilogramo": "kg", "kilogramos": "kg",
    "lb": "lb", "lbs": "lb", "libra": "lb", "libras": "lb", "pound": "lb", "pounds": "lb",
    "g": "g", "gr": "g", "gramo": "g", "gramos": "g",
    "c": "C", "celsius": "C", "centigrados": "C", "f": "F", "fahrenheit": "F",
    "lpm": "lpm", "bpm": "lpm", "rpm": "rpm", "/9": "/9", "bcs": "/9",
}
_CONVERSIONES = {
    ("peso", "kg"): lambda v: v,
    ("peso", "lb"): lambda v: round(v * 0.45359237, 3),
    ("peso", "g"): lambda v: round(v / 1000, 3),
    ("temperatura", "C"): lambda v: v,
    ("temperatura", "F"): lambda v: round((v - 32) * 5 / 9, 2),
    ("fc", "lpm"): lambda v: v, ("fr", "rpm"): lambda v: v, ("bcs", "/9"): lambda v: v,
}


def _alias_unidad(u):
    s = str(u).strip().lower().replace("°", "").replace("º", "").replace("grados", "").replace(" ", "")
    return _ALIAS_UNIDAD.get(s)


def convertir_unidad(tipo, valor, unidad, asumida=False):
    """-> (valor_canónico, unidad_canónica, estado, unidad_original).
    estado: original | convertida | asumida_plantilla | desconocida.
    Si la unidad no se conoce no se inventa ni se convierte nada."""
    canon = CANONICA.get(tipo)
    u_orig = None if _nada(unidad) is None else str(unidad).strip()
    if canon is None:
        return valor, u_orig, "original", u_orig
    if not u_orig:
        if tipo in ("fc", "fr", "bcs"):                  # escalas sin conversión posible
            return valor, canon, "original", None
        return valor, None, "desconocida", None
    u = _alias_unidad(u_orig)
    fn = _CONVERSIONES.get((tipo, u))
    if fn is None:
        return valor, None, "desconocida", u_orig
    nuevo_valor = fn(valor)
    if asumida:
        return nuevo_valor, canon, "asumida_plantilla", u_orig
    return nuevo_valor, canon, ("original" if nuevo_valor == valor and canon.lstrip("°") == u
                                or canon == u_orig else "convertida"), u_orig


def _split_valor_unidad(celda):
    """'32,4 kg' -> (32.4, 'kg') ; '6/9' -> (6.0, '/9') ; 38.5 -> (38.5, None)."""
    celda = _nada(celda)
    if celda is None:
        return None, None
    if not isinstance(celda, str):
        return numero(celda), None
    m = re.match(r"^\s*(-?[\d.,]+)\s*(.*)$", celda)
    if not m:
        return None, None
    rest = m.group(2).strip()
    unidad = re.split(r"[\s(]", rest)[0] if rest else None
    return numero(m.group(1)), (unidad or None)


def _unidad_de_columna(col):
    m = re.search(r"(?:^|_)(kg|kgs|lb|lbs|g|c|f|celsius|fahrenheit|bpm|lpm|rpm)$", col)
    return m.group(1) if m else None


def normalizar_medida(f):
    """Dict de medida del paquete -> dict canónico con valor/unidad originales y estado."""
    v = _num_o_none(f.get("valor"))
    if v is None:
        return None
    tipo = f.get("tipo")
    valor, unidad, estado, u_orig = convertir_unidad(tipo, v, f.get("unidad"), bool(f.get("unidad_asumida")))
    if estado == "desconocida":
        aviso("UNIDAD_DESCONOCIDA",
              f"Medida '{tipo}' ({v}) con unidad no determinable ({u_orig!r}); se conserva sin convertir.",
              nivel="AVISO", tipo=tipo, valor=v, unidad=u_orig, origen_ref=f.get("_ref"))
    n = dict(f)
    n.update(valor=valor, unidad=unidad, valor_original=v, unidad_original=u_orig, unidad_estado=estado)
    return n


# ---------------------------------------------------------------- fechas
_RE_ISO = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?"
                     r"\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?$", re.I)
_RE_NUM = re.compile(r"^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})(?:[T\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$")
_RE_YMD = re.compile(r"^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$")
_RE_COMPACTA = re.compile(r"^(\d{4})(\d{2})(\d{2})$")
_RE_TXT = re.compile(r"^(?:(\d{1,2})\s+(?:de\s+)?)?([a-záéíóúñ]+)\.?,?\s+(?:de\s+)?(\d{4})$", re.I)


def _fr(**k):
    return {"iso": None, "hora": None, "tz": None, "precision": None, "motivo": None,
            "original": None, **k}


def _tz_texto(z):
    if not z:
        return None
    if z.upper() == "Z":
        return "+00:00"
    z = z.replace(":", "")
    return f"{z[:3]}:{z[3:5] or '00'}"


def _construir(y, m, d, hh, mi, ss, tz, original):
    try:
        f = date(int(y), int(m), int(d))
        if not 1900 <= f.year <= 2100:
            raise ValueError("año fuera de rango")
        hora = None
        if hh is not None:
            if not (0 <= int(hh) < 24 and 0 <= int(mi) < 60 and (ss is None or 0 <= int(ss) < 60)):
                raise ValueError("hora no válida")
            hora = f"{int(hh):02d}:{int(mi):02d}" + (f":{int(ss):02d}" if ss is not None else "")
    except ValueError as e:
        return _fr(original=original, precision="invalida", motivo=f"fecha no existente ({e})")
    return _fr(original=original, iso=f.isoformat(), hora=hora, tz=_tz_texto(tz), precision="exacta")


def parse_fecha(valor, formato=None):
    """Analiza una fecha y devuelve un dict {iso, hora, tz, precision, motivo, original}.
    precision: exacta | aproximada | ambigua | invalida.  None si el valor está vacío.
    Una fecha ambigua (03/04/2024 sin formato indicado) NO se interpreta: iso=None."""
    if valor is None or valor is pd.NaT or valor is pd.NA:
        return None
    if isinstance(valor, datetime):
        if pd.isna(valor):
            return None
        z = valor.strftime("%z")
        hora = valor.strftime("%H:%M:%S") if (valor.hour or valor.minute or valor.second) else None
        return _fr(original=valor, iso=valor.strftime("%Y-%m-%d"), hora=hora,
                   tz=f"{z[:3]}:{z[3:]}" if z else None, precision="exacta")
    if isinstance(valor, date):
        return _fr(original=valor, iso=valor.isoformat(), precision="exacta")
    if pd.api.types.is_bool(valor):
        return _fr(original=valor, precision="invalida", motivo="un valor lógico no es una fecha")
    if isinstance(valor, numbers.Real):
        x = float(valor)
        if math.isnan(x):
            return None
        return _serie_excel(x, valor)
    s = str(valor).strip()
    if not s:
        return None
    if re.fullmatch(r"\d{5}(\.\d+)?", s):
        return _serie_excel(float(s), valor)
    m = _RE_ISO.match(s)
    if m:
        y, mo, d, hh, mi, ss, tz = m.groups()
        return _construir(y, mo, d, hh, mi, ss, tz, valor)
    m = _RE_YMD.match(s) or _RE_COMPACTA.match(s)
    if m:
        return _construir(*m.groups(), None, None, None, None, valor)
    m = _RE_NUM.match(s)
    if m:
        a, b, y, hh, mi, ss = m.groups()
        a, b = int(a), int(b)
        orden = formato if formato in ("dmy", "mdy") else None
        if orden is None:
            if a > 12 and b <= 12:
                orden = "dmy"
            elif b > 12 and a <= 12:
                orden = "mdy"
            elif a == b:
                orden = "dmy"                  # igual en cualquier orden
            elif a <= 12 and b <= 12:
                return _fr(original=valor, precision="ambigua",
                           motivo="puede ser día/mes o mes/día; indique el formato de fecha de la clínica")
            else:
                return _fr(original=valor, precision="invalida", motivo="día y mes fuera de rango")
        d, mo = (a, b) if orden == "dmy" else (b, a)
        return _construir(y, mo, d, hh, mi, ss, None, valor)
    m = _RE_TXT.match(s)
    if m and m.group(2).lower() in MESES:
        d, mes, y = m.groups()
        r = _construir(y, MESES[mes.lower()], d or 1, None, None, None, None, valor)
        if r["precision"] == "exacta" and not d:
            r["precision"] = "aproximada"
        return r
    return _fr(original=valor, precision="invalida", motivo="formato de fecha no reconocido")


def _serie_excel(x, original):
    if not 20000 <= x < 80000:
        return _fr(original=original, precision="invalida", motivo="número fuera del rango de series de Excel")
    ts = (pd.Timestamp("1899-12-30") + pd.Timedelta(days=x)).round("s")
    hora = ts.strftime("%H:%M:%S") if abs(x - int(x)) > 1e-9 else None
    return _fr(original=original, iso=ts.strftime("%Y-%m-%d"), hora=hora, precision="exacta")


def _formato_actual():
    return _CTX.get("formato_fecha") or FORMATO_FECHA_CLINICA.get(_CTX.get("clinica"))


def _avisar_fecha(r, campo=None):
    cod = "FECHA_AMBIGUA" if r["precision"] == "ambigua" else "FECHA_INVALIDA"
    aviso(cod, f"Fecha {r['original']!r} {'ambigua' if cod == 'FECHA_AMBIGUA' else 'no válida'}: "
               f"{r['motivo']}. Se deja vacía y se conserva el valor original.",
          campo=campo, valor=r["original"])


def iso(valor, formato=None):
    """Fecha -> 'AAAA-MM-DD' o None. Fechas inválidas o ambiguas NO se modifican en silencio:
    devuelven None y registran un aviso con el valor original."""
    r = parse_fecha(valor, formato or _formato_actual())
    if r is None:
        return None
    if r["precision"] in ("ambigua", "invalida"):
        _avisar_fecha(r)
        return None
    return r["iso"]


def iso_es(valor):
    """Para los adaptadores específicos (plantillas españolas conocidas): dd/mm/aaaa por defecto."""
    return iso(valor, _formato_actual() or "dmy")


def fecha_aproximada(texto, formato=None):
    """'Mayo de 2027' -> ('2027-05-01', True).  '09/04/2024' -> ('2024-04-09', False)."""
    r = parse_fecha(texto, formato or _formato_actual() or "dmy")
    if r is None or r["precision"] in ("ambigua", "invalida"):
        if r is not None:
            _avisar_fecha(r)
        return None, False
    return r["iso"], r["precision"] == "aproximada"


def validar_microchip(valor):
    """ISO 11784/11785: 15 dígitos. Devuelve (válido, normalizado)."""
    if valor is None:
        return False, None
    d = re.sub(r"[\s.\-]", "", str(valor))
    return bool(re.fullmatch(r"\d{15}", d)), d


def dias_texto(texto):
    return dias(texto)


# =====================================================================================
#  4. ADAPTADORES ESPECÍFICOS (las tres plantillas de ejemplo)
#     Entregan tuplas con el orden de ORDEN_PAQUETE; las tuplas cortas se completan con None.
# =====================================================================================
def nuevo():
    d = {t: [] for t in TABLAS}
    d["_avisos"], d["_desconocidos"], d["_meta"] = [], [], {}
    return d


def cargar_json(ruta):
    with open(ruta, encoding="utf-8") as fh:
        d = json.load(fh)
    out = nuevo()
    p, o = d["patient"], d["owner"]
    pid, cl = p["legacy_ref"], d["_meta"]["tenant"]["clinic_code"]
    prim = next((s["staff_id"] for s in d["care_team"] if s["is_primary"]), None)

    especie = p.get("species") or p.get("species_code")
    if not especie:
        especie = "Canina"
        aviso("ESPECIE_ASUMIDA_PLANTILLA", "La plantilla JSON no indica la especie; se asume Canina "
              "según la plantilla de ejemplo.", nivel="INFO")

    out["clinica"].append((cl, d["_meta"]["tenant"]["clinic_name"]))
    out["personal"] += [(s["staff_id"], s["display"], s["role"]) for s in d["care_team"]]
    out["tutor"].append((o["uuid"], o["display_name"], o["municipality"], o["language"],
                         o["preferred_channel"], _bool(o["reminder_consent"], "reminder_consent"),
                         None, None, _num_o_none(o["account"]["balance"])))
    out["paciente"].append((pid, o["uuid"], cl, prim, p["name"], especie, p["breed"]["display"],
                            p["sex"], _bool(p["neutered"], "neutered"), iso_es(p["birth_date"]), p["coat"],
                            next((i["value"] for i in p["identifiers"] if i["type"] == "MICROCHIP"), None),
                            p["diet"], p["temperament"]["notes"], "json"))

    for f in p["flags"]:
        out["problema"].append((pid, f["text"], "ALERTA", "ACTIVO", f["severity"], iso_es(f["since"]), None))
    for pr in d["problem_list"]:
        out["problema"].append((pid, pr["label"], pr["category"], pr["status"], None,
                                iso_es(pr["onset"]), iso_es(pr.get("resolved"))))

    nombres = {"temp": ("temperatura", "°C", 1), "hr": ("fc", "lpm", 0), "rr": ("fr", "rpm", 0),
               "weight": ("peso", "kg", 1), "bcs": ("bcs", "/9", 0)}
    for e in d["encounters"]:
        vid, f = e["encounter_id"], iso_es(e["start"])
        s = e["soap"]
        out["visita"].append((vid, pid, f, e["type"], e["reason"], s["S"], s["O"], s["A"], s["P"],
                              e["staff_id"], _num_o_none(e["invoice"]["total"]), e["start"]))
        for k, (tipo, u, asumida) in nombres.items():
            if k in e["vitals"]:
                out["medida"].append((pid, vid, f, tipo, e["vitals"][k], u, asumida))
        for r in e.get("prescriptions", []):
            out["tratamiento"].append((vid, pid, r["drug"], r["dose"], r["days"], r["status"]))
        for r in e.get("lab_results", []):
            out["prueba"].append((vid, pid, r["analyte"], str(r["value"]), r["unit"], r["ref"], r["flag"]))
        for l in e["invoice"]["lines"]:
            out["factura_linea"].append((vid, l["description"], l["qty"], l["line_total"]))

    for v in d["immunizations"]:
        out["vacuna"].append((pid, v["vaccine"], iso_es(v["given_on"]), iso_es(v["due_on"]), 0, v["batch"]))
    for q in d["parasite_control"]:
        out["parasitos"].append((pid, "interna" if q["type"] == "ENDO" else "externa",
                                 q["product"], iso_es(q["last_given"]), iso_es(q["next_due"])))
    for w in d["weights"]:
        out["medida"].append((pid, None, iso_es(w["date"]), "peso", w["kg"], "kg", 0))
        out["medida"].append((pid, None, iso_es(w["date"]), "bcs", w["bcs"], "/9", 0))
    for r in d["reminders"]:
        out["recordatorio"].append((pid, r["text"], iso_es(r["due"]), r["status"]))
    for a in d["attachments"]:
        out["documento"].append((a["encounter_ref"], a["kind"], a["filename"]))
    return out


def cargar_xlsx(ruta):
    hojas = _leer_excel(ruta)
    out = nuevo()
    m, t = hojas["Mascota"].iloc[0], hojas["Tutor"].iloc[0]
    pid, cl = m["ID_MASCOTA"], m["CENTRO"]
    prof = _nada(m["ID_VETERINARIO_REFERENCIA"])
    sexo = str(m["SEXO"])

    out["clinica"].append((cl, cl))
    if prof is not None:                       # solo se conoce el identificador, no el nombre
        out["personal"].append((prof, None, "VET"))
    out["tutor"].append((m["ID_CLIENTE"], None, _nada(t["POBLACION"]), None, None, None, None, None,
                         _num_o_none(t["SALDO_PENDIENTE_EUR"])))
    out["paciente"].append((pid, m["ID_CLIENTE"], cl, prof, m["NOMBRE"], m["ESPECIE"], m["RAZA"],
                            sexo, _esterilizado_de_texto(sexo), iso_es(m["FECHA_NACIMIENTO"]),
                            m["COLOR"], None, None, None, "xlsx"))

    # alertas / problemas: se conserva también lo "Informativo" (estado INFORMATIVO)
    for _, r in hojas["Alertas_Problemas"].iterrows():
        out["problema"].append((pid, r["DESCRIPCION"], r["TIPO"], _nada(r["ESTADO"]), None, None, None))

    anam = hojas["Visita_Anamnesis"]
    expl = hojas["Visita_Exploracion"]
    for _, v in hojas["Historial_Visitas"].iterrows():
        vid = v["ID_VISITA"]
        a = anam[(anam.ID_VISITA == vid) & (anam.SECCION == "Anamnesis")]["TEXTO"]
        e = expl[(expl.ID_VISITA == vid) & (expl.TIPO == "Hallazgo")]
        total = hojas["Visita_Facturacion"].query("ID_VISITA == @vid and SERVICIO == 'TOTAL'")["IMPORTE_EUR"]
        out["visita"].append((vid, pid, iso_es(v["FECHA"]), v["TIPO_VISITA"], v["MOTIVO"],
                              a.iloc[0] if len(a) else None,
                              "; ".join(f"{r.PARAMETRO}: {r.VALOR}" for r in e.itertuples()) or None,
                              v["RESUMEN_DIAGNOSTICO"], None, v["ID_PROFESIONAL"],
                              _num_o_none(total.iloc[0]) if len(total) else None,
                              str(v["FECHA"]) if isinstance(v["FECHA"], (datetime, pd.Timestamp)) else None))
    tipos = {"Temperatura": ("temperatura", "°C"), "FC": ("fc", "lpm"),
             "FR": ("fr", "rpm"), "Peso": ("peso", "kg")}
    fechas_vis = {r.ID_VISITA: iso_es(r.FECHA) for r in hojas["Historial_Visitas"].itertuples()}
    for r in expl[expl.TIPO == "Constante"].itertuples():
        if r.PARAMETRO in tipos:
            k, u_defecto = tipos[r.PARAMETRO]
            u = _nada(getattr(r, "UNIDAD", None))
            out["medida"].append((pid, r.ID_VISITA, fechas_vis.get(r.ID_VISITA), k, numero(r.VALOR),
                                  u or u_defecto, 0 if u else 1))
    for r in hojas["Visita_Pruebas"].itertuples():
        out["prueba"].append((r.ID_VISITA, pid, r.PRUEBA, r.RESULTADO, None, None, None))
    for r in hojas["Visita_Tratamiento"].itertuples():
        out["tratamiento"].append((r.ID_VISITA, pid, r.INDICACION, None, dias(r.DURACION), None))
    for r in hojas["Visita_Facturacion"].itertuples():
        if r.SERVICIO != "TOTAL":
            out["factura_linea"].append((r.ID_VISITA, r.SERVICIO, r.CANTIDAD, r.IMPORTE_EUR))
    for r in hojas["Visita_Documentos"].itertuples():
        out["documento"].append((r.ID_VISITA, r.TIPO, r.NOMBRE_FICHERO))

    for r in hojas["Evolucion_Peso"].itertuples():
        out["medida"].append((pid, None, iso_es(r.FECHA), "peso", numero(r.PESO_KG), "kg", 0))
        out["medida"].append((pid, None, iso_es(r.FECHA), "bcs", numero(r.BCS), "/9", 0))
    for r in hojas["Medicina_Preventiva"].itertuples():
        if r.TIPO == "Vacuna":
            out["vacuna"].append((pid, r.CONCEPTO, iso_es(r.ULTIMA_APLICACION), iso_es(r.PROXIMA_FECHA), 0, None))
        else:
            out["parasitos"].append((pid, "interna" if "interna" in r.CONCEPTO else "externa",
                                     None, iso_es(r.ULTIMA_APLICACION), iso_es(r.PROXIMA_FECHA)))
    for r in hojas["Recordatorios"].itertuples():
        out["recordatorio"].append((pid, r.CONCEPTO, iso_es(r.FECHA_PREVISTA), r.ESTADO))
    return out


def cargar_docx(ruta):
    import docx
    doc, out = docx.Document(ruta), nuevo()

    def pares(tabla):                      # tabla de 4 columnas: etiqueta | valor | etiqueta | valor
        d = {}
        for fila in tabla.rows:
            c = [x.text.strip() for x in fila.cells]
            d[c[0]], d[c[2]] = c[1], c[3]
        return d

    ficha, tutor, pac = (pares(doc.tables[i]) for i in range(3))
    pid, tid = ficha["Nº de ficha"], "TUT-" + ficha["Nº de ficha"]
    cl = ficha["Clínica"].split(",")[0]
    vet = ficha["Veterinaria de referencia"]
    sexo = pac["Sexo"]

    out["clinica"].append((cl, ficha["Clínica"]))
    out["personal"].append((vet, vet, "VET"))          # aquí el identificador ES el nombre
    idioma = "ca" if "Catal" in tutor["Idioma preferido"] else "es"
    canal = "WHATSAPP" if "WhatsApp" in tutor["Contacto preferido"] else None
    out["tutor"].append((tid, tutor["Nombre y apellidos"],
                         tutor["Población / CP"].split("(")[0].strip(), idioma, canal,
                         _bool(tutor["Consentimiento recordatorios"], "consentimiento"),
                         tutor["Teléfono móvil"], tutor["Correo electrónico"], None))
    mc = pac["Nº de microchip"].split()
    out["paciente"].append((pid, tid, cl, vet, pac["Nombre"], pac["Especie"], pac["Raza"], sexo,
                            _esterilizado_de_texto(sexo), iso_es(pac["Fecha de nacimiento"].split()[0]),
                            pac["Capa / color"], mc[0] if mc else None, pac["Alimentación"], None, "docx"))

    # historial clínico
    ultima_visita, proxima_cita, usados = None, None, defaultdict(int)
    for fila in doc.tables[3].rows[1:]:
        f, motivo, expl, act, prox = (c.text.strip() for c in fila.cells)
        fi = iso_es(f)
        usados[fi] += 1
        vid = f"{pid}-{fi}" + (f"-{usados[fi]}" if usados[fi] > 1 else "")
        out["visita"].append((vid, pid, fi, None, motivo, None, expl, None, act, vet, None, None))
        kg = re.search(r"Peso: ([\d,\.]+) kg", expl)
        if kg:
            out["medida"].append((pid, vid, fi, "peso", numero(kg.group(1)), "kg", 0))
        bcs = re.search(r"Condici[oó]n corporal:?\s*(\d+(?:[.,]\d+)?)\s*/\s*9", expl)
        if bcs:                               # antes: valor y fecha escritos a mano en el código
            out["medida"].append((pid, vid, fi, "bcs", numero(bcs.group(1)), "/9", 0))
        out["tratamiento"].append((vid, pid, act, None, None, None))
        if fi and (ultima_visita is None or fi >= ultima_visita):
            ultima_visita, proxima_cita = fi, (prox, motivo)
    # recordatorio: solo la próxima cita de la ÚLTIMA visita, si trae fecha explícita (dd/mm/aaaa)
    if proxima_cita:
        m = re.search(r"\d{2}/\d{2}/\d{4}", proxima_cita[0])
        fm = iso_es(m.group()) if m else None
        if fm and ultima_visita and fm > ultima_visita:
            out["recordatorio"].append((pid, f"Control: {proxima_cita[1][:60]}", fm, "Pendiente"))

    # resumen de vacunación
    for fila in doc.tables[4].rows[1:]:
        c, ult, prox = (x.text.strip() for x in fila.cells)
        ult_f = iso_es(ult.split("(")[0].strip()) if re.search(r"\d", ult) else None
        prox_f, aprox = fecha_aproximada(prox, "dmy")
        if prox.lower().startswith("cada 3 meses") and ult_f:
            prox_f = (pd.Timestamp(ult_f) + pd.DateOffset(months=3)).strftime("%Y-%m-%d")
        if c.startswith("Desparasitación") or c.startswith("Antiparasitario"):
            out["parasitos"].append((pid, "interna" if "interna" in c else "externa", None, ult_f,
                                     prox_f if prox_f and prox_f[:2] == "20" else None))
        else:
            out["vacuna"].append((pid, c, ult_f, prox_f, int(aprox), None))

    # alertas (viñetas con negrita al principio)
    for p in doc.paragraphs:
        if p.runs and p.runs[0].bold and ":" in p.text:
            etiqueta, texto = p.text.split(":", 1)
            out["problema"].append((pid, f"{etiqueta.strip()}: {texto.strip()}", "ALERTA", "ACTIVO",
                                    None, None, None))
    return out


def _leer_excel(ruta):
    try:
        return pd.read_excel(ruta, sheet_name=None, dtype=object)
    except ImportError as e:
        raise ValueError(f"Falta una librería para leer '{ruta}' ({e}). Para .xls instale xlrd; "
                         f"para .xlsx/.xlsm, openpyxl.") from e


# =====================================================================================
#  5. ADAPTADORES GENÉRICOS (estructuras desconocidas)
# =====================================================================================
_ID_PAC = ["id_mascota", "legacy_ref", "patient_id", "id_paciente", "paciente_id", "n_ficha", "n_de_ficha",
           "no_de_ficha", "num_ficha", "ficha", "nhc", "pet_id", "id_animal", "animal_id"]
ALIAS = {   # entidad -> campo canónico -> nombres posibles (ya normalizados con _clave)
    "paciente": {
        "paciente_id": _ID_PAC + ["id", "uuid"],
        "tutor_id": ["id_cliente", "owner_id", "tutor_id", "id_tutor", "id_propietario", "client_id"],
        "clinica_id": ["centro", "clinica", "clinic", "clinic_code", "centre", "clinic_id", "clinica_id"],
        "veterinario_id": ["id_veterinario_referencia", "veterinario_referencia", "veterinario", "vet_id",
                           "primary_vet", "veterinaria_de_referencia"],
        "nombre": ["nombre", "name", "nom", "mascota", "pet_name", "nombre_mascota"],
        "especie": ["especie", "species", "espece", "species_code"],
        "raza": ["raza", "breed", "raca", "race", "breed_display"],
        "sexo": ["sexo", "sex", "sexe", "genero", "gender"],
        "esterilizado": ["esterilizado", "neutered", "castrado", "spayed", "castrat"],
        "fecha_nacimiento": ["fecha_nacimiento", "fecha_de_nacimiento", "birth_date", "birthdate", "dob",
                             "fecha_nac", "data_naixement"],
        "color": ["color", "coat", "capa", "capa_color", "pelaje", "pelatge"],
        "microchip": ["microchip", "chip", "n_microchip", "n_de_microchip", "no_de_microchip", "num_microchip"],
        "alimentacion": ["alimentacion", "diet", "dieta", "alimentacio"],
        "caracter": ["caracter", "temperament_notes", "comportamiento"],
    },
    "tutor": {
        "tutor_id": ["id_cliente", "owner_id", "tutor_id", "id_tutor", "id_propietario", "client_id", "id", "uuid"],
        "nombre": ["nombre_y_apellidos", "display_name", "owner_name", "nombre", "nom"],
        "poblacion": ["poblacion", "municipality", "city", "ciudad", "localidad", "municipi"],
        "idioma": ["idioma", "language", "idioma_preferido", "llengua"],
        "canal_contacto": ["canal_contacto", "preferred_channel", "contacto_preferido"],
        "acepta_recordatorios": ["acepta_recordatorios", "reminder_consent", "consentimiento_recordatorios"],
        "telefono": ["telefono", "telefono_movil", "phone", "movil", "mobile"],
        "email": ["email", "correo", "correo_electronico", "e_mail"],
        "saldo_eur": ["saldo_eur", "saldo_pendiente_eur", "saldo", "balance"],
    },
    "visita": {
        "visita_id": ["id_visita", "encounter_id", "visit_id", "visita_id", "id_encuentro", "id"],
        "paciente_id": _ID_PAC,
        "fecha": ["fecha", "fecha_visita", "start", "date", "visit_date", "data"],
        "tipo": ["tipo_visita", "type", "visit_type", "tipo"],
        "motivo": ["motivo", "reason", "motiu", "motivo_consulta", "chief_complaint"],
        "anamnesis": ["anamnesis", "soap_s", "subjective", "subjetivo"],
        "exploracion": ["exploracion", "soap_o", "objective", "objetivo", "hallazgos"],
        "diagnostico": ["diagnostico", "resumen_diagnostico", "soap_a", "assessment", "diagnosis"],
        "plan": ["plan", "soap_p", "tratamiento_pautado", "actuacion", "actuacion_tratamiento"],
        "personal_id": ["id_profesional", "staff_id", "profesional", "vet", "veterinario"],
        "total_eur": ["total_eur", "invoice_total", "total_factura"],
    },
    "problema": {
        "paciente_id": _ID_PAC,
        "etiqueta": ["etiqueta", "label", "problema", "descripcion", "text", "alerta"],
        "categoria": ["categoria", "category", "tipo"],
        "estado": ["estado", "status"],
        "gravedad": ["gravedad", "severity"],
        "inicio": ["inicio", "onset", "since", "desde"],
        "fin": ["fin", "resolved", "resuelto_el"],
    },
    "tratamiento": {
        "visita_id": ["id_visita", "encounter_id", "visit_id", "visita_id"],
        "paciente_id": _ID_PAC,
        "descripcion": ["descripcion", "drug", "medicamento", "farmaco", "indicacion", "tratamiento"],
        "dosis": ["dosis", "dose", "posologia"],
        "dias": ["dias", "days", "duracion", "duration"],
        "estado": ["estado", "status"],
    },
    "prueba": {
        "visita_id": ["id_visita", "encounter_id", "visit_id", "visita_id"],
        "paciente_id": _ID_PAC,
        "prueba": ["prueba", "analyte", "test", "analito", "parametro"],
        "resultado": ["resultado", "value", "result", "valor"],
        "unidad": ["unidad", "unit", "unitat"],
        "referencia": ["ref", "referencia", "reference", "rango_referencia", "reference_range"],
        "marca": ["flag", "marca"],
    },
    "vacuna": {
        "paciente_id": _ID_PAC,
        "vacuna": ["vacuna", "vaccine", "vacunacio", "concepto"],
        "aplicada": ["aplicada", "given_on", "ultima_aplicacion", "fecha_aplicacion", "fecha_vacunacion",
                     "ultima_fecha"],
        "proxima": ["proxima", "due_on", "proxima_fecha", "next_due_date", "proxima_aplicacion"],
        "lote": ["lote", "batch", "lot"],
    },
    "parasitos": {
        "paciente_id": _ID_PAC,
        "tipo": ["concepto", "tipo", "type"],
        "producto": ["producto", "product"],
        "ultima": ["ultima", "last_given", "ultima_aplicacion", "ultima_fecha"],
        "proxima": ["proxima", "next_due", "proxima_fecha"],
    },
    "recordatorio": {
        "paciente_id": _ID_PAC,
        "concepto": ["concepto", "text", "descripcion", "recordatorio"],
        "fecha": ["fecha_prevista", "due", "fecha", "fecha_aviso", "due_date"],
        "estado": ["estado", "status"],
    },
    "factura_linea": {
        "visita_id": ["id_visita", "encounter_id", "visit_id", "visita_id"],
        "concepto": ["servicio", "description", "concepto", "descripcion"],
        "cantidad": ["cantidad", "qty", "unidades"],
        "importe_eur": ["importe_eur", "line_total", "importe", "total"],
    },
    "documento": {
        "visita_id": ["id_visita", "encounter_id", "encounter_ref", "visit_id", "visita_id"],
        "tipo": ["tipo", "kind", "type"],
        "fichero": ["fichero", "filename", "nombre_fichero", "archivo", "file_name"],
    },
    "personal": {
        "personal_id": ["staff_id", "id_profesional", "personal_id", "id_veterinario"],
        "nombre": ["display", "nombre", "name"],
        "rol": ["role", "rol", "cargo"],
    },
}
for _e in ALIAS.values():                         # listas propias (no compartidas entre entidades)
    for _c in _e:
        _e[_c] = list(_e[_c])

VITALES = {"peso": (["peso", "peso_kg", "weight", "weight_kg", "kg", "pes"], "kg"),
           "temperatura": (["temperatura", "temp", "temperature"], "°C"),
           "fc": (["fc", "hr", "heart_rate", "frecuencia_cardiaca"], "lpm"),
           "fr": (["fr", "rr", "resp_rate", "frecuencia_respiratoria"], "rpm"),
           "bcs": (["bcs", "condicion_corporal", "body_condition"], "/9")}
PISTAS = {"paciente": r"pacient|mascot|patient|^pet", "tutor": r"tutor|owner|client|propiet",
          "visita": r"visit|encounter|consult|historial", "vacuna": r"vacun|immuniz|vaccin",
          "parasitos": r"parasit|desparas", "problema": r"problem|alert|flag",
          "recordatorio": r"record|remind", "factura_linea": r"factur|invoice|line",
          "documento": r"document|attach|adjunt", "tratamiento": r"tratam|treatment|prescri|medic",
          "prueba": r"prueba|lab|result", "personal": r"personal|staff|care_team"}
COMUNES = {"paciente_id", "visita_id", "tutor_id", "clinica_id", "personal_id", "fecha", "estado", "tipo",
           "nombre", "unidad", "concepto", "categoria", "descripcion"}
GENERICOS = {"tipo", "fecha", "estado", "nombre", "descripcion", "id", "uuid", "text", "status", "type",
             "date", "total", "valor", "value", "name", "categoria", "category", "data"}
FECHAS = {"fecha", "aplicada", "proxima", "inicio", "fin", "ultima", "fecha_nacimiento"}
NUMEROS = {"cantidad", "importe_eur", "saldo_eur", "total_eur"}
BOOLEANOS = {"esterilizado", "acepta_recordatorios"}
UMBRAL_ENTIDAD = 4.0


def incorporar_alias(entidad, campo, nombre_columna):
    """Añade (con prioridad) un alias al diccionario ALIAS: sirve para clasificar campos que
    estaban en `campo_desconocido`. Efecto en las importaciones siguientes."""
    if entidad not in ALIAS or campo not in ORDEN_PAQUETE[entidad]:
        raise ValueError(f"'{entidad}.{campo}' no existe en el modelo canónico")
    c = _clave(nombre_columna)
    ALIAS[entidad][campo] = [c] + [x for x in ALIAS[entidad].get(campo, []) if x != c]


def cargar_config(ruta):
    """JSON: {"alias": {"paciente": {"caracter": ["obs_sala"]}}, "formato_fecha": {"CLINICA": "dmy"}}"""
    with open(ruta, encoding="utf-8") as fh:
        cfg = json.load(fh)
    for ent, campos in cfg.get("alias", {}).items():
        for campo, nombres in campos.items():
            for n in reversed(nombres):
                incorporar_alias(ent, campo, n)
    for cl, fmt in cfg.get("formato_fecha", {}).items():
        if fmt not in ("dmy", "mdy", "ymd"):
            raise ValueError(f"Formato de fecha no válido para {cl}: {fmt}")
        FORMATO_FECHA_CLINICA[cl] = fmt


def _buscar(cols, alias):
    """Columna cuyo nombre coincide con un alias: exacta o, para alias no genéricos, como sufijo
    ('vitals_temp' ~ 'temp'). Los alias genéricos (nombre, id, tipo...) solo valen exactos."""
    for a in alias:
        if a in cols:
            return a
    for a in alias:
        if a in GENERICOS or len(a) < 3:
            continue
        for c in cols:
            if c.endswith("_" + a):
                return c
    return None


def _elegir_id(fila, nom, padre):
    cand = [k for k, v in fila.items() if _nada(v) is not None and
            (k in ("id", "uuid") or k.endswith(("_id", "_uuid")) or k.startswith("id_"))]
    if not cand:
        return padre
    for k in cand:
        if k in ("id", "uuid"):
            return fila[k]
    stem = re.sub(r"(es|s)$", "", nom.split(".")[-1].lower())[:4]
    for k in cand:
        if stem and stem in k:
            return fila[k]
    return fila[cand[0]]


def a_tablas(obj, nombre="raiz"):
    """JSON/XML (semiestructurado) -> {tabla: [filas planas]}. Los objetos anidados se aplanan
    (breed.display -> breed_display) y las listas pasan a ser tablas hijas que guardan el id de su padre."""
    tablas = {}

    def fila_de(d, nom, padre):
        fila, hijos = {}, []

        def plano(x, pref):
            for k, v in x.items():
                ruta = f"{pref}_{k}" if pref else str(k)
                if isinstance(v, dict):
                    plano(v, ruta)
                elif isinstance(v, list):
                    hijos.append((ruta, v))
                else:
                    fila[_clave(ruta)] = v
        plano(d, "")
        mi_id = _elegir_id(fila, nom, padre)
        fila["padre"] = padre
        tablas.setdefault(nom, []).append(fila)
        for ruta, lista in hijos:
            for x in lista:
                if isinstance(x, dict):
                    fila_de(x, f"{nom}.{_clave(ruta)}", mi_id)
                elif x is not None:
                    tablas.setdefault(f"{nom}.{_clave(ruta)}", []).append({"valor": x, "padre": mi_id})

    if isinstance(obj, list):
        for x in obj:
            if isinstance(x, dict):
                fila_de(x, nombre, None)
    elif isinstance(obj, dict):
        esc = {k: v for k, v in obj.items() if not isinstance(v, (dict, list))}
        if esc:
            fila_de(esc, nombre, None)
        for k, v in obj.items():
            if isinstance(v, dict):
                fila_de(v, _clave(k), None)
            elif isinstance(v, list):
                for x in v:
                    if isinstance(x, dict):
                        fila_de(x, _clave(k), None)
    return tablas


def _valor(campo, v, extra, columna=None):
    """Convierte el valor de una celda al tipo del campo canónico. Lo no interpretable queda
    como None (con aviso), nunca se inventa. Guarda detalles (hora, aproximación) en `extra`."""
    v = _nada(v)
    if v is None:
        return None
    if campo in IDS:
        return _id_texto(v)
    if campo in FECHAS:
        r = parse_fecha(v, _formato_actual())
        if r is None:
            return None
        if r["precision"] in ("ambigua", "invalida"):
            _avisar_fecha(r, campo)
            return None
        if r["precision"] == "aproximada":
            extra["_aprox"] = 1
        if r["hora"]:
            extra["_fecha_hora"] = f"{r['iso']}T{r['hora']}{r['tz'] or ''}"
        return r["iso"]
    if campo in NUMEROS:
        n = numero(v)
        if n is None:
            aviso("NUMERO_INVALIDO", f"Valor numérico no interpretable {v!r} en '{campo}'.", campo=campo,
                  valor=str(v))
        return n
    if campo in BOOLEANOS:
        return _bool(v, campo)
    if campo == "dias":
        n = int(v) if isinstance(v, numbers.Real) and not isinstance(v, bool) else dias(v)
        if n is None:
            aviso("NUMERO_INVALIDO", f"Duración no interpretable {v!r}.", campo=campo, valor=str(v))
        return n
    return v.strip() if isinstance(v, str) else v


def _pista_entidad(corto):
    """Entidad que sugiere el nombre de la tabla: gana la palabra que aparece más a la derecha
    ('Visita_Pruebas' son pruebas; 'Historial_Visitas' son visitas)."""
    mejor, pos = None, -1
    for ent, pat in PISTAS.items():
        for m in re.finditer(pat, corto):
            if m.end() > pos:
                mejor, pos = ent, m.end()
    return mejor


def _puntuar(cols, ent):
    usados, score, espec = {}, 0.0, 0
    for campo, al in ALIAS[ent].items():
        c = _buscar(cols, al)
        if not c:
            continue
        usados[campo] = c
        if campo in COMUNES:
            score += 0.5
        else:
            espec += 1
            score += 1.0 if c in GENERICOS else 2.0
    return score, espec, usados


def _compatibles(a, b):
    if {a, b} == {"vacuna", "parasitos"}:
        return True
    return a in ("paciente", "tutor", "personal") or b in ("paciente", "tutor", "personal")


def _clasificar_tabla(nombre, cols):
    """Puntúa cada entidad según columnas y nombre de la tabla. Devuelve (entidades, usados,
    puntuaciones, ambigua, candidatas). Si hay empate entre entidades incompatibles, no se
    clasifica arbitrariamente: ambigua=True."""
    corto = nombre.split(".")[-1].lower()
    pista = _pista_entidad(corto)
    cands = []
    for ent in ALIAS:
        score, espec, usados = _puntuar(cols, ent)
        es_pista = pista == ent
        if es_pista:
            score += 3
        nofk = [c for c in usados if c not in FKS]
        ok = score >= UMBRAL_ENTIDAD and (espec >= 1 or (es_pista and len(nofk) >= 3))
        if ent == "visita" and {"fecha", "motivo"} <= usados.keys():
            ok = True
        if ok:
            cands.append((score, ent, usados))
    cands.sort(key=lambda x: -x[0])
    elegidas, ambigua = [], False
    for s, e, u in cands:
        conflicto = [se for se, ee, _ in elegidas if not _compatibles(e, ee)]
        if not conflicto:
            elegidas.append((s, e, u))
        elif all(se - s >= 3 for se in conflicto):
            continue                                       # claramente subordinada a otra entidad
        else:
            ambigua = True
            break
    return ([e for _, e, _ in elegidas], {e: dict(u) for _, e, u in elegidas},
            {e: s for s, e, _ in elegidas}, ambigua, [e for _, e, _ in cands])


def _columnas_unicas(cols):
    vistos, out = {}, []
    for i, c in enumerate(cols):
        k = _clave(c) or f"col_{i}"
        if k in vistos:
            vistos[k] += 1
            k = f"{k}_{vistos[k]}"
        else:
            vistos[k] = 1
        out.append(k)
    return out


def mapear_tablas(tablas, origen):
    """{nombre: DataFrame|lista de dicts} -> paquete canónico (filas como dict, con procedencia).
    Cada tabla se clasifica por puntuación (columnas + nombre). Las columnas que ningún alias
    reconoce, o las tablas ambiguas/no reconocidas, se conservan en `_desconocidos`."""
    out = nuevo()
    ctx = {"clinica_id": None, "clinica": None}
    entidad_de = {}
    for nombre, datos in tablas.items():
        df = datos if isinstance(datos, pd.DataFrame) else pd.DataFrame(datos)
        if df.empty:
            continue
        originales = [str(c) for c in df.columns]
        cols = _columnas_unicas(originales)
        df = df.copy()
        df.columns = cols
        nom_orig = dict(zip(cols, originales))
        consumidas = {"padre"}
        for c in cols:                                   # clínica suelta en metadatos
            if re.search(r"clinic_(code|id)$", c) and ctx["clinica_id"] is None:
                ctx["clinica_id"] = _id_texto(df[c].iloc[0])
                consumidas.add(c)
            if re.search(r"clinic_name$", c) and ctx["clinica"] is None:
                ctx["clinica"] = _nada(df[c].iloc[0])
                consumidas.add(c)
        corto = nombre.split(".")[-1].lower()
        if _pista_entidad(corto) is None and re.search(r"clinic|centro", corto) and len(df) == 1:
            for c in cols:
                if c in ("id", "codigo", "code") and ctx["clinica_id"] is None:
                    ctx["clinica_id"] = _id_texto(df[c].iloc[0])
                    consumidas.add(c)
                if c in ("nombre", "name") and ctx["clinica"] is None:
                    ctx["clinica"] = _nada(df[c].iloc[0])
                    consumidas.add(c)

        entidades, usados, punt, ambigua, candidatas = _clasificar_tabla(nombre, cols)
        if ambigua:
            aviso("CLASIFICACION_AMBIGUA",
                  f"La tabla '{nombre}' encaja con varias entidades incompatibles ({', '.join(candidatas)}) "
                  f"con puntuación similar; no se clasifica y se conserva íntegra en campo_desconocido. "
                  f"Use incorporar_alias() o --config para resolverlo.", tabla=nombre, candidatas=candidatas)
            entidades, usados = [], {}

        # una misma columna no puede alimentar campos incompatibles de entidades distintas
        dueno = defaultdict(list)
        for ent in entidades:
            for campo, c in usados[ent].items():
                dueno[c].append((ent, campo))
        for c, lst in dueno.items():
            if len(lst) < 2:
                continue
            if all(campo in FKS for _, campo in lst) and c not in ("id", "uuid"):
                continue
            if {e for e, _ in lst} <= {"vacuna", "parasitos"}:
                continue
            orden = sorted(lst, key=lambda x: -punt[x[0]])
            ganador = orden[0] if punt[orden[0][0]] - punt[orden[1][0]] >= 0.5 else None
            if ganador is None:
                aviso("COLUMNA_AMBIGUA", f"La columna '{nom_orig[c]}' de '{nombre}' encaja en varias "
                      f"entidades ({', '.join(e for e, _ in lst)}); no se asigna y se conserva.",
                      tabla=nombre, columna=nom_orig[c])
            for ent, campo in lst:
                if (ent, campo) != ganador:
                    usados[ent].pop(campo)

        vit = {k: _buscar(cols, al) for k, (al, _) in VITALES.items()}
        fecha_col = _buscar(cols, ALIAS["visita"]["fecha"] + ["fecha_medicion", "fecha_medida"])
        hay_vitales = bool(fecha_col and any(vit.values()))
        pcol = _buscar(cols, _ID_PAC)
        n_vit = len([c for c in vit.values() if c])
        unidades_col = {}
        if hay_vitales:
            for k, col in vit.items():
                if not col:
                    continue
                esp = [c for c in cols if c in (f"{col}_unit", f"{col}_unidad", f"unidad_{col}", f"{k}_unit",
                                                f"{k}_unidad", f"unidad_{k}")]
                gen = [c for c in cols if c in ("unidad", "unit", "unidad_medida", "units")] if n_vit == 1 else []
                unidades_col[k] = (esp or gen or [None])[0]

        for ent in entidades:
            consumidas.update(usados[ent].values())
        if hay_vitales:
            consumidas.update(c for c in vit.values() if c)
            consumidas.update(c for c in unidades_col.values() if c)
            consumidas.add(fecha_col)
            if pcol:
                consumidas.add(pcol)
        entidad_de[nombre] = entidades
        parent = nombre.rsplit(".", 1)[0] if "." in nombre else None
        ent_padre = entidad_de.get(parent, [])

        sin_clasificar = [c for c in cols if c not in consumidas]
        for c in sin_clasificar:
            if entidades or hay_vitales:
                aviso("CAMPO_PENDIENTE_CLASIFICAR",
                      f"Campo '{nom_orig[c]}' de la tabla '{nombre}' sin clasificar; se conserva en "
                      f"campo_desconocido (puede incorporarse a ALIAS).", nivel="INFO", tabla=nombre,
                      campo=nom_orig[c])
        if not entidades and not hay_vitales and sin_clasificar and not ambigua:
            aviso("TABLA_NO_RECONOCIDA", f"Tabla '{nombre}' no reconocida; todo su contenido se conserva en "
                  f"campo_desconocido.", tabla=nombre, columnas=[nom_orig[c] for c in sin_clasificar])
        mejor_candidata = candidatas[0] if candidatas else None

        for i, fila_raw in enumerate(df.astype(object).to_dict("records")):
            num_fila = i + 1
            texto = " ".join(str(v) for v in fila_raw.values()).lower()
            padre_v = _id_texto(fila_raw.get("padre")) if "padre" in cols else None
            filas_ent, extra_ent = {}, {}
            for ent in entidades:
                if {"vacuna", "parasitos"} <= set(entidades) and (ent == "parasitos") != bool(
                        re.search(r"parasit|desparas|pulga|garrapat|\bendo\b|\becto\b", texto)):
                    continue
                if ent == "factura_linea" and re.search(
                        r"^\s*total\s*$", str(fila_raw.get(usados[ent].get("concepto")) or ""), re.I):
                    continue
                fila, extra, original = {}, {}, {}
                for campo in ORDEN_PAQUETE[ent]:
                    col = usados[ent].get(campo)
                    fila[campo] = _valor(campo, fila_raw.get(col), extra, col) if col else None
                    if col and (campo in FECHAS or campo in NUMEROS or campo in BOOLEANOS or campo == "dias") \
                            and _nada(fila_raw.get(col)) is not None:
                        original[campo] = str(_limpio(fila_raw.get(col)))
                if padre_v is not None:
                    if "paciente_id" in fila and fila["paciente_id"] is None and "paciente" in ent_padre:
                        fila["paciente_id"] = padre_v
                    if "visita_id" in fila and fila["visita_id"] is None and "visita" in ent_padre:
                        fila["visita_id"] = padre_v
                if ent == "vacuna":
                    fila["proxima_aprox"] = extra.get("_aprox", 0)
                if ent == "visita" and extra.get("_fecha_hora"):
                    fila["fecha_hora"] = extra["_fecha_hora"]
                fila["_ref"] = f"{nombre}#fila{num_fila}"
                fila["_original"] = original
                filas_ent[ent], extra_ent[ent] = fila, extra
            if "paciente" in filas_ent and "tutor" in filas_ent:       # fila desnormalizada
                pa, tu = filas_ent["paciente"], filas_ent["tutor"]
                if tu.get("tutor_id") is None and pa.get("paciente_id") is not None and \
                        any(v is not None for k, v in tu.items() if not k.startswith("_") and k != "tutor_id"):
                    tu["tutor_id"] = f"TUT-{pa['paciente_id']}"
                if pa.get("tutor_id") is None:
                    pa["tutor_id"] = tu.get("tutor_id")
            for ent, fila in filas_ent.items():
                if any(v is not None for k, v in fila.items() if not k.startswith("_")):
                    out[ent].append(fila)

            if hay_vitales:
                rf = _nada(fila_raw.get(fecha_col))
                r = parse_fecha(rf, _formato_actual())
                if r is not None and r["precision"] in ("ambigua", "invalida"):
                    _avisar_fecha(r, "fecha_medida")
                f = r["iso"] if r is not None and r["precision"] in ("exacta", "aproximada") else None
                vid = None
                if "visita" in entidades:
                    vcol = usados["visita"].get("visita_id")
                    vid = _id_texto(fila_raw.get(vcol)) if vcol else None
                pid = _id_texto(fila_raw.get(pcol)) if pcol else (padre_v if "paciente" in ent_padre else None)
                for k, col in vit.items():
                    if not col or _nada(fila_raw.get(col)) is None:
                        continue
                    celda = fila_raw.get(col)
                    val, u_celda = _split_valor_unidad(celda)
                    if val is None:
                        aviso("NUMERO_INVALIDO", f"Medida '{k}' no interpretable: {celda!r}.", tipo=k,
                              valor=str(celda))
                        continue
                    ucol = unidades_col.get(k)
                    u = u_celda or _unidad_de_columna(col) or (_nada(fila_raw.get(ucol)) if ucol else None)
                    out["medida"].append({
                        "paciente_id": pid, "visita_id": vid, "fecha": f, "tipo": k, "valor": val,
                        "unidad": u, "unidad_asumida": 0, "_ref": f"{nombre}#fila{num_fila}",
                        "_original": {"valor": str(_limpio(celda)),
                                      **({"fecha": str(_limpio(rf))} if rf is not None else {})}})

            # nada se descarta: lo que ninguna entidad consumió pasa a campo_desconocido
            for c in sin_clasificar:
                v = _nada(fila_raw.get(c))
                if v is not None:
                    pc = pcol if pcol else usados.get("paciente", {}).get("paciente_id")
                    out["_desconocidos"].append({
                        "tabla_origen": nombre, "fila": num_fila, "campo_original": nom_orig[c],
                        "valor": str(_limpio(v)), "entidad_probable": mejor_candidata,
                        "paciente_ext": _id_texto(fila_raw.get(pc)) if pc else (padre_v if "paciente" in ent_padre else None)})
    return completar(out, origen, ctx)


def completar(out, origen, ctx=None):
    """Rellena lo que una tabla suelta no trae: paciente único, clínica, ids de visita.
    No inventa profesionales: un id de profesional sin nombre se queda sin nombre."""
    ctx = ctx or {}
    pids = [f["paciente_id"] for f in out["paciente"] if f.get("paciente_id")]
    unico = pids[0] if len(set(pids)) == 1 else None
    for f in out["paciente"]:
        if f.get("clinica_id") is None:
            f["clinica_id"] = ctx.get("clinica_id")
        f["fuente"] = origen
    for f in out["visita"]:
        if f.get("paciente_id") is None and unico:
            f["paciente_id"] = unico
    vis_pac = {v["visita_id"]: v["paciente_id"] for v in out["visita"] if v.get("visita_id") and v.get("paciente_id")}
    for t in ("medida", "problema", "tratamiento", "prueba", "vacuna", "parasitos", "recordatorio"):
        for f in out[t]:
            if f.get("paciente_id") is None:
                f["paciente_id"] = vis_pac.get(f.get("visita_id")) or unico
    for d in out["_desconocidos"]:
        if d.get("paciente_ext") is None:
            d["paciente_ext"] = unico
    clinicas = {f["clinica_id"] for f in out["paciente"] if f.get("clinica_id")}
    for c in clinicas:
        out["clinica"].append({"clinica_id": c, "nombre": ctx.get("clinica") if c == ctx.get("clinica_id")
                               and ctx.get("clinica") else c, "_ref": "metadatos"})
    contador = defaultdict(int)
    for f in out["visita"]:
        if not f.get("visita_id"):
            k = (f.get("paciente_id"), f.get("fecha"))
            f["visita_id"] = f"{k[0]}-{k[1]}-{contador[k]}"
            contador[k] += 1
    if unico and len(out["tutor"]) == 1:                  # un solo paciente y un solo tutor: se enlazan
        t = out["tutor"][0]
        t["tutor_id"] = t.get("tutor_id") or f"TUT-{unico}"
        for p in out["paciente"]:
            p["tutor_id"] = p.get("tutor_id") or t["tutor_id"]
    conocidos = {f.get("personal_id") for f in out["personal"]}
    for pid in {f.get("personal_id") for f in out["visita"]} | {f.get("veterinario_id") for f in out["paciente"]}:
        if pid and pid not in conocidos:
            out["personal"].append({"personal_id": pid, "nombre": None, "rol": None, "_ref": "referencia"})
            conocidos.add(pid)
    return out


def _xml_a_obj(el):
    """Elemento XML -> dict/lista/texto (atributos y subelementos pasan a ser claves). Los
    hermanos con el mismo nombre se agrupan en una lista, también si el primero es ya una lista."""
    etiqueta = lambda e: e.tag.split("}")[-1]
    base = dict(el.attrib)
    hijos = list(el)
    if not hijos:
        txt = (el.text or "").strip()
        return {**base, "valor": txt} if base else txt
    listas = set()
    for h in hijos:
        t, v = etiqueta(h), _xml_a_obj(h)
        if t in listas:
            base[t].append(v)
        elif t in base:
            base[t] = [base[t], v]
            listas.add(t)
        else:
            base[t] = v
    if len(base) == 1:                                   # <visitas><visita/>..</visitas> -> lista
        (k, v), = base.items()
        if isinstance(v, list) and k in listas:
            return v
        if isinstance(v, dict) and _es_plural(etiqueta(el), k):
            return [v]
    return base


def _es_plural(contenedor, hijo):
    c, h = contenedor.lower(), hijo.lower()
    return h in ("item", "row", "registro", "fila", "entry", "record") or \
        (c.startswith(h) and len(c) - len(h) <= 2)


def cargar_csv(ruta):
    df = None
    for enc in ("utf-8-sig", "latin-1"):
        for kw in ({"sep": None, "engine": "python"}, {"sep": ","}):          # detecta , ; tab |
            try:
                df = pd.read_csv(ruta, encoding=enc, dtype=str, keep_default_na=False, na_values=[""], **kw)
                break
            except UnicodeDecodeError:
                break
            except (csv.Error, pd.errors.ParserError, pd.errors.EmptyDataError) as e:
                ultimo = e
                continue
        if df is not None:
            break
    if df is None:
        raise ValueError(f"No se pudo interpretar '{ruta}' como tabla delimitada.")
    return mapear_tablas({os.path.splitext(os.path.basename(ruta))[0]: df}, "csv")


def cargar_xml(ruta):
    raiz = ET.parse(ruta).getroot()
    nombre = raiz.tag.split("}")[-1]
    return mapear_tablas(a_tablas(_xml_a_obj(raiz), nombre), "xml")


def cargar_json_generico(ruta):
    with open(ruta, encoding="utf-8") as fh:
        return mapear_tablas(a_tablas(json.load(fh), os.path.splitext(os.path.basename(ruta))[0]), "json")


def cargar_sql(ruta):
    """Base SQLite (.db/.sqlite; se abre en solo lectura) o volcado .sql (se ejecuta en memoria).
    Cada tabla/vista se trata como una tabla de origen."""
    if ruta.lower().endswith(".sql"):
        con = sqlite3.connect(":memory:")
        with open(ruta, encoding="utf-8") as fh:
            con.executescript(fh.read())
    else:
        con = sqlite3.connect(Path(ruta).resolve().as_uri() + "?mode=ro", uri=True)
    nombres = [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'")]
    tablas = {n: pd.read_sql_query(f'SELECT * FROM "{n}"', con).astype(object) for n in nombres}
    con.close()
    return mapear_tablas(tablas, "sql")


def cargar_xlsx_generico(ruta):
    return mapear_tablas(_leer_excel(ruta), "xlsx")


def cargar_docx_generico(ruta):
    """Word con otra plantilla: tablas de 2 o 4 columnas = pares etiqueta/valor; el resto = cabecera + filas."""
    import docx
    tablas, fichas = {}, {}
    for i, t in enumerate(docx.Document(ruta).tables):
        filas = [[c.text.strip() for c in r.cells] for r in t.rows]
        if not filas:
            continue
        if len(filas[0]) in (2, 4):
            kv = {}
            for f in filas:
                for j in range(0, len(f) - 1, 2):
                    kv[f[j]] = f[j + 1]
            fichas[f"ficha_{i}"] = kv
        else:
            tablas[f"tabla_{i}"] = pd.DataFrame(filas[1:], columns=filas[0])
    idp = next((v for kv in fichas.values() for k, v in kv.items() if _clave(k) in _ID_PAC), None)
    for kv in fichas.values():                      # el nº de ficha identifica al paciente en todas las tablas
        if idp:
            kv.setdefault("Num ficha", idp)
    tablas = {**{k: [v] for k, v in fichas.items()}, **tablas}
    return mapear_tablas(tablas, "docx")


# =====================================================================================
#  6. MOTOR DE NORMALIZACIÓN
# =====================================================================================
ESTADOS = {
    "ACTIVE": "ACTIVO", "ACTIVO": "ACTIVO", "RESOLVED": "RESUELTO", "RESUELTO": "RESUELTO",
    "CONTROLLED": "CONTROLADO", "CONTROLADO": "CONTROLADO", "INFORMATIVO": "INFORMATIVO",
    "SCHEDULED": "PENDIENTE", "PENDING": "PENDIENTE", "PENDIENTE": "PENDIENTE",
    "OVERDUE": "VENCIDO", "VENCIDO": "VENCIDO", "CONDICIONAL": "CONDICIONAL",
    "DONE": "COMPLETADO", "COMPLETED": "COMPLETADO", "COMPLETADO": "COMPLETADO",
    "CANCELLED": "CANCELADO", "CANCELED": "CANCELADO", "CANCELADO": "CANCELADO",
}
ESTADOS_CANONICOS = sorted(set(ESTADOS.values()))
ESPECIES = {"CAN": "Canina", "CANINA": "Canina", "CANINO": "Canina", "DOG": "Canina", "PERRO": "Canina",
            "FEL": "Felina", "FELINA": "Felina", "FELINO": "Felina", "CAT": "Felina", "GATO": "Felina"}

# (patrón sobre el tipo, o sobre el motivo si no hay tipo) -> tipo canónico; el orden importa
TIPOS_VISITA = [
    (r"first|primera", "PRIMERA_VISITA"),
    (r"emergen|urgenc", "URGENCIA"),
    (r"surg|cirug|castraci|orquiect", "CIRUGIA"),
    (r"wellness|preventiv|vacun|refuerzo|anual", "PREVENTIVA"),
    (r"recheck|revisi|control|postop", "REVISION"),
]


def tipo_visita(tipo, motivo):
    t = _clave(tipo or motivo or "")
    if not t:
        return None
    return next((c for p, c in TIPOS_VISITA if re.search(p, t)), "CONSULTA")


def _estado(e, **ctx):
    if _nada(e) is None:
        return None
    k = _clave(e).upper()
    if k in ESTADOS:
        return ESTADOS[k]
    aviso("ESTADO_DESCONOCIDO", f"Estado {e!r} sin equivalencia canónica; se conserva en mayúsculas.",
          nivel="INFO", valor=str(e), **ctx)
    return str(e).strip().upper()


def a_registros(pq):
    """Pasa las filas del paquete (tuplas de los adaptadores específicos o dicts de los genéricos)
    a dicts por nombre de campo. A partir de aquí nada depende de posiciones."""
    for t in TABLAS:
        filas = []
        for i, f in enumerate(pq.get(t, [])):
            if isinstance(f, dict):
                d = dict(f)
            else:
                orden = ORDEN_PAQUETE[t]
                if len(f) > len(orden):
                    raise ValueError(f"Tupla de '{t}' con {len(f)} campos; el paquete admite {len(orden)}")
                d = {c: (f[j] if j < len(f) else None) for j, c in enumerate(orden)}
            for c in ORDEN_PAQUETE[t]:
                d.setdefault(c, None)
            d.setdefault("_ref", f"{t}#{i}")
            d.setdefault("_original", {})
            for c in IDS & d.keys():
                d[c] = _id_texto(d[c])
            for c in list(d):
                if not c.startswith("_") and c not in IDS:
                    d[c] = _nada(d[c])
            filas.append(d)
        pq[t] = filas
    pq.setdefault("_avisos", [])
    pq.setdefault("_desconocidos", [])
    pq.setdefault("_meta", {})
    return pq


def _parece_codigo(s):
    s = str(s).strip()
    return bool(re.fullmatch(r"[A-Za-z]{1,6}[-_ ]?\d+[\w-]*", s)) or (" " not in s and any(c.isdigit() for c in s))


def _fusionar_mismos(filas, clave):
    """Misma entidad repetida (CSV desnormalizado): se unifica completando huecos con valores no nulos."""
    fus = {}
    for f in filas:
        k = clave(f)
        if k not in fus:
            fus[k] = dict(f)
            continue
        for c, v in f.items():
            if c == "_original":
                fus[k][c] = {**v, **fus[k][c]}
            elif fus[k].get(c) is None and v is not None:
                fus[k][c] = v
    return list(fus.values())


def normalizar(pq):
    """Unifica vocabularios (estados, especie, sexo, tipo de visita, unidades) y completa/fusiona
    entidades repetidas. Conserva el valor original de todo lo que transforma. No elimina medidas:
    la deduplicación real se hace al guardar (ver guardar())."""
    pq = a_registros(pq)
    with _destino(pq["_avisos"]):
        for f in pq["paciente"]:
            orig = f["_original"]
            esp = _nada(f.get("especie"))
            if esp is not None:
                m = ESPECIES.get(_clave(esp).upper())
                if m is None:
                    aviso("ESPECIE_NO_MAPEADA", f"Especie {esp!r} sin equivalencia; se conserva.", nivel="INFO")
                if m and m != esp:
                    orig["especie"] = str(esp)
                f["especie"] = m or esp
            sexo = _nada(f.get("sexo"))
            if sexo is not None:
                t = _clave(sexo)
                nuevo_sexo = "Hembra" if re.match(r"(f|h)", t) else "Macho" if t.startswith("m") else None
                if nuevo_sexo is None:
                    aviso("SEXO_DESCONOCIDO", f"Sexo {sexo!r} no reconocido; queda desconocido.", valor=str(sexo))
                if nuevo_sexo != sexo:
                    orig["sexo"] = str(sexo)
                f["sexo"] = nuevo_sexo
            e = f.get("esterilizado")
            if isinstance(e, str):
                e = _bool(e, "esterilizado")
            if e is None and sexo is not None:
                e = _esterilizado_de_texto(sexo)         # solo si el texto lo dice
            f["esterilizado"] = e
            mc = _nada(f.get("microchip"))
            if mc is not None:
                ok, dig = validar_microchip(mc)
                if not ok:
                    aviso("MICROCHIP_NO_VALIDO", f"Microchip {mc!r} no tiene 15 dígitos; se conserva sin validar.",
                          valor=str(mc))
        for t, campo in (("paciente", "paciente_id"), ("tutor", "tutor_id"), ("personal", "personal_id")):
            for f in pq[t]:
                if f.get(campo) is None and any(v is not None for k, v in f.items() if not k.startswith("_")):
                    f[campo] = "SIN_ID-" + _h([v for k, v in sorted(f.items()) if not k.startswith("_")])[:12]
                    aviso("ID_GENERADO", f"Registro de '{t}' sin identificador original; se genera {f[campo]}.")
        pq["paciente"] = _fusionar_mismos([f for f in pq["paciente"] if f.get("paciente_id")],
                                          lambda f: (f["paciente_id"], f.get("clinica_id")))
        for t, campo in (("tutor", "tutor_id"), ("clinica", "clinica_id"), ("personal", "personal_id")):
            pq[t] = _fusionar_mismos([f for f in pq[t] if f.get(campo)], lambda f, c=campo: f[c])

        for f in pq["visita"]:
            t0 = f.get("tipo")
            f["tipo"] = tipo_visita(t0, f.get("motivo"))
            if t0 is not None and f["tipo"] != t0:
                f["_original"]["tipo"] = str(t0)
        for t in ("problema", "recordatorio", "tratamiento"):
            for f in pq[t]:
                e0 = f.get("estado")
                f["estado"] = _estado(e0, tabla=t, origen_ref=f.get("_ref"))
                if e0 is not None and f["estado"] != e0:
                    f["_original"]["estado"] = str(e0)
        for f in pq["parasitos"]:
            t0 = f.get("tipo")
            if t0 is not None:
                k = _clave(t0)
                f["tipo"] = "interna" if re.search(r"intern|endo", k) else "externa" if re.search(r"extern|ecto", k) else t0
        for f in pq["personal"]:
            n, pid = _nada(f.get("nombre")), f["personal_id"]
            if n is not None and str(n) == str(pid) and _parece_codigo(n):
                n = None                                   # un identificador técnico no es un nombre
            f["nombre"] = n
            f["pendiente_identificacion"] = 1 if n is None else 0

        medidas = []
        for f in pq["medida"]:
            n = normalizar_medida(f)
            if n:
                medidas.append(n)
        pq["medida"] = medidas
    return pq


# =====================================================================================
#  7. GESTIÓN DE IDENTIFICADORES (internos universales + correspondencia con los externos)
# =====================================================================================
def _interno(con, tipo, clinica, ext, sistema, import_id):
    """Id interno para (tipo, clínica, id original). Mismo id en distinta clínica = otra entidad.
    El id original se conserva en id_externo junto con clínica y sistema de origen."""
    ext = str(ext)
    fila = con.execute("SELECT id_interno FROM id_externo WHERE tipo=? AND clinica_id=? AND id_externo=?",
                       (tipo, clinica, ext)).fetchone()
    if fila:
        return fila[0]
    interno = f"{PREFIJO_ID[tipo]}-{uuid.uuid5(NS_UUID, f'{tipo}|{clinica}|{ext}').hex[:20]}"
    con.execute("INSERT INTO id_externo(tipo,clinica_id,id_externo,id_interno,sistema,import_id) "
                "VALUES (?,?,?,?,?,?)", (tipo, clinica, ext, interno, sistema, import_id))
    return interno


def _a_internos(con, pq, meta, import_id):
    """Sustituye los ids originales por ids internos (por clínica). No fusiona pacientes por
    compartir id original ni por microchip. Devuelve un paquete nuevo con ids internos."""
    sistema = meta.get("sistema") or meta.get("formato") or "desconocido"
    pacs = pq["paciente"]
    cl_ids = {f["clinica_id"] for f in pacs if f.get("clinica_id")}
    ref = meta.get("clinica") or (next(iter(cl_ids)) if len(cl_ids) == 1 else None)
    hay_datos = any(pq[t] for t in TABLAS)
    if not ref:
        ref = f"DESCONOCIDA-{(meta.get('sha256') or 'sin-hash')[:8]}"
        if hay_datos:
            aviso("CLINICA_DESCONOCIDA",
                  f"El archivo no indica la clínica; sus datos se aíslan bajo '{ref}' para no mezclarlos con "
                  f"otras clínicas. Use --clinica para asignarla.", archivo=meta.get("archivo"))

    cl_pac = {}
    for f in pacs:
        pid, c = f["paciente_id"], f.get("clinica_id") or ref
        if pid in cl_pac and cl_pac[pid] != c:
            aviso("ID_REPETIDO_ENTRE_CLINICAS", f"El id {pid!r} aparece en las clínicas {cl_pac[pid]} y {c}; "
                  f"los registros hijos sin clínica propia se asignan a {cl_pac[pid]}.", paciente=pid)
        cl_pac.setdefault(pid, c)
    c_pac = lambda pid: cl_pac.get(pid, ref)
    cl_vis = {}
    for v in pq["visita"]:
        cl_vis.setdefault(v["visita_id"], c_pac(v.get("paciente_id")))

    def c_hijo(f, t):
        pid = f.get("paciente_id")
        vid = f.get("visita_id") if "visita_id" in ORDEN_PAQUETE[t] else None
        if pid is not None:
            return c_pac(pid)
        return cl_vis.get(vid, ref)

    uso_tutor, uso_pers = defaultdict(set), defaultdict(set)
    for f in pacs:
        c = f.get("clinica_id") or ref
        if f.get("tutor_id"):
            uso_tutor[f["tutor_id"]].add(c)
        if f.get("veterinario_id"):
            uso_pers[f["veterinario_id"]].add(c)
    for v in pq["visita"]:
        if v.get("personal_id"):
            uso_pers[v["personal_id"]].add(c_pac(v.get("paciente_id")))

    I = lambda tipo, cl, ext: _interno(con, tipo, cl, ext, sistema, import_id) if ext is not None else None
    out = {t: [] for t in TABLAS}
    usadas = set()

    for f in pacs:
        cl = f.get("clinica_id") or ref
        usadas.add(cl)
        nf = dict(f)
        nf.update(paciente_id=I("paciente", cl, f["paciente_id"]), clinica_id=cl,
                  tutor_id=I("tutor", cl, f.get("tutor_id")), veterinario_id=I("personal", cl, f.get("veterinario_id")),
                  fuente=f.get("fuente") or meta.get("formato"))
        out["paciente"].append(nf)

    refs_pac = set()
    for t in ("visita", "medida", "problema", "tratamiento", "prueba", "vacuna", "parasitos", "recordatorio"):
        refs_pac |= {f.get("paciente_id") for f in pq[t] if f.get("paciente_id")}
    refs_pac |= {d.get("paciente_ext") for d in pq["_desconocidos"] if d.get("paciente_ext")}
    for pid in sorted(refs_pac - set(cl_pac)):             # referenciado pero sin ficha: se crea la ficha mínima
        cl = c_pac(pid)
        usadas.add(cl)
        aviso("PACIENTE_SIN_FICHA", f"El paciente {pid!r} aparece en registros pero no tiene ficha en este "
              f"archivo; se crea una ficha mínima completable con otros archivos.", paciente=pid)
        out["paciente"].append({"paciente_id": I("paciente", cl, pid), "clinica_id": cl,
                                "fuente": meta.get("formato"), "_ref": "referencia", "_original": {}})

    tut_vistos = set()
    for f in pq["tutor"]:
        for cl in (uso_tutor.get(f["tutor_id"]) or {ref}):
            nf = dict(f)
            nf["tutor_id"] = I("tutor", cl, f["tutor_id"])
            out["tutor"].append(nf)
            tut_vistos.add((cl, f["tutor_id"]))
    for tid, cls in uso_tutor.items():
        for cl in cls:
            if (cl, tid) not in tut_vistos:
                out["tutor"].append({"tutor_id": I("tutor", cl, tid), "_ref": "referencia", "_original": {}})
    per_vistos = set()
    for f in pq["personal"]:
        for cl in (uso_pers.get(f["personal_id"]) or {ref}):
            nf = dict(f)
            nf["personal_id"] = I("personal", cl, f["personal_id"])
            out["personal"].append(nf)
            per_vistos.add((cl, f["personal_id"]))
    for pid, cls in uso_pers.items():
        for cl in cls:
            if (cl, pid) not in per_vistos:                # id de profesional sin ficha: sin nombre, pendiente
                out["personal"].append({"personal_id": I("personal", cl, pid), "nombre": None, "rol": None,
                                        "pendiente_identificacion": 1, "_ref": "referencia", "_original": {}})

    for v in pq["visita"]:
        pid = v.get("paciente_id")
        cl = c_pac(pid)
        if pid is None:
            aviso("VISITA_SIN_PACIENTE", f"La visita {v['visita_id']!r} no se pudo asociar a ningún paciente.")
        nv = dict(v)
        nv.update(visita_id=I("visita", cl, v["visita_id"]), paciente_id=I("paciente", cl, pid),
                  personal_id=I("personal", cl, v.get("personal_id")))
        out["visita"].append(nv)

    for t in ("medida", "problema", "tratamiento", "prueba", "vacuna", "parasitos", "recordatorio",
              "factura_linea", "documento"):
        for f in pq[t]:
            cl = c_hijo(f, t)
            nf = dict(f)
            if "paciente_id" in ORDEN_PAQUETE[t]:
                if f.get("paciente_id") is None:
                    aviso("REGISTRO_SIN_PACIENTE", f"Registro de '{t}' sin paciente asociable; se conserva "
                          f"sin enlazar.", tabla=t, origen_ref=f.get("_ref"))
                nf["paciente_id"] = I("paciente", cl, f.get("paciente_id"))
            if "visita_id" in ORDEN_PAQUETE[t]:
                nf["visita_id"] = I("visita", cl, f.get("visita_id"))
            out[t].append(nf)

    nombres = {f["clinica_id"]: f.get("nombre") for f in pq["clinica"] if f.get("clinica_id")}
    for c in sorted(usadas):
        out["clinica"].append({"clinica_id": c, "nombre": nombres.get(c) or c, "_ref": "metadatos", "_original": {}})
    out["_desconocidos"] = []
    for d in pq["_desconocidos"]:
        pid = d.get("paciente_ext")
        cl = c_pac(pid) if pid is not None else ref
        nd = dict(d)
        nd["clinica_id"] = cl
        nd["paciente_id"] = I("paciente", cl, pid) if pid is not None else None
        out["_desconocidos"].append(nd)
    out["_clinicas"] = sorted(usadas | {ref})
    return out


def resolver_paciente(con, ident, clinica=None):
    """Acepta el id interno o un id original. Si el id original existe en varias clínicas y no se
    indica cuál, falla con un mensaje claro en lugar de elegir uno."""
    if _uno(con, "SELECT 1 AS x FROM paciente WHERE paciente_id=?", (ident,)):
        return ident
    sql, par = "SELECT id_interno, clinica_id FROM id_externo WHERE tipo='paciente' AND id_externo=?", [str(ident)]
    if clinica:
        sql, par = sql + " AND clinica_id=?", par + [clinica]
    filas = _todos(con, sql, par)
    filas = [f for f in filas if _uno(con, "SELECT 1 AS x FROM paciente WHERE paciente_id=?", (f["id_interno"],))]
    if not filas:
        raise PacienteNoEncontrado(f"No existe ningún paciente con identificador '{ident}'"
                                   + (f" en la clínica '{clinica}'" if clinica else "") + ".")
    if len(filas) > 1:
        raise PacienteAmbiguo(f"El identificador '{ident}' existe en varias clínicas ({', '.join(f['clinica_id'] for f in filas)}); "
                              f"indique la clínica o use el id interno ({', '.join(f['id_interno'] for f in filas)}).")
    return filas[0]["id_interno"]


class ExportacionError(ValueError):
    pass


class PacienteNoEncontrado(ExportacionError):
    pass


class PacienteAmbiguo(ExportacionError):
    pass


# =====================================================================================
#  8. PERSISTENCIA EN SQLITE (fusión idempotente, transaccional)
# =====================================================================================
PK = {"clinica": "clinica_id", "personal": "personal_id", "tutor": "tutor_id", "paciente": "paciente_id",
      "visita": "visita_id"}
MUTABLES = {"tutor": {"saldo_eur"}, "problema": {"estado", "fin"}, "tratamiento": {"estado"},
            "recordatorio": {"estado"}, "vacuna": {"proxima", "proxima_aprox"}, "parasitos": {"proxima"}}
# campos que identifican un registro hijo (misma clave = mismo registro)
NK = {"problema": ["paciente_id", "etiqueta", "categoria"],
      "tratamiento": ["visita_id", "paciente_id", "descripcion"],
      "prueba": ["visita_id", "paciente_id", "prueba", "resultado"],
      "vacuna": ["paciente_id", "vacuna", "aplicada"],
      "parasitos": ["paciente_id", "tipo", "ultima"],
      "recordatorio": ["paciente_id", "concepto", "fecha"],
      "factura_linea": ["visita_id", "concepto", "cantidad", "importe_eur"],
      "documento": ["visita_id", "tipo", "fichero"]}


def _norm_k(v):
    if isinstance(v, str):
        return re.sub(r"\s+", " ", v.strip().lower())
    if isinstance(v, float):
        return round(v, 6)
    return v


def _nk(tabla, f):
    campos = NK[tabla]
    if tabla == "vacuna" and f.get("aplicada") is None:
        campos = ["paciente_id", "vacuna", "proxima"]
    return [tabla] + [_norm_k(f.get(c)) for c in campos]


def _clave_medida(f, occ):
    return _h("medida", f.get("paciente_id"), f.get("fecha"), f.get("tipo"), _norm_k(f.get("valor")),
              f.get("unidad"), f.get("visita_id") or "", occ)


def _sql(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, (dict, list)):
        return json.dumps(_limpio(v), ensure_ascii=False)
    if hasattr(v, "item") and not isinstance(v, (str, bytes, int, float)):
        v = v.item()
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, float) and not math.isfinite(v):
        return None
    return v


def _mas_completo(viejo, nuevo_v):
    return (isinstance(viejo, str) and isinstance(nuevo_v, str)
            and viejo.strip().lower() in nuevo_v.lower() and len(nuevo_v) > len(viejo))


def _fusionar(con, tabla, existente, fila, where, mutables, pk=None):
    """Actualiza un registro existente: rellena huecos, nunca sustituye por nulo, actualiza
    estados mutables y deja constancia (aviso) de los conflictos reales sin sobrescribir."""
    sets = {}
    for c in ORDEN_PAQUETE.get(tabla, []) + [c for c in ("valor_original", "unidad_original", "unidad_estado") if tabla == "medida"]:
        if c not in CAMPOS[tabla] or c == pk or c == "pendiente_identificacion":
            continue
        n, v = fila.get(c), existente.get(c)
        if n is None or v == n:
            continue
        if v is None:
            sets[c] = n
        elif tabla == "paciente" and c == "fuente":
            partes = sorted(set(str(v).split(",")) | set(str(n).split(",")))
            if ",".join(partes) != v:
                sets[c] = ",".join(partes)
        elif c in mutables:
            sets[c] = n
        elif _mas_completo(v, n) or (c == "nombre" and pk and v == existente.get(pk)):
            sets[c] = n
        else:
            aviso("CONFLICTO_VALOR", f"'{tabla}.{c}': ya existe {v!r} y el archivo trae {n!r}; se conserva el "
                  f"existente (el nuevo queda en este aviso).", nivel="CONFLICTO", tabla=tabla, campo=c,
                  existente=v, nuevo=n, origen_ref=fila.get("_ref"))
    if tabla == "personal":
        nombre = sets.get("nombre", existente.get("nombre"))
        pend = 1 if nombre is None else 0
        if existente.get("pendiente_identificacion") != pend:
            sets["pendiente_identificacion"] = pend
    if sets:
        con.execute(f"UPDATE {tabla} SET {', '.join(c + '=?' for c in sets)} WHERE {where[0]}",
                    [_sql(v) for v in sets.values()] + list(where[1]))


def _insertar(con, tabla, fila, extra, ignorar=False):
    datos = {c: _sql(fila.get(c)) for c in CAMPOS[tabla] if c in fila}
    datos.update(extra)
    cols = list(datos)
    con.execute(f"INSERT {'OR IGNORE ' if ignorar else ''}INTO {tabla} ({','.join(cols)}) "
                f"VALUES ({','.join('?' * len(cols))})", [datos[c] for c in cols])


def _prov(fila, import_id):
    orig = fila.get("_original")
    return {"import_id": import_id, "origen_ref": fila.get("_ref"),
            "original": json.dumps(_limpio(orig), ensure_ascii=False) if orig else None}


def _upsert_maestro(con, tabla, fila, import_id):
    pk = PK[tabla]
    if fila.get(pk) is None:
        return
    existente = _uno(con, f"SELECT * FROM {tabla} WHERE {pk}=?", (fila[pk],))
    if existente is None:
        if tabla == "personal":
            fila = dict(fila, pendiente_identificacion=1 if fila.get("nombre") is None else 0)
        _insertar(con, tabla, fila, _prov(fila, import_id))
    else:
        _fusionar(con, tabla, existente, fila, (f"{pk}=?", (fila[pk],)), MUTABLES.get(tabla, set()), pk)


def _numerar(tabla, filas):
    """Índice de aparición de cada registro con la misma clave dentro del paquete: dos filas
    realmente repetidas en el origen se conservan como dos; la reimportación las reconoce."""
    vistos, out = defaultdict(int), []
    for f in filas:
        base = _h(_nk(tabla, f))
        out.append((f, vistos[base]))
        vistos[base] += 1
    return out


def _guardar_hijo(con, tabla, f, occ, import_id):
    clave = _h(_nk(tabla, f), occ)
    existente = _uno(con, f"SELECT * FROM {tabla} WHERE clave=?", (clave,))
    if existente is None:
        _insertar(con, tabla, f, {**_prov(f, import_id), "clave": clave}, ignorar=True)
    else:
        _fusionar(con, tabla, existente, f, ("clave=?", (clave,)), MUTABLES.get(tabla, set()))


def _guardar_medidas(con, medidas, import_id):
    """No se deduplica por (paciente, fecha, tipo). Una medición es la misma que otra solo si
    coinciden valor, unidad, visita (o una de ellas no tiene visita) y aparición en el origen."""
    vistos = defaultdict(int)
    for f in medidas:
        base = (f.get("paciente_id"), f.get("fecha"), f.get("tipo"), _norm_k(f.get("valor")), f.get("unidad"),
                f.get("visita_id") or "")
        occ = vistos[base]
        vistos[base] += 1
        sig = (f.get("paciente_id"), f.get("fecha"), f.get("tipo"), f.get("valor"), f.get("unidad"))
        cond = "paciente_id IS ? AND fecha IS ? AND tipo IS ? AND valor IS ? AND unidad IS ?"
        if f.get("visita_id") is None:
            n = con.execute(f"SELECT COUNT(*) FROM medida WHERE {cond}", sig).fetchone()[0]
            if n > occ:
                continue                                   # misma medición ya registrada (con o sin visita)
        else:
            huerfana = con.execute(f"SELECT rowid FROM medida WHERE {cond} AND visita_id IS NULL "
                                   f"LIMIT 1", sig).fetchone()
            if huerfana:                                   # la misma medición, ahora con su visita
                con.execute("UPDATE medida SET visita_id=?, clave=? WHERE rowid=?",
                            (f["visita_id"], _clave_medida(f, occ), huerfana[0]))
                continue
        clave = _clave_medida(f, occ)
        existente = _uno(con, "SELECT * FROM medida WHERE clave=?", (clave,))
        if existente is None:
            _insertar(con, "medida", f, {**_prov(f, import_id), "clave": clave}, ignorar=True)
        else:
            _fusionar(con, "medida", existente, f, ("clave=?", (clave,)), set())


def _registrar_importacion(con, meta):
    sha = meta.get("sha256")
    if sha:
        fila = con.execute("SELECT import_id FROM importacion WHERE sha256=?", (sha,)).fetchone()
        if fila:
            return fila[0]
    cur = con.execute("INSERT INTO importacion(archivo, sha256, formato, sistema, clinica_id, fecha_import) "
                      "VALUES (?,?,?,?,?,?)",
                      (meta.get("archivo"), sha, meta.get("formato"), meta.get("sistema") or meta.get("formato"),
                       meta.get("clinica"), datetime.now().isoformat(timespec="seconds")))
    return cur.lastrowid


def _guardar_paquete(con, pq):
    meta = pq.get("_meta", {})
    avs = list(pq.get("_avisos", []))
    import_id = _registrar_importacion(con, meta)
    with _destino(avs):
        i = _a_internos(con, pq, meta, import_id)
        for tabla in ("clinica", "personal", "tutor", "paciente", "visita"):
            for f in i[tabla]:
                _upsert_maestro(con, tabla, f, import_id)
        for f in i["paciente"]:
            con.execute("INSERT OR IGNORE INTO paciente_import(paciente_id, import_id) VALUES (?,?)",
                        (f["paciente_id"], import_id))
            ok, dig = validar_microchip(f.get("microchip"))
            if ok:                                         # aviso, nunca fusión automática
                for o in _todos(con, "SELECT paciente_id FROM paciente WHERE paciente_id<>? AND "
                                "REPLACE(REPLACE(REPLACE(microchip,' ',''),'.',''),'-','')=?", (f["paciente_id"], dig)):
                    aviso("POSIBLE_DUPLICADO_MICROCHIP",
                          f"Los pacientes {f['paciente_id']} y {o['paciente_id']} comparten microchip {dig}; "
                          f"NO se fusionan automáticamente: requiere revisión manual.", nivel="REVISAR",
                          paciente_a=f["paciente_id"], paciente_b=o["paciente_id"])
        _guardar_medidas(con, i["medida"], import_id)
        for tabla in NK:
            for f, occ in _numerar(tabla, i[tabla]):
                _guardar_hijo(con, tabla, f, occ, import_id)
        for d in i["_desconocidos"]:
            clave = _h(meta.get("sha256"), d["tabla_origen"], d["fila"], d["campo_original"], d["valor"])
            con.execute("INSERT OR IGNORE INTO campo_desconocido(import_id, clinica_id, archivo, tabla_origen, fila, "
                        "campo_original, valor, paciente_id, entidad_probable, clave) VALUES (?,?,?,?,?,?,?,?,?,?)",
                        (import_id, d["clinica_id"], meta.get("archivo"), d["tabla_origen"], d["fila"],
                         d["campo_original"], d["valor"], d["paciente_id"], d.get("entidad_probable"), clave))
        con.execute("UPDATE importacion SET clinica_id=? WHERE import_id=?", (",".join(i["_clinicas"]), import_id))
    for a in avs:
        con.execute("INSERT OR IGNORE INTO aviso(import_id, nivel, codigo, mensaje, contexto, fecha, clave) "
                    "VALUES (?,?,?,?,?,?,?)",
                    (import_id, a["nivel"], a["codigo"], a["mensaje"],
                     json.dumps(a.get("contexto"), ensure_ascii=False, default=str),
                     datetime.now().isoformat(timespec="seconds"), _h(import_id, a["codigo"], a["mensaje"])))
    return {"import_id": import_id, "avisos": avs,
            "filas": {t: len(i[t]) for t in TABLAS}, "campos_desconocidos": len(i["_desconocidos"])}


def guardar(db, paquetes):
    """Fusiona los paquetes en la base MAESTRA dentro de una única transacción (si algo falla,
    rollback completo). No borra nada: añade, completa huecos y actualiza estados; importar dos
    veces el mismo archivo no duplica registros. Devuelve la conexión abierta."""
    con = conectar(db)
    resumenes = []
    con.execute("BEGIN IMMEDIATE")
    try:
        for pq in paquetes:
            resumenes.append(_guardar_paquete(con, a_registros(pq)))
        con.execute("COMMIT")
    except BaseException:
        con.execute("ROLLBACK")
        con.close()
        raise
    con.resumenes = resumenes if hasattr(con, "resumenes") else None
    return con


# =====================================================================================
#  9. SELECTOR DE ADAPTADOR E IMPORTACIÓN DE ARCHIVOS
# =====================================================================================
def _sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as fh:
        for bloque in iter(lambda: fh.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def _despachar(ruta, ext):
    """Elige el adaptador: primero los de formato conocido (más precisos), si no, el genérico."""
    if ext == ".docx":
        import docx
        txt = " ".join(c.text for t in docx.Document(ruta).tables[:1] for r in t.rows for c in r.cells)
        if "Nº de ficha" in txt:
            return cargar_docx(ruta), "docx", True
        return cargar_docx_generico(ruta), "docx", False
    if ext == ".json":
        with open(ruta, encoding="utf-8") as fh:
            d = json.load(fh)
        conocido = isinstance(d, dict) and {"patient", "owner", "encounters", "care_team"} <= d.keys()
        return (cargar_json(ruta), "json", True) if conocido else (cargar_json_generico(ruta), "json", False)
    if ext in (".xlsx", ".xlsm", ".xls"):
        hojas = set(pd.ExcelFile(ruta).sheet_names)
        if {"Mascota", "Tutor", "Historial_Visitas"} <= hojas:
            return cargar_xlsx(ruta), "xlsx", True
        return cargar_xlsx_generico(ruta), "xlsx", False
    if ext in (".csv", ".tsv", ".txt"):
        return cargar_csv(ruta), "csv", False
    if ext == ".xml":
        return cargar_xml(ruta), "xml", False
    if ext in (".db", ".sqlite", ".sqlite3", ".sql"):
        return cargar_sql(ruta), "sql", False
    raise ValueError(f"Formato no soportado: {ext}")


def cargar_auto(ruta, clinica=None, formato_fecha=None, sistema=None):
    """Lee un archivo SIN modificarlo y devuelve el paquete (sin normalizar) con sus metadatos:
    archivo, huella SHA-256, formato, sistema de origen y clínica indicada."""
    ruta = str(ruta)
    if not os.path.isfile(ruta):
        raise FileNotFoundError(f"No existe el archivo: {ruta}")
    ext = os.path.splitext(ruta)[1].lower()
    avisos = []
    with _contexto(archivo=os.path.basename(ruta), clinica=clinica, formato_fecha=formato_fecha), _destino(avisos):
        pq, formato, _ = _despachar(ruta, ext)
    pq["_avisos"] = avisos + pq.get("_avisos", [])
    pq["_meta"] = {"archivo": os.path.basename(ruta), "sha256": _sha256(ruta), "formato": formato,
                   "sistema": sistema or formato, "clinica": clinica}
    return pq


def importar(db, rutas, clinica=None, formato_fecha=None, sistema=None):
    """Importa cada archivo en su propia transacción: un archivo defectuoso no afecta a los demás
    ni deja datos a medias. Devuelve un resumen por archivo (con avisos y errores)."""
    resultados = []
    for ruta in rutas:
        try:
            with _contexto(archivo=os.path.basename(str(ruta)), clinica=clinica, formato_fecha=formato_fecha):
                pq = normalizar(cargar_auto(ruta, clinica, formato_fecha, sistema))
                con = guardar(db, [pq])
            n_av = len(pq["_avisos"])
            con.close()
            resultados.append({"archivo": str(ruta), "ok": True, "avisos": pq["_avisos"], "n_avisos": n_av,
                               "filas": {t: len(pq[t]) for t in TABLAS},
                               "campos_desconocidos": len(pq["_desconocidos"])})
        except Exception as e:                                     # rollback ya hecho en guardar()
            resultados.append({"archivo": str(ruta), "ok": False, "error": f"{type(e).__name__}: {e}"})
    return resultados


# =====================================================================================
# 10. EXPORTACIÓN JSON (copia para compartir; la base maestra no se toca)
# =====================================================================================
PODA = {"tutor": ["nombre", "telefono", "email", "canal_contacto", "acepta_recordatorios", "saldo_eur"],
        "visita": ["total_eur"]}
TABLAS_ECONOMICAS = ["factura_linea"]


def exportar_dict(con, ident, clinica=None):
    """Historia completa de un paciente como dict canónico (valores limpios para JSON estricto)."""
    pid = resolver_paciente(con, ident, clinica)
    q = lambda sql, *p: _todos(con, sql, p)
    doc = {"paciente": q("SELECT * FROM paciente WHERE paciente_id=?", pid)[0]}
    doc["tutor"] = q("SELECT t.* FROM tutor t JOIN paciente p ON p.tutor_id=t.tutor_id WHERE p.paciente_id=?", pid)
    doc["clinica"] = q("SELECT c.* FROM clinica c JOIN paciente p ON p.clinica_id=c.clinica_id WHERE p.paciente_id=?", pid)
    doc["personal"] = q("""SELECT * FROM personal WHERE personal_id IN
                           (SELECT veterinario_id FROM paciente WHERE paciente_id=?
                            UNION SELECT personal_id FROM visita WHERE paciente_id=?)""", pid, pid)
    for t in ("visita", "medida", "problema", "tratamiento", "prueba", "vacuna", "parasitos", "recordatorio"):
        doc[t] = q(f"SELECT * FROM {t} WHERE paciente_id=? ORDER BY rowid", pid)
    for t in ("factura_linea", "documento"):
        doc[t] = q(f"SELECT x.* FROM {t} x JOIN visita v ON v.visita_id=x.visita_id WHERE v.paciente_id=? ORDER BY x.rowid", pid)
    doc["identificadores_externos"] = q("SELECT tipo, clinica_id, id_externo, id_interno, sistema FROM id_externo "
                                        "WHERE id_interno IN (SELECT ?) OR (tipo<>'paciente' AND id_interno IN "
                                        "(SELECT tutor_id FROM paciente WHERE paciente_id=? UNION "
                                        "SELECT visita_id FROM visita WHERE paciente_id=? UNION "
                                        "SELECT veterinario_id FROM paciente WHERE paciente_id=?))", pid, pid, pid, pid)
    doc["importaciones"] = q("SELECT i.* FROM importacion i JOIN paciente_import pi ON pi.import_id=i.import_id "
                             "WHERE pi.paciente_id=?", pid)
    doc["campos_desconocidos"] = q("SELECT * FROM campo_desconocido WHERE paciente_id=?", pid)
    doc["avisos"] = q("SELECT a.* FROM aviso a JOIN paciente_import pi ON pi.import_id=a.import_id "
                      "WHERE pi.paciente_id=?", pid)
    for filas in doc.values():
        for f in (filas if isinstance(filas, list) else [filas]):
            for campo in ("original", "contexto"):
                if isinstance(f.get(campo), str):
                    try:
                        f[campo] = json.loads(f[campo])
                    except ValueError:
                        pass
    return _limpio(doc)


def minimizar(doc):
    """Devuelve una COPIA minimizada (sin datos de contacto ni económicos) para el especialista.
    Opera sobre el dict exportado; nunca toca la base maestra ni el documento recibido."""
    doc = copy.deepcopy(doc)
    for tabla, campos in PODA.items():
        for f in doc.get(tabla, []):
            for c in campos:
                if c in f:
                    f[c] = None
    for t in TABLAS_ECONOMICAS:
        doc[t] = []
    return doc


def preparar_para_especialista(con, ident, clinica=None):
    """Expediente minimizado listo para compartir, generado desde la base sin modificarla."""
    return minimizar(exportar_dict(con, ident, clinica))


def exportar_json(con, ident, ruta, minimizado=False, clinica=None):
    """Escribe el JSON de un paciente (estricto: sin NaN/Infinity). Si el paciente no existe,
    lanza un error comprensible y no crea ningún archivo."""
    doc = exportar_dict(con, ident, clinica)
    if minimizado:
        doc = minimizar(doc)
    try:
        texto = json.dumps(doc, ensure_ascii=False, indent=2, allow_nan=False)
    except ValueError as e:
        raise ExportacionError(f"No se pudo generar un JSON válido: {e}") from e
    tmp = f"{ruta}.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(texto)
    os.replace(tmp, ruta)
    return ruta


# =====================================================================================
# 11. VISTAS Y CONSULTAS
# =====================================================================================
def _q(con, sql, *a):
    return pd.read_sql_query(sql, con, params=a)


SIN_VIGENCIA = "('RESUELTO','INFORMATIVO','CANCELADO')"       # estados canónicos que no son "vigentes"


def datos_paciente(con, ident):
    """Todas las secciones de la ficha de un paciente (DataFrames)."""
    pid = resolver_paciente(con, ident)
    d = {"pid": pid}
    d["perfil"] = _q(con, """SELECT p.paciente_id, p.nombre, p.especie, p.raza, p.sexo, p.esterilizado,
                     p.fecha_nacimiento, p.color, p.microchip, c.nombre clinica, t.poblacion
                     FROM paciente p LEFT JOIN clinica c ON c.clinica_id=p.clinica_id
                     LEFT JOIN tutor t ON t.tutor_id=p.tutor_id WHERE p.paciente_id=?""", pid)
    d["problemas"] = _q(con, f"""SELECT categoria, etiqueta, estado, gravedad FROM problema
                     WHERE paciente_id=? AND COALESCE(estado,'') NOT IN {SIN_VIGENCIA} ORDER BY rowid""", pid)
    d["informativo"] = _q(con, """SELECT categoria, etiqueta FROM problema
                     WHERE paciente_id=? AND estado='INFORMATIVO' ORDER BY rowid""", pid)
    d["peso"] = _q(con, """SELECT fecha, valor, unidad, unidad_estado, visita_id FROM medida
                     WHERE paciente_id=? AND tipo='peso' ORDER BY fecha, rowid""", pid)
    d["otras_medidas"] = _q(con, """SELECT fecha, tipo, valor, unidad FROM medida
                     WHERE paciente_id=? AND tipo<>'peso' ORDER BY fecha, tipo, rowid""", pid)
    d["vacunas"] = _q(con, "SELECT vacuna, aplicada, proxima FROM vacuna WHERE paciente_id=? ORDER BY proxima", pid)
    d["parasitos"] = _q(con, "SELECT tipo, producto, ultima, proxima FROM parasitos WHERE paciente_id=? ORDER BY proxima", pid)
    d["tratamientos"] = _q(con, """SELECT v.fecha, t.descripcion, t.dosis, t.dias, t.estado FROM tratamiento t
                     LEFT JOIN visita v ON v.visita_id=t.visita_id WHERE t.paciente_id=? ORDER BY v.fecha DESC, t.rowid""", pid)
    d["pruebas"] = _q(con, """SELECT v.fecha, x.prueba, x.resultado, x.unidad, x.referencia, x.marca FROM prueba x
                     LEFT JOIN visita v ON v.visita_id=x.visita_id WHERE x.paciente_id=? ORDER BY v.fecha DESC, x.rowid""", pid)
    d["visitas"] = _q(con, "SELECT fecha, tipo, motivo, diagnostico FROM visita WHERE paciente_id=? ORDER BY fecha DESC, rowid", pid)
    return d


def vista_paciente(con, pid):
    """Ficha completa del paciente: perfil, alertas, peso, vacunas, tratamientos y cronología."""
    d = datos_paciente(con, pid)
    print(d["perfil"].T.to_string(header=False))
    for titulo, clave in [("Alertas y problemas vigentes", "problemas"), ("Informativo", "informativo"),
                          ("Evolución del peso (todas las mediciones)", "peso"),
                          ("Constantes y otras medidas", "otras_medidas"), ("Vacunas", "vacunas"),
                          ("Antiparasitarios", "parasitos"), ("Tratamientos", "tratamientos"),
                          ("Pruebas", "pruebas")]:
        if len(d[clave]):
            print(f"\n-- {titulo}")
            print(d[clave].to_string(index=False, max_colwidth=55))
    print("\n-- Cronología de visitas (más reciente primero)")
    print(d["visitas"].to_string(index=False, max_colwidth=55))
    return d


def datos_doctor(con, hoy=None):
    hoy = hoy or date.today().isoformat()
    return _q(con, """
        SELECT p.nombre paciente, r.concepto, r.fecha,
               CASE WHEN r.fecha < ? THEN 'VENCIDO' ELSE 'próximo' END AS situacion
        FROM recordatorio r JOIN paciente p USING(paciente_id)
        WHERE r.fecha IS NOT NULL AND COALESCE(r.estado,'') NOT IN ('COMPLETADO','CANCELADO')
        UNION ALL
        SELECT p.nombre, 'Antiparasitario ' || x.tipo, x.proxima,
               CASE WHEN x.proxima < ? THEN 'VENCIDO' ELSE 'próximo' END
        FROM parasitos x JOIN paciente p USING(paciente_id)
        WHERE x.proxima IS NOT NULL AND x.proxima < date(?, '+30 day')
          AND NOT EXISTS (SELECT 1 FROM recordatorio r2
                          WHERE r2.paciente_id = x.paciente_id AND r2.fecha = x.proxima)
        ORDER BY 3""", hoy, hoy, hoy)


def vista_doctor(con, hoy=None):
    """Panel clínico: pacientes con algo pendiente o vencido, ordenado por urgencia."""
    hoy = hoy or date.today().isoformat()
    print(f"-- Pendientes a fecha {hoy}")
    df = datos_doctor(con, hoy)
    print(df.to_string(index=False))
    return df


def _resolver_tutor(con, tutor_id):
    if _uno(con, "SELECT 1 AS x FROM tutor WHERE tutor_id=?", (tutor_id,)):
        return tutor_id
    filas = _todos(con, "SELECT id_interno FROM id_externo WHERE tipo='tutor' AND id_externo=?", (str(tutor_id),))
    if len(filas) == 1:
        return filas[0]["id_interno"]
    raise ExportacionError(f"Tutor '{tutor_id}' no encontrado" if not filas else
                           f"El tutor '{tutor_id}' existe en varias clínicas; use el id interno.")


def vista_tutor(con, tutor_id):
    """Vista sencilla para el tutor: sus mascotas, próximas citas y saldo (sin jerga clínica)."""
    tid = _resolver_tutor(con, tutor_id)
    masc = _q(con, """SELECT p.nombre mascota, p.raza, c.nombre clinica, t.saldo_eur saldo_pendiente
                     FROM paciente p JOIN tutor t ON t.tutor_id=p.tutor_id
                     LEFT JOIN clinica c ON c.clinica_id=p.clinica_id WHERE p.tutor_id=?""", tid)
    print(masc.to_string(index=False))
    print("\n-- Próximas citas y avisos")
    citas = _q(con, """SELECT p.nombre mascota, r.concepto, r.fecha FROM recordatorio r
                     JOIN paciente p USING(paciente_id)
                     WHERE p.tutor_id=? AND r.fecha IS NOT NULL
                       AND COALESCE(r.estado,'') NOT IN ('COMPLETADO','CANCELADO') ORDER BY r.fecha""", tid)
    print(citas.to_string(index=False))
    return {"mascotas": masc, "citas": citas}


def campos_pendientes(con):
    """Campos desconocidos agrupados por tabla/columna: candidatos a incorporar en ALIAS."""
    return _q(con, """SELECT tabla_origen, campo_original, entidad_probable, COUNT(*) filas,
                      MIN(valor) ejemplo FROM campo_desconocido WHERE estado='pendiente'
                      GROUP BY tabla_origen, campo_original ORDER BY filas DESC""")


# =====================================================================================
# 12. PROGRAMA PRINCIPAL
# =====================================================================================
def main(argv=None):
    ap = argparse.ArgumentParser(description="Unifica historiales veterinarios en un modelo canónico (SQLite + JSON).")
    ap.add_argument("archivos", nargs="*", help="cualquier mezcla de .docx .xlsx .xls .xlsm .csv .tsv .txt .json .xml .db .sql")
    ap.add_argument("--json"), ap.add_argument("--xlsx"), ap.add_argument("--docx")   # compatibilidad con el uso anterior
    ap.add_argument("--db", default="vet.db")
    ap.add_argument("--clinica", help="clínica de los archivos que no la indiquen (evita mezclar clínicas)")
    ap.add_argument("--sistema", help="software de origen (se guarda en la correspondencia de ids)")
    ap.add_argument("--formato-fecha", choices=["dmy", "mdy", "ymd"], help="formato de fechas con barras")
    ap.add_argument("--config", help="JSON con alias adicionales y formato de fecha por clínica")
    ap.add_argument("--exportar", metavar="ID_PACIENTE", help="escribe el JSON canónico del paciente")
    ap.add_argument("--salida", help="ruta del JSON exportado (por defecto <id>.json)")
    ap.add_argument("--minimizar", action="store_true",
                    help="en la EXPORTACIÓN, omite datos de contacto/económicos (la base no se modifica)")
    ap.add_argument("--paciente"), ap.add_argument("--doctor", action="store_true"), ap.add_argument("--tutor")
    ap.add_argument("--pendientes", action="store_true", help="lista campos desconocidos pendientes de clasificar")
    a = ap.parse_args(argv)
    try:
        if a.config:
            cargar_config(a.config)
        rutas = a.archivos + [x for x in (a.json, a.xlsx, a.docx) if x]
        codigo = 0
        for r in importar(a.db, rutas, a.clinica, a.formato_fecha, a.sistema) if rutas else []:
            if r["ok"]:
                print(f"OK    {r['archivo']}  ({r['n_avisos']} avisos, {r['campos_desconocidos']} campos sin clasificar)")
                for av in r["avisos"]:
                    if av["nivel"] != "INFO":
                        print(f"      [{av['nivel']}] {av['codigo']}: {av['mensaje']}")
            else:
                codigo = 1
                print(f"ERROR {r['archivo']}: {r['error']} (sin cambios en la base)", file=sys.stderr)
        con = conectar(a.db)
        if a.exportar:
            ruta = a.salida or f"{a.exportar}.json"
            exportar_json(con, a.exportar, ruta, minimizado=a.minimizar, clinica=a.clinica)
            print(f"Exportado: {ruta}")
        if a.paciente:
            vista_paciente(con, a.paciente)
        if a.doctor:
            vista_doctor(con)
        if a.tutor:
            vista_tutor(con, a.tutor)
        if a.pendientes:
            print(campos_pendientes(con).to_string(index=False))
        return codigo
    except ExportacionError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())