"""Creacion de tablas y carga en Neon (Postgres). Requiere: pip install "psycopg[binary]"."""
import os
from pathlib import Path

import psycopg

from transformador import COLUMNAS, IDS, ORDEN_TABLAS

DDL = """
CREATE TABLE IF NOT EXISTS paciente (
    paciente_id UUID PRIMARY KEY,
    archivo TEXT,
    importado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    nombre TEXT, especie TEXT, raza TEXT,
    sexo TEXT CHECK (sexo IN ('macho', 'hembra')),
    esterilizado BOOLEAN,
    fecha_nacimiento DATE,
    edad TEXT, color TEXT, microchip TEXT,
    peso_actual_kg NUMERIC,
    condicion_corporal TEXT, alimentacion TEXT, estilo_vida TEXT, temperamento TEXT,
    bozal BOOLEAN,
    clinica TEXT, veterinario_referencia TEXT
);
CREATE TABLE IF NOT EXISTS visita (
    visita_id UUID PRIMARY KEY,
    paciente_id UUID NOT NULL REFERENCES paciente ON DELETE CASCADE,
    fecha DATE,
    tipo TEXT, motivo TEXT, anamnesis TEXT, exploracion TEXT, diagnostico TEXT,
    tratamiento TEXT, proxima_cita TEXT,
    temperatura_c NUMERIC, frecuencia_cardiaca INTEGER, frecuencia_respiratoria INTEGER,
    peso_kg NUMERIC,
    condicion_corporal TEXT
);
CREATE TABLE IF NOT EXISTS prueba (
    prueba_id BIGSERIAL PRIMARY KEY,
    paciente_id UUID NOT NULL REFERENCES paciente ON DELETE CASCADE,
    visita_id UUID REFERENCES visita ON DELETE CASCADE,
    panel TEXT, prueba TEXT, resultado TEXT, unidad TEXT, referencia TEXT, indicador TEXT
);
CREATE TABLE IF NOT EXISTS tratamiento (
    tratamiento_id BIGSERIAL PRIMARY KEY,
    paciente_id UUID NOT NULL REFERENCES paciente ON DELETE CASCADE,
    visita_id UUID REFERENCES visita ON DELETE CASCADE,
    orden TEXT, medicamento TEXT, dosis TEXT, indicacion TEXT, duracion TEXT, suspension TEXT
);
CREATE TABLE IF NOT EXISTS otros (
    otros_id BIGSERIAL PRIMARY KEY,
    paciente_id UUID NOT NULL REFERENCES paciente ON DELETE CASCADE,
    visita_id UUID REFERENCES visita ON DELETE CASCADE,
    seccion TEXT NOT NULL, registro TEXT, campo TEXT NOT NULL, valor TEXT
);
CREATE INDEX IF NOT EXISTS visita_paciente_idx ON visita (paciente_id);
CREATE INDEX IF NOT EXISTS prueba_paciente_idx ON prueba (paciente_id);
CREATE INDEX IF NOT EXISTS tratamiento_paciente_idx ON tratamiento (paciente_id);
CREATE INDEX IF NOT EXISTS otros_paciente_idx ON otros (paciente_id, seccion);
"""


def _url():
    url = os.environ.get("NEON_DATABASE_URL")
    if not url and Path(".env").is_file():       # alternativa: fichero .env en la carpeta actual
        for linea in Path(".env").read_text(encoding="utf-8").splitlines():
            k, _, v = linea.partition("=")
            if k.strip().removeprefix("export ").strip() == "NEON_DATABASE_URL":
                url = v.strip().strip("'\"")
    if not url:
        raise RuntimeError("falta la variable de entorno NEON_DATABASE_URL")
    return url


def cargar(tablas, url=None):
    """Crea las tablas si no existen e inserta todo en una sola transaccion."""
    with psycopg.connect(url or _url()) as conn:      # commit al salir; rollback si hay error
        with conn.cursor() as cur:
            cur.execute(DDL)
            for tabla in ORDEN_TABLAS:
                filas = tablas.get(tabla, [])
                if not filas:
                    continue
                cols = IDS[tabla] + COLUMNAS[tabla]
                cur.executemany(
                    f"INSERT INTO {tabla} ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))})",
                    [[f.get(c) for c in cols] for f in filas],
                )
