"""Fixtures de pruebas: se ejecuta el pipeline real dos veces sobre los originales de data/raw/."""

import json
from pathlib import Path
import sys

import pytest

ETL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ETL))

import run_etl  # noqa: E402
from config import load_settings  # noqa: E402


@pytest.fixture(scope='session')
def settings():
    # Sin ETL_* del entorno del usuario: pruebas reproducibles con los valores por defecto.
    return load_settings(env={})


@pytest.fixture(scope='session')
def runs(tmp_path_factory, settings):
    """Dos ejecuciones completas en directorios temporales (no toca data/processed)."""
    dirs = []
    for name in ('a', 'b'):
        out = tmp_path_factory.mktemp('run_' + name)
        assert run_etl.run(['--salida', str(out)], settings) == 0
        dirs.append(out)
    return dirs


@pytest.fixture(scope='session')
def manifest(runs):
    return json.loads((runs[0] / run_etl.MANIFIESTO).read_text(encoding='utf-8'))
