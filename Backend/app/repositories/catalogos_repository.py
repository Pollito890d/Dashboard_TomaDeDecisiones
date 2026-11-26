"""Lecturas de instituciones, períodos, fuentes y ejecución activa."""

from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.repositories.base import agregar_limite, clausula_where, consultar
from app.schemas.consultas import EjecucionActiva, Fuente, Institucion, Periodo


class CatalogosRepository:
    def __init__(self, sesion: Session) -> None:
        self._sesion = sesion

    def ejecucion_activa(self) -> list[EjecucionActiva]:
        sql = "SELECT * FROM v_ejecucion_activa"
        return consultar(self._sesion, sql, {}, EjecucionActiva)

    def instituciones(
        self,
        *,
        clave_seis: str | None = None,
        nombre: str | None = None,
        limite: int | None = None,
    ) -> list[Institucion]:
        filtros: list[str] = []
        parametros: dict[str, Any] = {}
        if clave_seis is not None:
            filtros.append("clave_seis = :clave_seis")
            parametros["clave_seis"] = clave_seis
        if nombre is not None:
            filtros.append("nombre ILIKE :nombre")
            parametros["nombre"] = f"%{nombre}%"
        sql = agregar_limite(
            f"SELECT * FROM dim_institucion{clausula_where(filtros)} ORDER BY nombre",
            limite,
            parametros,
        )
        return consultar(self._sesion, sql, parametros, Institucion)

    def periodos(
        self,
        *,
        anio: int | None = None,
        desde: date | None = None,
        hasta: date | None = None,
        limite: int | None = None,
    ) -> list[Periodo]:
        filtros: list[str] = []
        parametros: dict[str, Any] = {}
        if anio is not None:
            filtros.append("EXTRACT(YEAR FROM mes_id) = :anio")
            parametros["anio"] = anio
        if desde is not None:
            filtros.append("mes_id >= :desde")
            parametros["desde"] = desde
        if hasta is not None:
            filtros.append("mes_id <= :hasta")
            parametros["hasta"] = hasta
        sql = agregar_limite(
            f"SELECT * FROM dim_mes{clausula_where(filtros)} ORDER BY mes_id DESC",
            limite,
            parametros,
        )
        return consultar(self._sesion, sql, parametros, Periodo)

    def fuentes(
        self,
        *,
        fuente: str | None = None,
        rol: str | None = None,
        limite: int | None = None,
    ) -> list[Fuente]:
        filtros: list[str] = []
        parametros: dict[str, Any] = {}
        if fuente is not None:
            filtros.append("fuente = :fuente")
            parametros["fuente"] = fuente
        if rol is not None:
            filtros.append("rol = :rol")
            parametros["rol"] = rol
        sql = agregar_limite(
            "SELECT * FROM archivo_fuente"
            f"{clausula_where(filtros)}"
            " ORDER BY fuente, periodo_desde NULLS LAST, archivo_id",
            limite,
            parametros,
        )
        return consultar(self._sesion, sql, parametros, Fuente)
