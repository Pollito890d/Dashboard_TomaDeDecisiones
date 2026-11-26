"""Servicios SNIIV: detalle mensual y agregados anuales calculados en SQL."""

from sqlalchemy.orm import Session

from app.repositories.sniiv_repository import SniivRepository
from app.schemas.consultas import SniivAnualResumen, SniivEntidadAnual, SniivMes
from app.services.validadores import (
    validar_anio,
    validar_cve_ent,
    validar_limite,
    validar_opcion,
)

_SEXOS = {"1", "2"}


class SniivService:
    def __init__(self, sesion: Session) -> None:
        self._repositorio = SniivRepository(sesion)

    def detalle_mensual(
        self,
        *,
        anio: int | None = None,
        cve_ent: str | None = None,
        sexo: str | None = None,
        limite: int | None = None,
    ) -> list[SniivMes]:
        validar_anio(anio)
        validar_cve_ent(cve_ent)
        validar_opcion(sexo, _SEXOS, "sexo")
        validar_limite(limite)
        return self._repositorio.detalle_mensual(
            anio=anio, cve_ent=cve_ent, sexo=sexo, limite=limite
        )

    def resumen_anual(self, *, anio: int | None = None) -> list[SniivAnualResumen]:
        validar_anio(anio)
        return self._repositorio.resumen_anual(anio=anio)

    def por_entidad_anual(
        self, *, anio: int | None = None, cve_ent: str | None = None
    ) -> list[SniivEntidadAnual]:
        validar_anio(anio)
        validar_cve_ent(cve_ent)
        return self._repositorio.por_entidad_anual(anio=anio, cve_ent=cve_ent)
