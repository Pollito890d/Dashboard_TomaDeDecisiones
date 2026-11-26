"""Casos faltantes del paso 22: contrato, filtros, límites, fechas, nulos y errores."""

from decimal import Decimal
from typing import Any, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_session
from app.main import app

cliente = TestClient(app)

DATOS = (
    "/api/dashboard",
    "/api/instituciones",
    "/api/periodos",
    "/api/fuentes",
    "/api/fonacot",
    "/api/sniiv",
)

CLAVES_FICTICIAS = {
    "cuotas_vencidas",
    "liquidez_disponible",
    "obligaciones_corto_plazo",
    "evolucion_semanal",
    "sucursal",
    "codigo_socio",
    "telefono",
    "meta_colocacion_pct",
    "pct_socias_caja",
}

VALORES_FICTICIOS = {"8w", "Socio 001", "mockDashboardData", "2026-11-05"}


def _claves(cuerpo: Any) -> Iterator[str]:
    if isinstance(cuerpo, dict):
        for clave, valor in cuerpo.items():
            yield clave
            yield from _claves(valor)
    elif isinstance(cuerpo, list):
        for valor in cuerpo:
            yield from _claves(valor)


def _sin_datos_ficticios(texto: str, cuerpo: Any) -> bool:
    return not (
        CLAVES_FICTICIAS & set(_claves(cuerpo))
        or any(valor in texto for valor in VALORES_FICTICIOS)
    )


@pytest.mark.parametrize("url", DATOS)
def test_los_seis_endpoints_de_datos_cumplen_el_contrato(url: str) -> None:
    respuesta = cliente.get(url)
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["contrato_version"] == "1.0.0"
    assert isinstance(cuerpo["granularidad"], str)
    assert _sin_datos_ficticios(respuesta.text, cuerpo)


def test_health_no_lleva_version_por_diseno() -> None:
    respuesta = cliente.get("/api/health")
    assert respuesta.status_code == 200
    assert set(respuesta.json()) == {"status", "database", "detail"}


@pytest.mark.parametrize(
    "url",
    [
        "/api/dashboard?periodo=2025-03&anio=2025",
        "/api/instituciones?trimestre=2025-Q4&clave_seis=029056&limite=1",
        "/api/periodos?anio=2025&limite=1",
        "/api/fuentes?fuente=CNBV&rol=hechos&limite=1",
        "/api/fonacot?anio=2025&trimestre=2025-Q4",
        "/api/sniiv?anio=2025",
    ],
)
def test_filtros_validos_devuelven_200_y_contrato(url: str) -> None:
    respuesta = cliente.get(url)
    assert respuesta.status_code == 200
    assert respuesta.json()["contrato_version"] == "1.0.0"


@pytest.mark.parametrize(
    "url",
    [
        "/api/dashboard?periodo=2025-13",
        "/api/dashboard?periodo=2025-1",
        "/api/dashboard?periodo=2025-00",
        "/api/dashboard?periodo=2025-12-01",
        "/api/dashboard?anio=1999",
        "/api/dashboard?anio=2101",
        "/api/instituciones?periodo=2025-05",
        "/api/instituciones?periodo=2025-12&anio=2024",
        "/api/instituciones?trimestre=2025-Q5",
        "/api/instituciones?trimestre=2025-Q4&anio=2024",
        "/api/instituciones?clave_seis=02905",
        "/api/instituciones?clave_seis=abc123",
        "/api/instituciones?limite=0",
        "/api/instituciones?limite=101",
        "/api/periodos?limite=0",
        "/api/periodos?limite=101",
        "/api/fuentes?fuente=INEGI",
        "/api/fuentes?rol=otros",
        "/api/fuentes?limite=101",
        "/api/fonacot?trimestre=2025-Q9",
        "/api/fonacot?anio=1999",
        "/api/fonacot?anio=2025&trimestre=2024-Q1",
        "/api/sniiv?anio=2101",
    ],
)
def test_filtros_invalidos_devuelven_422_controlado(url: str) -> None:
    respuesta = cliente.get(url)
    assert respuesta.status_code == 422
    cuerpo = respuesta.json()
    assert cuerpo["contrato_version"] == "1.0.0"
    assert isinstance(cuerpo["detail"], str) and cuerpo["detail"]
    assert _sin_datos_ficticios(respuesta.text, cuerpo)


