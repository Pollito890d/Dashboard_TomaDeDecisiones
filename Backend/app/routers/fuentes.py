"""Endpoint ``/api/fuentes``: catálogo de archivos fuente con trazabilidad."""

from typing import Literal

from fastapi import APIRouter, Depends, Query

from app.routers._comun import RESPUESTAS_ERROR, get_servicios, proteger
from app.schemas.respuestas import FuentesResponse
from app.services import Servicios

router = APIRouter()


@router.get(
    "/api/fuentes",
    response_model=FuentesResponse,
    responses=RESPUESTAS_ERROR,
    tags=["catalogos"],
    summary="Fuentes oficiales y trazabilidad SHA-256",
    description=(
        "Filas de archivo_fuente: fuente, ruta, hash, rol y fechas de periodo. "
        "Los campos opcionales se devuelven como null cuando la fuente no los tiene."
    ),
)
def fuentes(
    fuente: Literal["CNBV", "FONACOT", "SNIIV"] | None = Query(
        default=None, description="Fuente oficial del archivo."
    ),
    rol: Literal["hechos", "diccionario", "validacion"] | None = Query(
        default=None, description="Rol del archivo en la carga."
    ),
    limite: int = Query(
        default=25, ge=1, le=100, description="Máximo de fuentes devueltas (1..100)."
    ),
    servicios: Servicios = Depends(get_servicios),
) -> FuentesResponse:
    filas = proteger(
        lambda: servicios.catalogos.fuentes(fuente=fuente, rol=rol, limite=limite)
    )
    return FuentesResponse(fuentes=filas, total=len(filas), sin_datos=not filas)
