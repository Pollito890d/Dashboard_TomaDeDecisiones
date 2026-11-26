"""Comparaciones con PostgreSQL mediante SQL directo, independiente de servicios y repositorios."""

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.main import app

cliente = TestClient(app)

# Consultas escritas contra las tablas de hechos, sin usar vistas de KPIs ni servicios.
SQL_NUEVE_KPIS = """
WITH conceptos AS (
    SELECT h.mes_id, c.fila_series, MAX(h.valor) AS valor
    FROM hecho_cnbv_sector_mes h
    JOIN v_ejecucion_activa ea ON ea.ejecucion_id = h.ejecucion_id
    JOIN dim_concepto_cnbv c
      ON c.concepto_id = h.concepto_id AND c.archivo_id = h.archivo_id
    GROUP BY h.mes_id, c.fila_series
), pivote AS (
    SELECT mes_id,
        MAX(valor) FILTER (WHERE fila_series = 5) AS v005,
        MAX(valor) FILTER (WHERE fila_series = 9) AS v009,
        MAX(valor) FILTER (WHERE fila_series = 13) AS v013,
        MAX(valor) FILTER (WHERE fila_series = 17) AS v017,
        MAX(valor) FILTER (WHERE fila_series = 21) AS v021,
        MAX(valor) FILTER (WHERE fila_series = 35) AS v035,
        MAX(valor) FILTER (WHERE fila_series = 46) AS v046,
        MAX(valor) FILTER (WHERE fila_series = 141) AS v141,
        MAX(valor) FILTER (WHERE fila_series = 145) AS v145,
        MAX(valor) FILTER (WHERE fila_series = 153) AS v153,
        MAX(valor) FILTER (WHERE fila_series = 194) AS v194,
        MAX(valor) FILTER (WHERE fila_series = 195) AS v195,
        MAX(valor) FILTER (WHERE fila_series = 203) AS v203,
        MAX(valor) FILTER (WHERE fila_series = 204) AS v204,
        MAX(valor) FILTER (WHERE fila_series = 212) AS v212,
        MAX(valor) FILTER (WHERE fila_series = 213) AS v213
    FROM conceptos GROUP BY mes_id
), ventanas AS (
    SELECT pivote.*,
        AVG(v005) OVER (ORDER BY mes_id ROWS BETWEEN 11 PRECEDING AND CURRENT ROW) AS prom005,
        AVG(v013) OVER (ORDER BY mes_id ROWS BETWEEN 11 PRECEDING AND CURRENT ROW) AS prom013,
        AVG(v035) OVER (ORDER BY mes_id ROWS BETWEEN 11 PRECEDING AND CURRENT ROW) AS prom035
    FROM pivote
)
SELECT to_char(mes_id, 'YYYY-MM') AS periodo_ym,
    (v017 / NULLIF(v009, 0) * 100)::numeric(20,10) AS kpi01,
    (ABS(v021) / NULLIF(v017, 0) * 100)::numeric(20,10) AS kpi02,
    (v194 / NULLIF(v195, 0) * 100)::numeric(20,10) AS kpi03,
    (v212 / NULLIF(v213, 0) * 100)::numeric(20,10) AS kpi04,
    (v145 / NULLIF(prom013, 0) * 100)::numeric(20,10) AS kpi05,
    (v153 / NULLIF(prom035, 0) * 100)::numeric(20,10) AS kpi06,
    (v046 / NULLIF(v005, 0) * 100)::numeric(20,10) AS kpi07,
    (v141 / NULLIF(prom005, 0) * 100)::numeric(20,10) AS kpi08,
    (v013 / NULLIF(v035, 0) * 100)::numeric(20,10) AS kpi09,
    (v203 / NULLIF(v203 + v204, 0) * 100)::numeric(20,10) AS m01
FROM ventanas
WHERE mes_id = DATE '2025-12-01'
"""

SQL_RANKING = """
SELECT TRIM(di.clave_seis) AS clave_seis, i.activo_mxn,
    DENSE_RANK() OVER (ORDER BY i.activo_mxn DESC) AS rank_activo
FROM hecho_cnbv_institucion_trim i
JOIN v_ejecucion_activa ea ON ea.ejecucion_id = i.ejecucion_id
JOIN dim_institucion di ON di.institucion_id = i.institucion_id
WHERE i.mes_id = DATE '2025-12-01' AND i.activo_mxn IS NOT NULL
ORDER BY i.activo_mxn DESC, di.clave_seis
LIMIT 10
"""

SQL_FONACOT = """
SELECT SUM(f.creditos) AS creditos,
    SUM(f.monto_mxn) AS monto,
    (SUM(f.creditos) FILTER (WHERE g.etiqueta = 'mujeres')::numeric
        / NULLIF(SUM(f.creditos)::numeric, 0) * 100)::numeric(20,10) AS pct_creditos,
    (SUM(f.monto_mxn) FILTER (WHERE g.etiqueta = 'mujeres')
        / NULLIF(SUM(f.monto_mxn), 0) * 100)::numeric(20,10) AS pct_monto,
    (SUM(f.monto_mxn) / NULLIF(SUM(f.creditos)::numeric, 0))::numeric(30,6) AS ticket,
    SUM(f.creditos) FILTER (WHERE a.tipo = 'entidad') AS creditos_entidad,
    SUM(f.creditos) FILTER (WHERE a.tipo = 'canal') AS creditos_app
FROM hecho_fonacot_mes f
JOIN v_ejecucion_activa ea ON ea.ejecucion_id = f.ejecucion_id
JOIN dim_ambito_fonacot a ON a.ambito_id = f.ambito_id
JOIN dim_genero_fonacot g ON g.genero_id = f.genero_id
WHERE f.mes_id BETWEEN DATE '2025-10-01' AND DATE '2025-12-01'
"""

