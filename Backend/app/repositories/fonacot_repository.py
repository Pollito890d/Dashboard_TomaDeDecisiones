"""Lecturas de FONACOT: detalle mensual, resumen trimestral y desglose por ámbito."""

from typing import Any

from sqlalchemy.orm import Session

from app.repositories.base import agregar_limite, clausula_where, consultar
from app.schemas.consultas import (
    FonacotAmbitoTimestre,
    FonacotMes,
    FonacotTrimestreResumen,
)


class FonacotRepository:
    def __init__(self, sesion: Session) -> None:
        self._sesion = sesion

    def detalle_mensual(
        self,
        *,
        anio: int | None = None,
        trimestre: str | None = None,
        tipo_ambito: str | None = None,
        genero: str | None = None,
        limite: int | None = None,
    ) -> list[FonacotMes]:
        filtros: list[str] = []
        parametros: dict[str, Any] = {}
        if anio is not None:
            filtros.append("anio = :anio")
            parametros["anio"] = anio
        if trimestre is not None:
            filtros.append("trimestre = :trimestre")
            parametros["trimestre"] = trimestre
        if tipo_ambito is not None:
            filtros.append("tipo_ambito = :tipo_ambito")
            parametros["tipo_ambito"] = tipo_ambito
        if genero is not None:
            filtros.append("genero = :genero")
            parametros["genero"] = genero
        sql = agregar_limite(
            "SELECT * FROM v_fonacot_mes_base"
            f"{clausula_where(filtros)}"
            " ORDER BY mes_id DESC, ambito_canonico, genero",
            limite,
            parametros,
        )
        return consultar(self._sesion, sql, parametros, FonacotMes)

    def resumen_trimestral(self, *, anio: int | None = None) -> list[FonacotTrimestreResumen]:
        filtros: list[str] = []
        parametros: dict[str, Any] = {}
        if anio is not None:
            filtros.append("anio = :anio")
            parametros["anio"] = anio
        sql = (
            "SELECT * FROM v_kpis_fonacot_trim_resumen"
            f"{clausula_where(filtros)} ORDER BY anio, trimestre"
        )
        return consultar(self._sesion, sql, parametros, FonacotTrimestreResumen)

    def por_ambito_trimestral(
        self,
        *,
        anio: int | None = None,
        trimestre: str | None = None,
        tipo_ambito: str | None = None,
    ) -> list[FonacotAmbitoTimestre]:
        filtros: list[str] = []
        parametros: dict[str, Any] = {}
        if anio is not None:
            filtros.append("anio = :anio")
            parametros["anio"] = anio
        if trimestre is not None:
            filtros.append("trimestre = :trimestre")
            parametros["trimestre"] = trimestre
        if tipo_ambito is not None:
            filtros.append("tipo_ambito = :tipo_ambito")
            parametros["tipo_ambito"] = tipo_ambito
        sql = (
            "SELECT * FROM v_kpis_fonacot_ambito_trim"
            f"{clausula_where(filtros)} ORDER BY anio, trimestre, ambito_canonico"
        )
        return consultar(self._sesion, sql, parametros, FonacotAmbitoTimestre)
