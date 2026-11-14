"""Aplana un CSV o Excel a texto plano: una línea por fila, con 'columna: valor'.
Basado en el script aplanar.py: se conserva la lógica de filas() y aplanar().
Uso suelto: python -m extractores.tabulares archivo.csv|archivo.xlsx > salida.txt"""
import csv, io, sys
from datetime import datetime
from pathlib import Path

from extractores import leer_texto
from procesador.trazabilidad import Seccion


def _valor(v):
    # openpyxl devuelve las fechas como datetime: si no hay hora real, se muestra solo la fecha (mismo valor)
    if isinstance(v, datetime) and v.time() == datetime.min.time():
        return v.date().isoformat()
    return v


def filas(cab, rows):
    cab = [c if c not in (None, "") else f"columna_{i}" for i, c in enumerate(cab, 1)]
    for r in rows:
        par = [f"{c}: {_valor(v)}" for c, v in zip(cab, r) if v not in (None, "")]
        if par: yield "; ".join(par)


def _csv(ruta):
    txt = leer_texto(ruta)
    primera = txt.split("\n")[0]
    d = max((",", ";", "\t"), key=primera.count)  # ';' si hay más ';' que ',' (como el original); también tabuladores
    r = [f for f in csv.reader(io.StringIO(txt, newline=""), delimiter=d) if f]
    if not r: return []
    return [Seccion("\n".join(filas(r[0], r[1:])), seccion="CSV")]


def _xlsx(ruta):
    from openpyxl import load_workbook
    wb = load_workbook(ruta, data_only=True)
    out = []
    for ws in wb:
        r = list(ws.iter_rows(values_only=True))
        if r: out.append(Seccion("\n".join(filas(r[0], r[1:])), hoja=ws.title))
    return out


def extraer(ruta, **_):
    """Devuelve una lista de Seccion (una por hoja en XLSX; una en CSV)."""
    return _csv(ruta) if Path(ruta).suffix.lower() == ".csv" else _xlsx(ruta)


def aplanar(ruta):
    """Misma salida que el script original: texto plano con '## hoja' en los Excel."""
    secs = extraer(ruta)
    if Path(ruta).suffix.lower() == ".csv":
        return "\n".join(s.texto for s in secs)
    out = []
    for s in secs: out += [f"## {s.hoja}", s.texto, ""]
    return "\n".join(out)


if __name__ == "__main__":
    print(aplanar(sys.argv[1]))
