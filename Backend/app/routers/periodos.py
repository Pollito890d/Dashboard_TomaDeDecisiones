"""Endpoint ``/api/periodos``: catálogo mensual disponible (dim_mes)."""

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
        "Catálogo dim_mes en formato YYYY-MM, ordenado del más reciente al más antiguo. "
        "Sirve para validar los filtros de los demás endpoints; no implica que existan "
        "observaciones de KPIs en cada mes."
    ),
)
def periodos(
    anio: int | None = Query(
        default=None, ge=2000, le=2100, description="Filtra el catálogo por año.", examples=[2025]
    ),
    limite: int = Query(
        default=50, ge=1, le=100, description="Máximo de períodos devueltos (1..100)."
    ),
    servicios: Servicios = Depends(get_servicios),
) -> PeriodosResponse:
    filas = proteger(lambda: servicios.catalogos.periodos(anio=anio, limite=limite))
    valores = [fila.mes_id.isoformat()[:7] for fila in filas]
    return PeriodosResponse(
        periodos=valores,
        total=len(valores),
        desde=min(valores) if valores else None,
        hasta=max(valores) if valores else None,
        sin_datos=not valores,
    )