SQL_SNIIV = """
SELECT COUNT(*) AS filas, SUM(s.acciones) AS acciones, SUM(s.monto_mxn) AS monto,
    COUNT(*) FILTER (WHERE s.sexo IS NULL) AS sin_sexo,
    (SUM(s.acciones) FILTER (WHERE s.sexo = '2')::numeric
        / NULLIF(SUM(s.acciones) FILTER (WHERE s.sexo IN ('1','2'))::numeric, 0) * 100)::numeric(20,10)
        AS pct_mujeres,
    (SUM(s.acciones) FILTER (WHERE s.organismo = '1')::numeric
        / NULLIF(SUM(s.acciones)::numeric, 0) * 100)::numeric(20,10) AS pct_infonavit
FROM hecho_sniiv_mes s
JOIN v_ejecucion_activa ea ON ea.ejecucion_id = s.ejecucion_id
WHERE EXTRACT(YEAR FROM s.mes_id) = 2025
"""

CAMPOS_KPI = {
    1: "kpi01_imor_pct",
    2: "kpi02_icor_pct",
    3: "kpi03_liquidez_pct",
    4: "kpi04_nicap_pct",
    5: "kpi05_tasa_activa_pct",
    6: "kpi06_tasa_pasiva_pct",
    7: "kpi07_capital_activo_pct",
    8: "kpi08_roa_pct",
    9: "kpi09_colocacion_captacion_trad_pct",
}


def test_la_conexion_directa_es_de_solo_lectura(sesion: Session) -> None:
    assert sesion.execute(text("SHOW default_transaction_read_only")).scalar_one() == "on"


def test_nueve_kpis_sectoriales_contra_sql_independiente(sesion: Session) -> None:
    referencia = dict(sesion.execute(text(SQL_NUEVE_KPIS)).mappings().one())
    corte = cliente.get("/api/dashboard?periodo=2025-12").json()["corte"]
    assert corte["periodo_ym"] == referencia["periodo_ym"]
    for numero, campo in CAMPOS_KPI.items():
        assert Decimal(corte[campo]) == referencia[f"kpi{numero:02d}"], campo
    assert (
        Decimal(corte["m01_participacion_femenina_socios_pct"]) == referencia["m01"]
    )


def test_ranking_institucional_contra_sql_independiente(sesion: Session) -> None:
    referencia = [dict(fila) for fila in sesion.execute(text(SQL_RANKING)).mappings()]
    respuesta = cliente.get(
        "/api/instituciones?trimestre=2025-Q4&limite=10"
    ).json()["instituciones"]
    assert [fila["clave_seis"] for fila in referencia] == [
        fila["clave_seis"] for fila in respuesta
    ]
    for esperado, obtenido in zip(referencia, respuesta, strict=True):
        assert Decimal(obtenido["activo_mxn"]) == esperado["activo_mxn"]
        assert obtenido["rank_activo_mayor_tamano"] == esperado["rank_activo"]


def test_fonacot_contra_sql_independiente(sesion: Session) -> None:
    referencia = dict(sesion.execute(text(SQL_FONACOT)).mappings().one())
    obtenido = cliente.get(
        "/api/fonacot?anio=2025&trimestre=2025-Q4"
    ).json()["resumen_trimestral"][0]
    assert int(obtenido["creditos_totales_nacional"]) == int(referencia["creditos"])
    assert Decimal(obtenido["monto_total_nacional_mxn"]) == referencia["monto"]
    assert (
        Decimal(obtenido["m03_participacion_femenina_creditos_pct"])
        == referencia["pct_creditos"]
    )
    assert (
        Decimal(obtenido["m03_participacion_femenina_monto_pct"])
        == referencia["pct_monto"]
    )
    assert (
        Decimal(obtenido["m03_ticket_promedio_nacional_mxn"]) == referencia["ticket"]
    )
    assert (
        int(obtenido["creditos_solo_entidades"]) == int(referencia["creditos_entidad"])
    )
    assert (
        int(obtenido["creditos_canal_app_movil"]) == int(referencia["creditos_app"])
    )


def test_sniiv_contra_sql_independiente(sesion: Session) -> None:
    referencia = dict(sesion.execute(text(SQL_SNIIV)).mappings().one())
    obtenido = cliente.get("/api/sniiv?anio=2025").json()["resumen_anual"][0]
    assert obtenido["total_registros_csv"] == referencia["filas"]
    assert int(obtenido["m04_acciones_totales"]) == int(referencia["acciones"])
    assert Decimal(obtenido["m04_monto_total_mxn"]) == referencia["monto"]
    assert obtenido["filas_sin_sexo"] == referencia["sin_sexo"]
    assert (
        Decimal(obtenido["m04_participacion_mujeres_acciones_pct"])
        == referencia["pct_mujeres"]
    )
    assert (
        Decimal(obtenido["m04_participacion_infonavit_acciones_pct"])
        == referencia["pct_infonavit"]
    )


def test_ninguna_respuesta_expone_la_contraseña_de_la_base() -> None:
    from sqlalchemy.engine import make_url

    secreto = make_url(settings.database_url).password or ""
    assert secreto, "DATABASE_URL debe tener contraseña configurada."
    rutas = (
        "/api/health",
        "/api/dashboard",
        "/api/instituciones",
        "/api/periodos",
        "/api/fuentes",
        "/api/fonacot",
        "/api/sniiv",
        "/api/dashboard?periodo=2025-13",
        "/openapi.json",
    )
    for ruta in rutas:
        assert secreto not in cliente.get(ruta).text, ruta
