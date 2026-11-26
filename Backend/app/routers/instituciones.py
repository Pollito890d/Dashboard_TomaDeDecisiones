"""Endpoint ``/api/instituciones``: fichas trimestrales por cooperativa SOCAP."""

from fastapi import APIRouter, Depends, HTTPException, Query

from app.routers._comun import (
    RESPUESTAS_ERROR,
    es_corte_trimestral,
    get_periodos_catalogo,
    get_servicios,
    periodo_a_anio,
    periodo_a_trimestre,
    proteger,
    trimestre_a_periodo,
    ultimo_periodo_catalogo,
    validar_anio,
    validar_periodo,
)
from app.schemas.consultas import Periodo
from app.schemas.respuestas import InstitucionesCatalogoResponse, InstitucionesResponse
from app.services import Servicios

router = APIRouter()

_NOTA = (
    "KPI-03 no es reproducible por cooperativa: kpi03_liquidez_no_disponible_pct "
    "se devuelve null. Los rankings excluyen valores n.d."
)


@router.get(
    "/api/instituciones/catalogo",
    response_model=InstitucionesCatalogoResponse,
    responses=RESPUESTAS_ERROR,
    tags=["instituciones"],
    summary="Catálogo completo de cooperativas SOCAP",
    description=(
        "Devuelve todas las cooperativas de `dim_institucion`, sin aplicar el `limite` "
        "del ranking ni filtrar por corte. Permite conservar las opciones del selector "
        "aunque el comparativo muestre solo unas cuantas fichas."
    ),
)
def catalogo_instituciones(
    servicios: Servicios = Depends(get_servicios),
) -> InstitucionesCatalogoResponse:
    filas = proteger(lambda: servicios.catalogos.instituciones())
    return InstitucionesCatalogoResponse(
        instituciones=filas,
        total=len(filas),
        sin_datos=not filas,
    )


@router.get(
    "/api/instituciones",
    response_model=InstitucionesResponse,
    responses=RESPUESTAS_ERROR,
    tags=["instituciones"],
    summary="Ranking y ficha institucional trimestral (boletines BE_SOCAPS)",
    description=(
        "Una fila por corte trimestral y clave_seis. Sin filtros usa el último corte con "
        "observaciones y devuelve como máximo `limite` fichas ordenadas por activo. "
        "Saldos semiaditivos: no se suman entre trimestres."
    ),
)
def instituciones(
    periodo: str | None = Query(
        default=None,
        pattern=r"^\d{4}-(?:0[1-9]|1[0-2])$",
        description="Corte trimestral YYYY-MM (meses 03, 06, 09 o 12).",
        examples=["2025-12"],
    ),
    trimestre: str | None = Query(
        default=None,
        pattern=r"^\d{4}-Q[1-4]$",
        description="Trimestre YYYY-Qn; debe ser coherente con periodo y anio.",
        examples=["2025-Q4"],
    ),
    clave_seis: str | None = Query(
        default=None,
        pattern=r"^\d{6}$",
        description="Clave CNBV de seis dígitos de la cooperativa.",
        examples=["029056"],
    ),
    anio: int | None = Query(
        default=None, ge=2000, le=2100, description="Año del corte trimestral.", examples=[2025]
    ),
    limite: int = Query(
        default=10, ge=1, le=100, description="Máximo de fichas devueltas (1..100)."
    ),
    servicios: Servicios = Depends(get_servicios),
    catalogo: list[Periodo] = Depends(get_periodos_catalogo),
) -> InstitucionesResponse:
    if trimestre is not None:
        anio_trimestre = int(trimestre[:4])
        if anio is not None and anio != anio_trimestre:
            raise HTTPException(status_code=422, detail="anio debe coincidir con trimestre.")
        anio = anio or anio_trimestre
        validar_anio(anio, catalogo)
        periodo = periodo or trimestre_a_periodo(trimestre)

    if periodo is not None:
        validar_periodo(periodo, catalogo)
        if not es_corte_trimestral(periodo):
            raise HTTPException(
                status_code=422,
                detail="periodo debe ser un corte trimestral (mes 03, 06, 09 o 12).",
            )
        anio_periodo = periodo_a_anio(periodo)
        trimestre_periodo = periodo_a_trimestre(periodo)
        if anio is not None and anio != anio_periodo:
            raise HTTPException(status_code=422, detail="anio debe coincidir con periodo.")
        if trimestre is not None and trimestre != trimestre_periodo:
            raise HTTPException(status_code=422, detail="trimestre debe coincidir con periodo.")
        anio = anio or anio_periodo
        trimestre = trimestre or trimestre_periodo

    if trimestre is None and anio is None:
        ultimo = proteger(lambda: servicios.cnbv_institucion.kpis_trimestrales(limite=1))
        if ultimo:
            anio = ultimo[0].anio
            trimestre = ultimo[0].trimestre
            periodo = ultimo[0].periodo_ym
        else:
            candidato = ultimo_periodo_catalogo(catalogo)
            if candidato is not None and es_corte_trimestral(candidato):
                anio = periodo_a_anio(candidato)
                trimestre = periodo_a_trimestre(candidato)
                periodo = candidato
    elif trimestre is None and anio is not None:
        validar_anio(anio, catalogo)
        cortes = [
            fila.mes_id.isoformat()[:7]
            for fila in catalogo
            if fila.mes_id.year == anio and es_corte_trimestral(fila.mes_id.isoformat()[:7])
        ]
        if cortes:
            periodo = max(cortes)
            trimestre = periodo_a_trimestre(periodo)

    filas = proteger(
        lambda: servicios.cnbv_institucion.kpis_trimestrales(
            anio=anio,
            trimestre=trimestre,
            clave_seis=clave_seis,
            limite=limite,
        )
    )
    corte_respuesta = periodo or (trimestre_a_periodo(trimestre) if trimestre else None)

    return InstitucionesResponse(
        corte=corte_respuesta,
        trimestre=trimestre,
        instituciones=filas,
        total_devueltos=len(filas),
        limitado=len(filas) == limite,
        sin_datos=not filas,
        nota=_NOTA,
    )
