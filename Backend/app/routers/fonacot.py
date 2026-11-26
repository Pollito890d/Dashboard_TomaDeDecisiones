"""Endpoint ``/api/fonacot``: métricas oficiales M-03, separadas del universo CNBV."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.routers._comun import (
    RESPUESTAS_ERROR,
    get_periodos_catalogo,
    get_servicios,
    proteger,
    validar_anio,
)
from app.schemas.consultas import Periodo
from app.schemas.respuestas import FonacotResponse
from app.services import Servicios

router = APIRouter()


@router.get(
    "/api/fonacot",
    response_model=FonacotResponse,
    responses=RESPUESTAS_ERROR,
    tags=["contexto_externo"],
    summary="Crédito FONACOT (M-03) por trimestre",
    description=(
        "Resumen nacional con subtotales de entidades y canal APP MOVIL. Por omisión solo "
        "devuelve el resumen trimestral; `incluir_ambitos=true` agrega el desglose por "
        "entidad/canal. Créditos y montos son agregados oficiales, no estimaciones."
    ),
)
def fonacot(
    anio: int | None = Query(
        default=None, ge=2000, le=2100, description="Año del resumen; por omisión el último con datos.", examples=[2025]
    ),
    trimestre: str | None = Query(
        default=None,
        pattern=r"^\d{4}-Q[1-4]$",
        description="Filtra el resumen por trimestre YYYY-Qn.",
        examples=["2025-Q4"],
    ),
    incluir_ambitos: bool = Query(
        default=False,
        description="Incluye el desglose por entidad federativa o canal APP MOVIL.",
    ),
    servicios: Servicios = Depends(get_servicios),
    catalogo: list[Periodo] = Depends(get_periodos_catalogo),
) -> FonacotResponse:
    anio_trimestre = int(trimestre[:4]) if trimestre is not None else None
    if anio is not None and anio_trimestre is not None and anio != anio_trimestre:
        raise HTTPException(status_code=422, detail="anio debe coincidir con trimestre.")
    anio = anio or anio_trimestre

    if anio is not None:
        validar_anio(anio, catalogo)
        resumen = proteger(lambda: servicios.fonacot.resumen_trimestral(anio=anio))
    else:
        resumen = proteger(lambda: servicios.fonacot.resumen_trimestral())
        if resumen:
            anio = max(fila.anio for fila in resumen)

    if trimestre is not None:
        resumen = [fila for fila in resumen if fila.trimestre == trimestre]

    por_ambito = []
    if incluir_ambitos:
        por_ambito = proteger(
            lambda: servicios.fonacot.por_ambito_trimestral(
                anio=anio, trimestre=trimestre
            )
        )

    return FonacotResponse(
        resumen_trimestral=resumen,
        por_ambito=por_ambito,
        sin_datos=not resumen,
    )
