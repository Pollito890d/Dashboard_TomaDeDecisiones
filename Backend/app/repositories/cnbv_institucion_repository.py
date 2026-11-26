"""Lecturas del universo CNBV institucional trimestral (boletines BE_SOCAPS)."""

from typing import Any

from sqlalchemy.orm import Session

from app.repositories.base import agregar_limite, clausula_where, consultar
from app.schemas.consultas import InstitucionTrimestreBase, InstitucionTrimestreKpi


class CnbvInstitucionRepository:
    def __init__(self, sesion: Session) -> None:
        self._sesion = sesion

    def detalle_trimestral(
        self,
        *,
        anio: int | None = None,
        trimestre: str | None = None,
        clave_seis: str | None = None,
        institucion_id: int | None = None,
        limite: int | None = None,
    ) -> list[InstitucionTrimestreBase]:
        filtros, parametros = self._filtros(anio, trimestre, clave_seis, institucion_id)
        sql = agregar_limite(
            "SELECT * FROM v_cnbv_institucion_trim_base"
            f"{clausula_where(filtros)}"
            " ORDER BY mes_id DESC, clave_seis",
            limite,
            parametros,
        )
        return consultar(self._sesion, sql, parametros, InstitucionTrimestreBase)

    def kpis_trimestrales(
        self,
        *,
        anio: int | None = None,
        trimestre: str | None = None,
        clave_seis: str | None = None,
        institucion_id: int | None = None,
        limite: int | None = None,
    ) -> list[InstitucionTrimestreKpi]:
        filtros, parametros = self._filtros(anio, trimestre, clave_seis, institucion_id)
        sql = agregar_limite(
            "SELECT * FROM v_kpis_cnbv_institucion_trim"
            f"{clausula_where(filtros)}"
            " ORDER BY mes_id DESC, rank_activo_mayor_tamano NULLS LAST, clave_seis",
            limite,
            parametros,
        )
        return consultar(self._sesion, sql, parametros, InstitucionTrimestreKpi)

    @staticmethod
    def _filtros(
        anio: int | None,
        trimestre: str | None,
        clave_seis: str | None,
        institucion_id: int | None,
    ) -> tuple[list[str], dict[str, Any]]:
        filtros: list[str] = []
        parametros: dict[str, Any] = {}
        if anio is not None:
            filtros.append("anio = :anio")
            parametros["anio"] = anio
        if trimestre is not None:
            filtros.append("trimestre = :trimestre")
            parametros["trimestre"] = trimestre
        if clave_seis is not None:
            filtros.append("clave_seis = :clave_seis")
            parametros["clave_seis"] = clave_seis
        if institucion_id is not None:
            filtros.append("institucion_id = :institucion_id")
            parametros["institucion_id"] = institucion_id
        return filtros, parametros
