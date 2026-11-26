"""Servicios FONACOT: detalle mensual y agregados trimestrales ya calculados en SQL."""

from sqlalchemy.orm import Session

from app.repositories.fonacot_repository import FonacotRepository
from app.schemas.consultas import (
    FonacotAmbitoTimestre,
    FonacotMes,
    FonacotTrimestreResumen,
)
from app.services.validadores import (
    validar_anio,
    validar_limite,
    validar_opcion,
    validar_trimestre,
)

_AMBITOS = {"entidad", "canal"}
_GENEROS = {"mujeres", "hombres"}


class FonacotService:
    def __init__(self, sesion: Session) -> None:
        self._repositorio = FonacotRepository(sesion)

    def detalle_mensual(
        self,
        *,
        anio: int | None = None,
        trimestre: str | None = None,
        tipo_ambito: str | None = None,
        genero: str | None = None,
        limite: int | None = None,
    ) -> list[FonacotMes]:
        validar_anio(anio)
        validar_trimestre(trimestre)
        validar_opcion(tipo_ambito, _AMBITOS, "tipo_ambito")
        validar_opcion(genero, _GENEROS, "genero")
        validar_limite(limite)
        return self._repositorio.detalle_mensual(
            anio=anio,
            trimestre=trimestre,
            tipo_ambito=tipo_ambito,
            genero=genero,
            limite=limite,
        )

    def resumen_trimestral(self, *, anio: int | None = None) -> list[FonacotTrimestreResumen]:
        validar_anio(anio)
        return self._repositorio.resumen_trimestral(anio=anio)

    def por_ambito_trimestral(
        self,
        *,
        anio: int | None = None,
        trimestre: str | None = None,
        tipo_ambito: str | None = None,
    ) -> list[FonacotAmbitoTimestre]:
        validar_anio(anio)
        validar_trimestre(trimestre)
        validar_opcion(tipo_ambito, _AMBITOS, "tipo_ambito")
        return self._repositorio.por_ambito_trimestral(
            anio=anio, trimestre=trimestre, tipo_ambito=tipo_ambito
        )
