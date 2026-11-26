"""Endpoint ``/api/dashboard``: indicadores sectoriales mensuales de CNBV Series."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.routers._comun import (
    RESPUESTAS_ERROR,
    get_periodos_catalogo,
    get_servicios,
    periodo_a_anio,
    proteger,
    resumen_periodos,
    validar_anio,
    validar_periodo,
)
from app.schemas.consultas import Periodo
from app.schemas.respuestas import DashboardResponse
from app.services import Servicios

router = APIRouter()


@router.get(
    "/api/dashboard",
    response_model=DashboardResponse,
    responses=RESPUESTAS_ERROR,
    tags=["dashboard"],
    summary="Panel sectorial mensual (CNBV · SH_SOCAPS!Series)",
    description=(
        "Devuelve el corte mensual solicitado, hasta 12 cortes del mismo año y las bandas "
        "observadas en 2025. Los KPIs y promedios móviles ya vienen calculados de las vistas "
        "SQL; los saldos no se suman entre meses. Sin parámetros usa el último corte con "
        "observaciones. Un período del catálogo sin datos devuelve corte=null y serie_anual=[]."
    ),
)
def dashboard(
    periodo: str | None = Query(
        default=None,
        pattern=r"^\d{4}-(?:0[1-9]|1[0-2])$",
        description="Corte mensual YYYY-MM; debe existir en dim_mes.",
        examples=["2025-12"],
    ),
    anio: int | None = Query(
        default=None,
        ge=2000,
        le=2100,
        description="Año de la serie mensual; debe coincidir con periodo si ambos se envían.",
        examples=[2025],
    ),
    servicios: Servicios = Depends(get_servicios),
    catalogo: list[Periodo] = Depends(get_periodos_catalogo),
) -> DashboardResponse:
    resumen = resumen_periodos(catalogo)

    if periodo is not None:
        validar_periodo(periodo, catalogo)
        anio_periodo = periodo_a_anio(periodo)
        if anio is not None and anio != anio_periodo:
            raise HTTPException(
                status_code=422, detail="anio debe coincidir con el año de periodo."
            )
        anio = anio_periodo
    elif anio is not None:
        validar_anio(anio, catalogo)
    else:
        ultimo = proteger(lambda: servicios.cnbv_sector.kpis_mensuales(limite=1))
        if not ultimo:
            return DashboardResponse(
                periodo_solicitado=None,
                periodos_disponibles=resumen,
                sin_datos=True,
                nota="No hay observaciones de KPIs sectoriales en la instantánea activa.",
            )
        anio = ultimo[0].anio
        periodo = ultimo[0].periodo_ym

    serie = proteger(lambda: servicios.cnbv_sector.kpis_mensuales(anio=anio))
    bandas = proteger(lambda: servicios.cnbv_sector.bandas_2025())
    corte = (
        next((fila for fila in serie if fila.periodo_ym == periodo), None)
        if periodo is not None
        else None
    )
    sin_datos = not serie
    nota = None
    if sin_datos:
        nota = "No hay KPIs sectoriales para el año solicitado; corte=null y serie_anual=[]."
    elif corte is None:
        nota = "El período existe en el catálogo pero no tiene observación de KPIs; corte=null."

    return DashboardResponse(
        periodo_solicitado=periodo,
        periodos_disponibles=resumen,
        corte=corte,
        serie_anual=serie,
        bandas_2025=bandas,
        sin_datos=sin_datos,
        nota=nota,
    )
