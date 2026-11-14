import argparse
import csv
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


def aplanar(valor, prefijo="", sep="."):
    plano = {}
    if isinstance(valor, dict):
        for k, v in valor.items():
            clave = f"{prefijo}{sep}{k}" if prefijo else str(k)
            plano.update(aplanar(v, clave, sep))
    elif isinstance(valor, list):
        if all(not isinstance(x, (dict, list)) for x in valor):
            plano[prefijo or "valor"] = ";".join(str(x) for x in valor)
        else:
            for i, v in enumerate(valor):
                clave = f"{prefijo}{sep}{i}" if prefijo else str(i)
                plano.update(aplanar(v, clave, sep))
    else:
        plano[prefijo or "valor"] = "" if valor is None else valor
    return plano


def escribir_csv(registros, destino, delimitador=","):
    filas = [aplanar(r) for r in registros]
    columnas = []
    for fila in filas:
        for c in fila:
            if c not in columnas:
                columnas.append(c)
    with open(destino, "w", newline="", encoding="utf-8-sig") as f:
        escritor = csv.DictWriter(f, fieldnames=columnas, delimiter=delimitador)
        escritor.writeheader()
        escritor.writerows(filas)
    return len(filas), len(columnas)


def _es_lista_de_dicts(v):
    return isinstance(v, list) and v and all(isinstance(x, dict) for x in v)


_CLAVES_META = {"meta", "metadata", "export", "exportacion", "info", "header", "cabecera"}


def registros_json(datos):
    if isinstance(datos, list):
        return datos
    if isinstance(datos, dict):
        # Solo se "desenvuelve" si el diccionario es un simple envoltorio:
        # una unica lista de objetos y el resto valores simples o un bloque de metadatos.
        listas = [v for v in datos.values() if _es_lista_de_dicts(v)]
        otros = [v for k, v in datos.items()
                 if not _es_lista_de_dicts(v)
                 and not (isinstance(v, dict) and str(k).lower() in _CLAVES_META)]
        if len(listas) == 1 and all(not isinstance(o, (dict, list)) for o in otros):
            return listas[0]
        return [datos]
    return [{"valor": datos}]


def leer_json(ruta):
    with open(ruta, encoding="utf-8") as f:
        return registros_json(json.load(f))


def elemento_a_dict(e):
    d = {f"@{k}": v for k, v in e.attrib.items()}
    hijos = list(e)
    if not hijos:
        texto = (e.text or "").strip()
        if d:
            if texto:
                d["#text"] = texto
            return d
        return texto
    for h in hijos:
        val = elemento_a_dict(h)
        if h.tag in d:
            if not isinstance(d[h.tag], list):
                d[h.tag] = [d[h.tag]]
            d[h.tag].append(val)
        else:
            d[h.tag] = val
    return d


def leer_xml(ruta):
    nodo = ET.parse(ruta).getroot()
    while len(nodo) == 1:
        sobrino = list(nodo[0])
        if sobrino and len({x.tag for x in sobrino}) == 1:
            nodo = nodo[0]
        else:
            break
    hijos = list(nodo)
    if not hijos:
        return [elemento_a_dict(nodo)]
    todos_hojas = all(len(h) == 0 for h in hijos)
    if todos_hojas and len({h.tag for h in hijos}) > 1:
        return [elemento_a_dict(nodo)]
    return [elemento_a_dict(h) for h in hijos]


def main():
    ap = argparse.ArgumentParser(description="Convierte JSON o XML a CSV")
    ap.add_argument("entrada")
    ap.add_argument("-o", "--salida")
    ap.add_argument("-d", "--delimitador", default=",")
    args = ap.parse_args()
    entrada = Path(args.entrada)
    salida = Path(args.salida) if args.salida else entrada.with_suffix(".csv")
    ext = entrada.suffix.lower()
    if ext == ".json":
        registros = leer_json(entrada)
    elif ext == ".xml":
        registros = leer_xml(entrada)
    else:
        sys.exit("Formato no soportado: usa un archivo .json o .xml")
    filas, cols = escribir_csv(registros, salida, args.delimitador)
    print(f"Listo: {filas} filas y {cols} columnas -> {salida}")


if __name__ == "__main__":
    main()
