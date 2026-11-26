"""Lecturas de SNIIV: detalle mensual, resumen anual y desglose por entidad."""

from typing import Any

from sqlalchemy.orm import Session

from app.repositories.base import agregar_limite, clausula_where, consultar
from app.schemas.consultas import SniivAnualResumen, SniivEntidadAnual, SniivMes


class SniivRepository:
    def __init__(self, sesion: Session) -> None:
        self._sesion = sesion

    def detalle_mensual(
        self,
        *,
        anio: int | None = None,
        cve_ent: str | None = None,
        sexo: str | None = None,
        limite: int | None = None,
    ) -> list[SniivMes]:
        filtros: list[str] = []
        parametros: dict[str, Any] = {}
        if anio is not None:
            filtros.append("anio = :anio")
            parametros["anio"] = anio
        if cve_ent is not None:
            filtros.append("cve_ent = :cve_ent")
            parametros["cve_ent"] = cve_ent
        if sexo is not None:
            filtros.append("sexo = :sexo")
            parametros["sexo"] = sexo
        sql = agregar_limite(
            "SELECT * FROM v_sniiv_mes_base"
            f"{clausula_where(filtros)}"
            " ORDER BY mes_id DESC, cve_ent NULLS LAST, cve_mun NULLS LAST",
            limite,
            parametros,
        )
        return consultar(self._sesion, sql, parametros, SniivMes)

    def resumen_anual(self, *, anio: int | None = None) -> list[SniivAnualResumen]:
        filtros: list[str] = []
        parametros: dict[str, Any] = {}
        if anio is not None:
            filtros.append("anio = :anio")
            parametros["anio"] = anio
        sql = (
            "SELECT * FROM v_kpis_sniiv_anual_resumen"
            f"{clausula_where(filtros)} ORDER BY anio"
        )
        return consultar(self._sesion, sql, parametros, SniivAnualResumen)

    def por_entidad_anual(
        self,
        *,
        anio: int | None = None,
        cve_ent: str | None = None,
    ) -> list[SniivEntidadAnual]:
        filtros: list[str] = []
        parametros: dict[str, Any] = {}
        if anio is not None:
            filtros.append("anio = :anio")
            parametros["anio"] = anio
        if cve_ent is not None:
            filtros.append("cve_ent = :cve_ent")
            parametros["cve_ent"] = cve_ent
        sql = (
            "SELECT * FROM v_kpis_sniiv_entidad_anual"
            f"{clausula_where(filtros)} ORDER BY anio, cve_ent NULLS LAST"
        )
        return consultar(self._sesion, sql, parametros, SniivEntidadAnual)
