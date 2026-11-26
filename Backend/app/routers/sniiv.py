"""Endpoint ``/api/sniiv``: métricas oficiales M-04, separadas del universo CNBV."""

from fastapi import APIRouter, Depends, Query

from app.routers._comun import (
    RESPUESTAS_ERROR,
    get_periodos_catalogo,
    get_servicios,
    proteger,
    validar_anio,
)
from app.schemas.consultas import Periodo
from app.schemas.respuestas import SniivResponse
from app.services import Servicios

router = APIRouter()


@router.get(
    "/api/sniiv",
    response_model=SniivResponse,
    responses=RESPUESTAS_ERROR,
    tags=["contexto_externo"],
    summary="Financiamientos de vivienda SNIIV (M-04) por año",
    description=(
        "Resumen nacional anual con conciliación de registros, acciones, monto, "
        "participación femenina y participación de INFONAVIT. Las filas sin sexo se "
        "conservan en el total y se excluyen solo del denominador de género definido "
        "en la vista SQL. `incluir_entidades=true` agrega el desglose por cve_ent."
    ),
)
def sniiv(
    anio: int | None = Query(
        default=None,
        ge=2000,
        le=2100,
        description="Año del resumen; por omisión el último con datos.",
        examples=[2025],
    ),
    incluir_entidades: bool = Query(
        default=False, description="Incluye el desglose por entidad federativa."
    ),
    servicios: Servicios = Depends(get_servicios),
    catalogo: list[Periodo] = Depends(get_periodos_catalogo),
) -> SniivResponse:
    if anio is not None:
        validar_anio(anio, catalogo)
        resumen = proteger(lambda: servicios.sniiv.resumen_anual(anio=anio))
    else:
        resumen = proteger(lambda: servicios.sniiv.resumen_anual())
        if resumen:
            anio = max(fila.anio for fila in resumen)

    por_entidad = []
    if incluir_entidades and anio is not None:
        por_entidad = proteger(lambda: servicios.sniiv.por_entidad_anual(anio=anio))

    return SniivResponse(
        resumen_anual=resumen,
        por_entidad=por_entidad,
        sin_datos=not resumen,
    )
