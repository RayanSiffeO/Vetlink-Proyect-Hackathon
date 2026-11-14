import argparse
import csv
import io
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from a_csv import aplanar, leer_json, leer_xml
from base_datos import cargar
from transformador import construir, resumen, ORDEN_TABLAS
from normalizador_columnas import (
    planificar, tiene_contenido_clinico, informe, MODELO_POR_DEFECTO, OLLAMA_URL,
)

DELIMITADORES = [",", ";", "\t", "|"]


class ArchivoRechazado(Exception):
    pass


def leer_texto(ruta):
    datos = Path(ruta).read_bytes()
    if b"\x00" in datos[:4096]:
        raise ArchivoRechazado("es un archivo binario")
    try:
        return datos.decode("utf-8-sig")
    except UnicodeDecodeError:
        return datos.decode("latin-1")


def es_json(texto):
    t = texto.lstrip()
    if not t or t[0] not in "{[":
        return False
    try:
        json.loads(texto)
        return True
    except ValueError:
        return False


def es_xml(texto):
    t = texto.lstrip()
    if not t.startswith("<"):
        return False
    try:
        ET.fromstring(t.encode("utf-8"))
        return True
    except ET.ParseError:
        return False


def detectar_delimitador_csv(texto):
    lineas = [l for l in texto.splitlines() if l.strip()][:50]
    if len(lineas) < 1:
        return None
    for d in DELIMITADORES:
        filas = list(csv.reader(lineas, delimiter=d))
        anchos = {len(f) for f in filas}
        if len(anchos) == 1 and anchos.pop() >= 2:
            return d
    return None


def detectar_formato(texto):
    if es_json(texto):
        return "json", None
    if es_xml(texto):
        return "xml", None
    d = detectar_delimitador_csv(texto)
    if d:
        return "csv", d
    return None, None


def tabla_desde_registros(registros):
    """JSON/XML -> (cabecera, filas) aplanando cada registro; no se escribe ningun fichero."""
    planos = [aplanar(r) for r in registros]
    cabecera = list(dict.fromkeys(c for f in planos for c in f))
    return cabecera, [[f.get(c, "") for c in cabecera] for f in planos]


def tabla_desde_csv(texto, delimitador):
    filas = list(csv.reader(io.StringIO(texto, newline=""), delimiter=delimitador))
    return filas[0], filas[1:]


def importar(cabecera, datos, archivo, args):
    plan, avisos = planificar(cabecera, datos, usar_llm=not args.sin_llm,
                              modelo=args.modelo, url=args.url)
    print(informe(plan, avisos) + "\n")

    if not tiene_contenido_clinico(plan):
        print("Tabla sin contenido clinico (solo datos administrativos o de facturacion): no se carga nada.")
        return

    tablas = construir(plan, datos, archivo)
    print(f"Registros: {resumen(tablas)}")

    if args.dry_run:
        for nombre in ORDEN_TABLAS:
            for fila in tablas[nombre][:2]:
                print(f"  {nombre}: " + str({k: v for k, v in fila.items() if v not in (None, "")})[:300])
        print("\n--dry-run: no se ha escrito nada en la base de datos.")
        return

    cargar(tablas)
    print("Cargado en Neon.")


def procesar(ruta, args):
    ruta = Path(ruta)
    if not ruta.is_file():
        raise ArchivoRechazado("el archivo no existe")

    texto = leer_texto(ruta)
    formato, delimitador = detectar_formato(texto)

    if formato == "csv":
        print(f"CSV detectado (delimitador {delimitador!r}).\n")
        cabecera, datos = tabla_desde_csv(texto, delimitador)
    elif formato == "json":
        print("JSON detectado.\n")
        cabecera, datos = tabla_desde_registros(leer_json(ruta))
    elif formato == "xml":
        print("XML detectado.\n")
        cabecera, datos = tabla_desde_registros(leer_xml(ruta))
    else:
        raise ArchivoRechazado("no es CSV, JSON ni XML")

    importar(cabecera, datos, ruta.name, args)


def main():
    ap = argparse.ArgumentParser(
        description="Lee CSV/JSON/XML y carga el historial clinico veterinario en Neon (Postgres)")
    ap.add_argument("archivo")
    ap.add_argument("--dry-run", action="store_true",
                    help="Muestra lo que se cargaria, sin tocar la base de datos")
    ap.add_argument("--modelo", default=MODELO_POR_DEFECTO, help="Modelo de Ollama")
    ap.add_argument("--url", default=OLLAMA_URL, help="URL de la API de Ollama")
    ap.add_argument("--sin-llm", action="store_true", help="Solo reglas fijas, sin Ollama")
    args = ap.parse_args()

    try:
        procesar(args.archivo, args)
    except ArchivoRechazado as e:
        sys.exit(f"Archivo rechazado: {e}")
    except Exception as e:
        sys.exit(f"Error al procesar el archivo: {e}")


if __name__ == "__main__":
    main()
