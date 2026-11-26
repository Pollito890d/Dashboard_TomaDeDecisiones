"""Pruebas puntuales de los endpoints de los pasos 20 y 21 (no la suite del paso 22)."""

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.database import get_session
from app.main import app

cliente = TestClient(app)


def test_dashboard_por_defecto_y_comparacion_con_postgres(servicios) -> None:
    respuesta = cliente.get("/api/dashboard")
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["contrato_version"] == "1.0.0"
    assert cuerpo["granularidad"] == "sectorial_mensual"
    assert cuerpo["periodo_solicitado"] == "2025-12"
    assert cuerpo["sin_datos"] is False
    assert len(cuerpo["serie_anual"]) == 12
    assert len(cuerpo["bandas_2025"]) == 10

    referencia = servicios.cnbv_sector.kpis_mensuales(anio=2025, limite=1)[0]
    assert Decimal(cuerpo["corte"]["kpi03_liquidez_pct"]) == referencia.kpi03_liquidez_pct
    assert cuerpo["corte"]["kpi04_categoria_regulatoria"].startswith("Categoría 1")


def test_dashboard_periodo_valido_periodo_sin_datos_y_parametros_invalidos() -> None:
    marzo = cliente.get("/api/dashboard?periodo=2025-03")
    assert marzo.status_code == 200
    assert marzo.json()["corte"]["periodo_ym"] == "2025-03"

    sin_datos = cliente.get("/api/dashboard?periodo=2013-01")
    assert sin_datos.status_code == 200
    cuerpo = sin_datos.json()
    assert cuerpo["corte"] is None
    assert cuerpo["serie_anual"] == []
    assert cuerpo["sin_datos"] is True

    invalido = cliente.get("/api/dashboard?periodo=2025-13")
    assert invalido.status_code == 422
    assert invalido.json()["contrato_version"] == "1.0.0"
    assert invalido.json()["errores"]

    incoherente = cliente.get("/api/dashboard?periodo=2025-03&anio=2024")
    assert incoherente.status_code == 422


def test_instituciones_corte_trimestral_y_filtro_de_clave() -> None:
    respuesta = cliente.get("/api/instituciones")
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["granularidad"] == "institucional_trimestral"
    assert cuerpo["trimestre"] == "2025-Q4"
    assert cuerpo["total_devueltos"] == 10
    assert cuerpo["limitado"] is True
    assert all(
        fila["kpi03_liquidez_no_disponible_pct"] is None
        for fila in cuerpo["instituciones"]
    )

    cpm = cliente.get("/api/instituciones?trimestre=2025-Q4&clave_seis=029056")
    assert cpm.status_code == 200
    assert cpm.json()["total_devueltos"] == 1
    assert cpm.json()["instituciones"][0]["clave_seis"] == "029056"

    mes_no_trimestral = cliente.get("/api/instituciones?periodo=2025-05")
    assert mes_no_trimestral.status_code == 422


def test_periodos_y_fuentes() -> None:
    periodos = cliente.get("/api/periodos?anio=2025").json()
    assert periodos["total"] == 12
    assert periodos["periodos"][0] == "2025-12"
    assert periodos["desde"] == "2025-01"
    assert periodos["hasta"] == "2025-12"
    assert cliente.get("/api/periodos?anio=1999").status_code == 422

    fuentes = cliente.get("/api/fuentes?fuente=SNIIV").json()
    assert fuentes["total"] == 4
    assert all(fila["fuente"] == "SNIIV" for fila in fuentes["fuentes"])
    assert all(
        fila["rol"] == "hechos"
        for fila in cliente.get("/api/fuentes?rol=hechos").json()["fuentes"]
    )


def test_fonacot_resumen_y_desglose_opcional(servicios) -> None:
    respuesta = cliente.get("/api/fonacot?anio=2025&trimestre=2025-Q4")
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["por_ambito"] == []
    assert len(cuerpo["resumen_trimestral"]) == 1

    referencia = servicios.fonacot.resumen_trimestral(anio=2025)
    q4 = next(fila for fila in referencia if fila.trimestre == "2025-Q4")
    assert (
        Decimal(cuerpo["resumen_trimestral"][0]["creditos_totales_nacional"])
        == q4.creditos_totales_nacional
    )

    con_ambitos = cliente.get(
        "/api/fonacot?anio=2025&trimestre=2025-Q4&incluir_ambitos=true"
    )
    assert con_ambitos.status_code == 200
    assert len(con_ambitos.json()["por_ambito"]) > 0


def test_sniiv_resumen_y_desglose_opcional() -> None:
    respuesta = cliente.get("/api/sniiv?anio=2025")
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["por_entidad"] == []
    assert len(cuerpo["resumen_anual"]) == 1
    assert cuerpo["resumen_anual"][0]["total_registros_csv"] == 325649
    assert cuerpo["resumen_anual"][0]["m04_acciones_totales"] == "998745"

    con_entidades = cliente.get("/api/sniiv?anio=2025&incluir_entidades=true").json()
    assert len(con_entidades["por_entidad"]) == 33
    assert any(fila["cve_ent"] is None for fila in con_entidades["por_entidad"])


def test_fallo_de_postgres_devuelve_503_sin_credenciales() -> None:
    class SesionRota:
        def execute(self, *_args, **_kwargs):
            raise SQLAlchemyError("fallo simulado")

    def sesion_rota():
        yield SesionRota()

    app.dependency_overrides[get_session] = sesion_rota
    try:
        respuesta = cliente.get("/api/dashboard")
    finally:
        app.dependency_overrides.clear()

    assert respuesta.status_code == 503
    cuerpo = respuesta.json()
    assert cuerpo["contrato_version"] == "1.0.0"
    assert cuerpo["detail"] == "PostgreSQL no está disponible."
    assert "password" not in str(cuerpo).lower()
