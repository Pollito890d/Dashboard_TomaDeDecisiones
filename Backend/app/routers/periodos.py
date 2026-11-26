"""Endpoint ``/api/periodos``: catálogo mensual disponible (dim_mes o fuente)."""

from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.routers._comun import RESPUESTAS_ERROR, get_servicios, proteger
from app.schemas.respuestas import PeriodosResponse
from app.services import Servicios

router = APIRouter()


@router.get(
    "/api/periodos",
    response_model=PeriodosResponse,
    responses=RESPUESTAS_ERROR,
    tags=["catalogos"],
    summary="Períodos mensuales disponibles",
    description=(
        "Sin `fuente`, devuelve el catálogo dim_mes original en formato YYYY-MM, "
        "ordenado del más reciente al más antiguo; sirve para validar los filtros. "
        "Con `fuente`, devuelve únicamente períodos con observaciones de la ejecución "
        "activa en esa fuente (CNBV sectorial/institucional, FONACOT o SNIIV). "
        "La forma de la respuesta no cambia."
    ),
)
def periodos(
    anio: int | None = Query(
        default=None, ge=2000, le=2100, description="Filtra el catálogo por año.", examples=[2025]
    ),
    limite: int = Query(
        default=50, ge=1, le=100, description="Máximo de períodos devueltos (1..100)."
    ),
    fuente: Literal[
        "cnbv_sectorial", "cnbv_institucional", "fonacot", "sniiv"
    ] | None = Query(
        default=None,
        description="Fuente observada; omitir conserva el catálogo dim_mes.",
    ),
    servicios: Servicios = Depends(get_servicios),
) -> PeriodosResponse:
    filas = proteger(
        lambda: servicios.catalogos.periodos(anio=anio, limite=limite, fuente=fuente)
    )
    valores = [fila.mes_id.isoformat()[:7] for fila in filas]
    return PeriodosResponse(
        periodos=valores,
        total=len(valores),
        desde=min(valores) if valores else None,
        hasta=max(valores) if valores else None,
        sin_datos=not valores,
    )
