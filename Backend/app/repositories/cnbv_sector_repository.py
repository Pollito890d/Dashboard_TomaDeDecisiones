"""Lecturas del universo CNBV sectorial mensual (SH_SOCAPS!Series).

Todas las consultas se hacen sobre vistas de la instantánea activa; los KPIs y
promedios móviles ya están calculados en SQL y no se reproducen aquí.
"""

from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.repositories.base import agregar_limite, clausula_where, consultar
from app.schemas.consultas import (
    ConceptoSectorMensual,
    ContrasteTrimestre,
    SectorBanda2025,
    SectorKpiMensual,
    SectorPivoteMensual,
)


class CnbvSectorRepository:
    def __init__(self, sesion: Session) -> None:
        self._sesion = sesion

    def conceptos_mes(
        self,
        *,
        mes_id: date | None = None,
        fila_series: int | None = None,
        limite: int | None = None,
    ) -> list[ConceptoSectorMensual]:
        filtros: list[str] = []
        parametros: dict[str, Any] = {}
        if mes_id is not None:
            filtros.append("mes_id = :mes_id")
            parametros["mes_id"] = mes_id
        if fila_series is not None:
            filtros.append("fila_series = :fila_series")
            parametros["fila_series"] = fila_series
        sql = agregar_limite(
            "SELECT * FROM v_cnbv_sector_conceptos_mes"
            f"{clausula_where(filtros)} ORDER BY mes_id DESC, fila_series, concepto_id",
            limite,
            parametros,
        )
        return consultar(self._sesion, sql, parametros, ConceptoSectorMensual)

    def pivote_mensual(
        self,
        *,
        anio: int | None = None,
        limite: int | None = None,
    ) -> list[SectorPivoteMensual]:
        filtros: list[str] = []
        parametros: dict[str, Any] = {}
        if anio is not None:
            filtros.append("anio = :anio")
            parametros["anio"] = anio
        sql = agregar_limite(
            f"SELECT * FROM v_cnbv_sector_pivot_mes{clausula_where(filtros)}"
            " ORDER BY mes_id DESC",
            limite,
            parametros,
        )
        return consultar(self._sesion, sql, parametros, SectorPivoteMensual)

    def kpis_mensuales(
        self,
        *,
        anio: int | None = None,
        periodo_desde: str | None = None,
        periodo_hasta: str | None = None,
        limite: int | None = None,
    ) -> list[SectorKpiMensual]:
        filtros: list[str] = []
        parametros: dict[str, Any] = {}
        if anio is not None:
            filtros.append("anio = :anio")
            parametros["anio"] = anio
        if periodo_desde is not None:
            filtros.append("periodo_ym >= :periodo_desde")
            parametros["periodo_desde"] = periodo_desde
        if periodo_hasta is not None:
            filtros.append("periodo_ym <= :periodo_hasta")
            parametros["periodo_hasta"] = periodo_hasta
        sql = agregar_limite(
            f"SELECT * FROM v_kpis_cnbv_sector_mes{clausula_where(filtros)}"
            " ORDER BY mes_id DESC",
            limite,
            parametros,
        )
        return consultar(self._sesion, sql, parametros, SectorKpiMensual)

    def bandas_2025(self) -> list[SectorBanda2025]:
        sql = "SELECT * FROM v_kpis_cnbv_sector_bandas_2025 ORDER BY kpi_id"
        return consultar(self._sesion, sql, {}, SectorBanda2025)

    def contraste_trimestral(
        self,
        *,
        anio: int | None = None,
        trimestre: str | None = None,
    ) -> list[ContrasteTrimestre]:
        filtros: list[str] = []
        parametros: dict[str, Any] = {}
        if anio is not None:
            filtros.append("periodo_ym LIKE :prefijo_anio")
            parametros["prefijo_anio"] = f"{anio}-%"
        if trimestre is not None:
            filtros.append("trimestre = :trimestre")
            parametros["trimestre"] = trimestre
        sql = (
            "SELECT * FROM v_kpis_cnbv_contraste_trim"
            f"{clausula_where(filtros)} ORDER BY mes_id"
        )
        return consultar(self._sesion, sql, parametros, ContrasteTrimestre)
