"""Casos representativos de los servicios tipados contra PostgreSQL (solo lectura)."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import text

from app.database import SessionFactory
from app.services.validadores import validar_limite


def test_conexion_es_de_solo_lectura() -> None:
    with SessionFactory() as sesion:
        valor = sesion.execute(text("SHOW default_transaction_read_only")).scalar_one()
    assert valor == "on"


def test_sector_mensual_2025_y_kpi_publicado(servicios) -> None:
    filas = servicios.cnbv_sector.kpis_mensuales(anio=2025)
    assert len(filas) == 12
    assert {fila.anio for fila in filas} == {2025}
    assert todos_con_ventana_completa(filas)

    marzo = próxima(filas, "2025-03")
    assert marzo.kpi01_imor_pct is not None
    # El valor publicado en la vista está redondeado a 6 decimales.
    assert abs(marzo.kpi01_imor_pct - marzo.kpi01_imor_publicado_pct) < Decimal("0.000001")


def test_bandas_y_contraste_mantienen_granularidad(servicios) -> None:
    bandas = servicios.cnbv_sector.bandas_2025()
    assert len(bandas) == 10
    nicap = próxima(bandas, "KPI-04", atributo="kpi_id")
    assert nicap.umbral_regulatorio_min_pct == Decimal("100.0000000000")
    assert all(
        banda.umbral_regulatorio_min_pct is None
        for banda in bandas
        if banda.kpi_id != "KPI-04"
    )

    contraste = servicios.cnbv_sector.contraste_trimestral(anio=2025)
    assert len(contraste) == 4
    assert {fila.trimestre for fila in contraste} == {
        "2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4"
    }
    assert all(fila.diff_imor_pp is not None for fila in contraste)


def test_cnbv_institucional_conserva_nulos_y_separa_corte(servicios) -> None:
    filas = servicios.cnbv_institucion.kpis_trimestrales(anio=2025)
    assert len(filas) == 620
    assert {fila.trimestre for fila in filas} == {
        "2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4"
    }
    # KPI-03 no es reproducible por cooperativa: debe llegar como NULL explícito.
    assert all(fila.kpi03_liquidez_no_disponible_pct is None for fila in filas)
    assert all(len(fila.clave_seis) == 6 for fila in filas)

    cpm = servicios.cnbv_institucion.kpis_trimestrales(clave_seis="029056")
    assert len(cpm) == 4
    assert all(fila.clave_seis == "029056" for fila in cpm)


def test_fonacot_resumen_y_ambitos(servicios) -> None:
    resumen = servicios.fonacot.resumen_trimestral(anio=2025)
    assert len(resumen) == 4
    for fila in resumen:
        assert (
            fila.creditos_totales_nacional
            == fila.creditos_solo_entidades + fila.creditos_canal_app_movil
        )

    canal = servicios.fonacot.por_ambito_trimestral(anio=2025, tipo_ambito="canal")
    assert len(canal) == 4
    assert all(fila.ambito_canonico == "APP MOVIL" for fila in canal)


def test_sniiv_anual_y_entidades(servicios) -> None:
    resumen = servicios.sniiv.resumen_anual(anio=2025)
    assert len(resumen) == 1
    anual = resumen[0]
    assert anual.total_registros_csv == 325649
    assert anual.m04_acciones_totales == Decimal("998745")
    assert anual.filas_sin_sexo == 399

    entidades = servicios.sniiv.por_entidad_anual(anio=2025)
    assert len(entidades) == 33  # 32 entidades más el grupo con cve_ent NULL
    assert any(fila.cve_ent is None for fila in entidades)
    assert any(fila.cve_ent == "01" for fila in entidades)


def test_catalogos_instituciones_periodos_fuentes(servicios, sesion) -> None:
    ejecucion = servicios.catalogos.ejecucion_activa()
    assert len(ejecucion) == 1
    # La ejecución activa se comprueba contra la tabla real, sin id fijo.
    activa = sesion.execute(
        text(
            "SELECT ejecucion_id, estado FROM ejecucion_etl "
            "WHERE estado = 'exitosa' "
            "ORDER BY terminada_en DESC NULLS LAST, ejecucion_id DESC LIMIT 1"
        )
    ).mappings().one()
    assert ejecucion[0].ejecucion_id == activa["ejecucion_id"]
    assert ejecucion[0].estado == activa["estado"] == "exitosa"

    periodos = servicios.catalogos.periodos(anio=2025)
    assert len(periodos) == 12
    assert all(isinstance(fila.mes_id, date) for fila in periodos)

    assert len(servicios.catalogos.instituciones()) == 155
    fuentes = servicios.catalogos.fuentes()
    assert {fila.fuente for fila in fuentes} == {"CNBV", "FONACOT", "SNIIV"}
    assert all(fila.fuente == "CNBV" for fila in servicios.catalogos.fuentes(fuente="CNBV"))


@pytest.mark.parametrize(
    "funcion",
    [
        lambda: validar_limite(0),
        lambda: validar_limite(True),
    ],
)
def test_validacion_de_entradas(funcion) -> None:
    with pytest.raises(ValueError):
        funcion()


def todos_con_ventana_completa(filas) -> bool:
    return all(fila.ventana_12m_completa for fila in filas)


def próxima(filas, valor: str, atributo: str = "periodo_ym"):
    return next(fila for fila in filas if getattr(fila, atributo) == valor)
