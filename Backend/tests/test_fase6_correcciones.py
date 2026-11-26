"""Correcciones puntuales de la fase VI: períodos observados y catálogo completo."""

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_session
from app.main import app

cliente = TestClient(app)


def test_periodos_observados_por_fuente_de_la_ejecucion_activa() -> None:
    sector = cliente.get("/api/periodos?fuente=cnbv_sectorial&limite=100").json()
    assert sector["contrato_version"] == "1.0.0"
    assert sector["total"] == 23
    assert sector["periodos"][0] == "2025-12"
    assert sector["periodos"][-1] == "2024-02"
    assert sector["desde"] == "2024-02"
    assert sector["hasta"] == "2025-12"

    institucional = cliente.get(
        "/api/periodos?fuente=cnbv_institucional&limite=100"
    ).json()
    assert institucional["periodos"] == ["2025-12", "2025-09", "2025-06", "2025-03"]
    assert institucional["total"] == 4

    fonacot = cliente.get("/api/periodos?fuente=fonacot&limite=100").json()
    assert fonacot["total"] == 12
    assert fonacot["periodos"][0] == "2025-12"
    assert fonacot["periodos"][-1] == "2025-01"

    # SNIIV es anual; el catálogo sintetiza el cierre de diciembre de cada año.
    sniiv = cliente.get("/api/periodos?fuente=sniiv&limite=100").json()
    assert sniiv["periodos"] == ["2025-12"]

    filtrado = cliente.get("/api/periodos?fuente=cnbv_sectorial&anio=2024").json()
    assert filtrado["desde"] == "2024-02"
    assert filtrado["hasta"] == "2024-12"

    invalida = cliente.get("/api/periodos?fuente=inegi")
    assert invalida.status_code == 422
    assert invalida.json()["contrato_version"] == "1.0.0"


def test_catalogo_institucional_independiente_del_ranking() -> None:
    catalogo = cliente.get("/api/instituciones/catalogo").json()
    assert catalogo["contrato_version"] == "1.0.0"
    assert catalogo["granularidad"] == "catalogo_instituciones"
    assert catalogo["total"] == 155
    assert len(catalogo["instituciones"]) == 155
    assert len({fila["clave_seis"] for fila in catalogo["instituciones"]}) == 155
    assert any(fila["clave_seis"] == "029056" for fila in catalogo["instituciones"])

    ranking = cliente.get("/api/instituciones").json()
    assert ranking["total_devueltos"] == 10
    assert ranking["limitado"] is True

    ficha = cliente.get("/api/instituciones?clave_seis=029056").json()
    assert ficha["total_devueltos"] == 1

    # Consultar una sola ficha no reduce el catálogo del selector.
    catalogo_despues = cliente.get("/api/instituciones/catalogo").json()
    assert catalogo_despues["total"] == 155


def test_catalogo_institucional_con_postgres_caido_devuelve_503() -> None:
    class SesionRota:
        def execute(self, *_args: Any, **_kwargs: Any) -> None:
            raise SQLAlchemyError("fallo simulado")

    def sesion_rota():
        yield SesionRota()

    app.dependency_overrides[get_session] = sesion_rota
    try:
        respuesta = cliente.get("/api/instituciones/catalogo")
    finally:
        app.dependency_overrides.clear()

    assert respuesta.status_code == 503
    assert respuesta.json() == {
        "contrato_version": "1.0.0",
        "detail": "PostgreSQL no está disponible.",
    }