@pytest.mark.parametrize(
    ("url", "campo"),
    [
        ("/api/instituciones?trimestre=2025-Q4&limite=1", "instituciones"),
        ("/api/periodos?anio=2025&limite=1", "periodos"),
        ("/api/fuentes?fuente=SNIIV&limite=1", "fuentes"),
    ],
)
def test_limite_minimo_respeta_el_tope(url: str, campo: str) -> None:
    cuerpo = cliente.get(url).json()
    assert len(cuerpo[campo]) == 1
    assert cuerpo["total"] == 1 if "total" in cuerpo else cuerpo["total_devueltos"] == 1
    if "limitado" in cuerpo:
        assert cuerpo["limitado"] is True


def test_limite_maximo_no_genera_respuestas_masivas() -> None:
    instituciones = cliente.get(
        "/api/instituciones?trimestre=2025-Q4&limite=100"
    ).json()
    assert len(instituciones["instituciones"]) == 100
    assert instituciones["total_devueltos"] == 100
    assert instituciones["limitado"] is True

    periodos = cliente.get("/api/periodos?limite=100").json()
    assert len(periodos["periodos"]) == 100
    assert periodos["total"] == 100

    fuentes = cliente.get("/api/fuentes?limite=100").json()
    assert fuentes["total"] == len(fuentes["fuentes"]) <= 100


@pytest.mark.parametrize(
    ("url", "campo"),
    [
        ("/api/dashboard?periodo=2013-01", "corte"),
        ("/api/dashboard?periodo=2026-09", "corte"),
        ("/api/periodos?anio=2027", "periodos"),
        ("/api/instituciones?anio=2013", "instituciones"),
        ("/api/fonacot?anio=2013", "resumen_trimestral"),
        ("/api/sniiv?anio=2024", "resumen_anual"),
    ],
)
def test_periodos_del_catalogo_sin_observaciones_estan_controlados(
    url: str, campo: str
) -> None:
    respuesta = cliente.get(url)
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["contrato_version"] == "1.0.0"
    assert cuerpo["sin_datos"] is True
    assert cuerpo[campo] is None if campo == "corte" else cuerpo[campo] == []


def test_nulos_oficiales_se_conservan() -> None:
    bandas = {
        fila["kpi_id"]: fila
        for fila in cliente.get("/api/dashboard?periodo=2025-12").json()["bandas_2025"]
    }
    assert bandas["KPI-01"]["umbral_regulatorio_min_pct"] is None
    assert Decimal(bandas["KPI-04"]["umbral_regulatorio_min_pct"]) == Decimal(
        "100.0000000000"
    )

    instituciones = cliente.get(
        "/api/instituciones?trimestre=2025-Q4&limite=3"
    ).json()["instituciones"]
    assert all(
        fila["kpi03_liquidez_no_disponible_pct"] is None for fila in instituciones
    )

    fuentes = cliente.get("/api/fuentes?fuente=CNBV").json()["fuentes"]
    assert any(fila["descargado_en"] is None for fila in fuentes)

    entidades = cliente.get(
        "/api/sniiv?anio=2025&incluir_entidades=true"
    ).json()["por_entidad"]
    assert any(fila["cve_ent"] is None for fila in entidades)


def test_ficha_por_clave_usa_el_ultimo_corte_trimestral() -> None:
    cuerpo = cliente.get("/api/instituciones?clave_seis=029056").json()
    assert cuerpo["trimestre"] == "2025-Q4"
    assert cuerpo["corte"] == "2025-12"
    assert cuerpo["total_devueltos"] == 1
    assert cuerpo["instituciones"][0]["clave_seis"] == "029056"


@pytest.mark.parametrize("url", DATOS)
def test_fallo_de_postgres_en_cada_endpoint_no_devuelve_datos_ficticios(
    url: str,
) -> None:
    class SesionRota:
        def execute(self, *_args: Any, **_kwargs: Any) -> None:
            raise SQLAlchemyError("seudo; password=secreto")

    def sesion_rota():
        yield SesionRota()

    app.dependency_overrides[get_session] = sesion_rota
    try:
        respuesta = cliente.get(url)
    finally:
        app.dependency_overrides.clear()

    assert respuesta.status_code == 503
    assert respuesta.json() == {
        "contrato_version": "1.0.0",
        "detail": "PostgreSQL no está disponible.",
    }
    assert _sin_datos_ficticios(respuesta.text, respuesta.json())
