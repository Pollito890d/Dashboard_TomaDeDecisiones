"""Servicios de instituciones, períodos, fuentes y ejecución activa."""

from datetime import date

from sqlalchemy.orm import Session

from app.repositories.catalogos_repository import CatalogosRepository
from app.schemas.consultas import EjecucionActiva, Fuente, Institucion, Periodo
from app.services.validadores import validar_anio, validar_limite, validar_opcion

_FUENTES = {"CNBV", "FONACOT", "SNIIV"}
_FUENTES_PERIODOS = {
    "cnbv_sectorial",
    "cnbv_institucional",
    "fonacot",
    "sniiv",
}
_ROLES = {"hechos", "diccionario", "validacion"}


class CatalogosService:
    def __init__(self, sesion: Session) -> None:
        self._repositorio = CatalogosRepository(sesion)

    def ejecucion_activa(self) -> list[EjecucionActiva]:
        return self._repositorio.ejecucion_activa()

    def instituciones(
        self,
        *,
        clave_seis: str | None = None,
        nombre: str | None = None,
        limite: int | None = None,
    ) -> list[Institucion]:
        validar_limite(limite)
        return self._repositorio.instituciones(
            clave_seis=clave_seis, nombre=nombre, limite=limite
        )

    def periodos(
        self,
        *,
        anio: int | None = None,
        desde: date | None = None,
        hasta: date | None = None,
        limite: int | None = None,
        fuente: str | None = None,
    ) -> list[Periodo]:
        validar_anio(anio)
        validar_limite(limite)
        validar_opcion(fuente, _FUENTES_PERIODOS, "fuente")
        if desde and hasta and desde > hasta:
            raise ValueError("desde no puede ser posterior a hasta.")
        return self._repositorio.periodos(
            anio=anio, desde=desde, hasta=hasta, limite=limite, fuente=fuente
        )

    def fuentes(
        self,
        *,
        fuente: str | None = None,
        rol: str | None = None,
        limite: int | None = None,
    ) -> list[Fuente]:
        validar_opcion(fuente, _FUENTES, "fuente")
        validar_opcion(rol, _ROLES, "rol")
        validar_limite(limite)
        return self._repositorio.fuentes(fuente=fuente, rol=rol, limite=limite)
