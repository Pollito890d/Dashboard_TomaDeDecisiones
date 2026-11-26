"""Pruebas del endpoint de salud y de la documentación automática."""

from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_session
from app.main import app

cliente = TestClient(app)


def test_docs_y_openapi_solo_exponen_health() -> None:
    documentacion = cliente.get("/docs")
    assert documentacion.status_code == 200
    assert "swagger" in documentacion.text.lower()

    openapi = cliente.get("/openapi.json")
    assert openapi.status_code == 200
    esquema = openapi.json()
    assert set(esquema["paths"]) == {
        "/api/health",
        "/api/dashboard",
        "/api/instituciones",
        "/api/instituciones/catalogo",
        "/api/periodos",
        "/api/fuentes",
        "/api/fonacot",
        "/api/sniiv",
    }
    assert "get" in esquema["paths"]["/api/health"]
    assert "422" in esquema["paths"]["/api/dashboard"]["get"]["responses"]


def test_health_con_postgres_disponible() -> None:
    respuesta = cliente.get("/api/health")
    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "status": "ok",
        "database": "connected",
        "detail": None,
    }


def test_health_simula_fallo_de_conexion_sin_detener_docker() -> None:
    class SesionRota:
        def execute(self, *_args, **_kwargs):
            raise SQLAlchemyError("fallo simulado de conexion")

    def sesion_rota():
        yield SesionRota()

    app.dependency_overrides[get_session] = sesion_rota
    try:
        respuesta = cliente.get("/api/health")
    finally:
        app.dependency_overrides.clear()

    assert respuesta.status_code == 503
    cuerpo = respuesta.json()
    assert cuerpo["status"] == "unavailable"
    assert cuerpo["database"] == "disconnected"
    assert "credencial" not in str(cuerpo).lower()
