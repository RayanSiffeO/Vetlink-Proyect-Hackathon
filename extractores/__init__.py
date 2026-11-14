"""Extractores: convierten cada formato en una lista de secciones (texto + origen)."""


def leer_texto(ruta):
    """Lee un archivo de texto probando las codificaciones habituales de los programas veterinarios."""
    datos = open(ruta, "rb").read()
    for cod in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            return datos.decode(cod)
        except UnicodeDecodeError:
            continue
    return datos.decode("utf-8", errors="replace")
