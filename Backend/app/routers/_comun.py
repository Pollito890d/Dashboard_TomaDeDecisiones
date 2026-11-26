"""Dependencias, errores controlados y validación de períodos compartidos por los routers."""

from collections.abc import Callable, Sequence
from typing import TypeVar

from fastapi import Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_session
from app.schemas.consultas import Periodo
from app.schemas.respuestas import ErrorResponse, PeriodosDisponibles
from app.services import Servicios, construir_servicios

T = TypeVar("T")

RESPUESTAS_ERROR = {
    422: {
        "model": ErrorResponse,
        "description": "Parámetro inválido o período no disponible en el catálogo.",
    },
    503: {
        "model": ErrorResponse,
        "description": "PostgreSQL no disponible (sin credenciales ni detalles internos).",
    },
}


def get_servicios(sesion: Session = Depends(get_session)) -> Servicios:
    """Una única instancia de servicios por petición, reutilizada por los routers."""
    return construir_servicios(sesion)


def proteger(consulta: Callable[[], T]) -> T:
    """Convierte errores de validación en 422 y fallos de PostgreSQL en 503."""
    try:
        return consulta()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="PostgreSQL no está disponible.") from exc


def get_periodos_catalogo(
    servicios: Servicios = Depends(get_servicios),
) -> list[Periodo]:
    """Catálogo dim_mes; FastAPI cachea el resultado dentro de la misma petición."""
    return proteger(lambda: servicios.catalogos.periodos())


def periodos_como_texto(periodos: Sequence[Periodo]) -> list[str]:
    return [periodo.mes_id.isoformat()[:7] for periodo in periodos]


def anios_disponibles(periodos: Sequence[Periodo]) -> set[int]:
    return {periodo.mes_id.year for periodo in periodos}


def resumen_periodos(periodos: Sequence[Periodo]) -> PeriodosDisponibles:
    valores = periodos_como_texto(periodos)
    return PeriodosDisponibles(
        desde=min(valores) if valores else None,
        hasta=max(valores) if valores else None,
        total=len(valores),
    )


def validar_periodo(periodo: str, periodos: Sequence[Periodo]) -> None:
    disponibles = set(periodos_como_texto(periodos))
    if periodo in disponibles:
        return
    if disponibles:
        detalle = (
            f"periodo {periodo} no disponible; "
            f"use un YYYY-MM entre {min(disponibles)} y {max(disponibles)}."
        )
    else:
        detalle = "periodo no disponible: el catálogo dim_mes está vacío."
    raise HTTPException(status_code=422, detail=detalle)


def validar_anio(anio: int, periodos: Sequence[Periodo]) -> None:
    if anio not in anios_disponibles(periodos):
        raise HTTPException(
            status_code=422,
            detail=f"anio {anio} sin períodos disponibles en el catálogo dim_mes.",
        )


def periodo_a_anio(periodo: str) -> int:
    return int(periodo[:4])


def es_corte_trimestral(periodo: str) -> bool:
    return int(periodo[5:7]) in (3, 6, 9, 12)


def periodo_a_trimestre(periodo: str) -> str:
    mes = int(periodo[5:7])
    return f"{periodo[:4]}-Q{(mes - 1) // 3 + 1}"


def trimestre_a_periodo(trimestre: str) -> str:
    anio, trim = trimestre.split("-Q")
    return f"{anio}-{int(trim) * 3:02d}"


def ultimo_periodo_catalogo(periodos: Sequence[Periodo]) -> str | None:
    valores = periodos_como_texto(periodos)
    return max(valores) if valores else None
