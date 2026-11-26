"""Configuración de las pruebas específicas de los pasos 18 y 19."""

import sys
from pathlib import Path

import pytest

_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from app.database import SessionFactory  # noqa: E402
from app.services import construir_servicios  # noqa: E402


@pytest.fixture(scope="module")
def servicios():
    """Servicios reales sobre PostgreSQL, usando la sesión de solo lectura."""
    with SessionFactory() as sesion:
        yield construir_servicios(sesion)


@pytest.fixture(scope="module")
def sesion():
    """Sesión directa para SQL independiente de los servicios y repositorios."""
    with SessionFactory() as abierta:
        yield abierta
