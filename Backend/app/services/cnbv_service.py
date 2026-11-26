"""Servicios CNBV: sectorial mensual e institucional trimestral, sin mezclar granularidades."""

from datetime import date

from sqlalchemy.orm import Session

from app.repositories.cnbv_institucion_repository import CnbvInstitucionRepository
from app.repositories.cnbv_sector_repository import CnbvSectorRepository
from app.schemas.consultas import (
    ConceptoSectorMensual,
    ContrasteTrimestre,
    InstitucionTrimestreBase,
    InstitucionTrimestreKpi,
    SectorBanda2025,
    SectorKpiMensual,
    SectorPivoteMensual,
)
from app.services.validadores import (
    validar_anio,
    validar_clave_seis,
    validar_limite,
    validar_periodo_ym,
    validar_trimestre,
)


class CnbvSectorService:
    """Serie consolidada mensual: una fila por mes, sin dimensión institución."""

    def __init__(self, sesion: Session) -> None:
        self._repositorio = CnbvSectorRepository(sesion)

    def conceptos_mes(
        self,
        *,
        mes_id: date | None = None,
        fila_series: int | None = None,
        limite: int | None = None,
    ) -> list[ConceptoSectorMensual]:
        validar_limite(limite)
        return self._repositorio.conceptos_mes(
            mes_id=mes_id, fila_series=fila_series, limite=limite
        )

    def pivote_mensual(
        self, *, anio: int | None = None, limite: int | None = None
    ) -> list[SectorPivoteMensual]:
        validar_anio(anio)
        validar_limite(limite)
        return self._repositorio.pivote_mensual(anio=anio, limite=limite)

    def kpis_mensuales(
        self,
        *,
        anio: int | None = None,
        periodo_desde: str | None = None,
        periodo_hasta: str | None = None,
        limite: int | None = None,
    ) -> list[SectorKpiMensual]:
        validar_anio(anio)
        validar_periodo_ym(periodo_desde, "periodo_desde")
        validar_periodo_ym(periodo_hasta, "periodo_hasta")
        validar_limite(limite)
        if periodo_desde and periodo_hasta and periodo_desde > periodo_hasta:
            raise ValueError("periodo_desde no puede ser posterior a periodo_hasta.")
        return self._repositorio.kpis_mensuales(
            anio=anio,
            periodo_desde=periodo_desde,
            periodo_hasta=periodo_hasta,
            limite=limite,
        )

    def bandas_2025(self) -> list[SectorBanda2025]:
        return self._repositorio.bandas_2025()

    def contraste_trimestral(
        self, *, anio: int | None = None, trimestre: str | None = None
    ) -> list[ContrasteTrimestre]:
        validar_anio(anio)
        validar_trimestre(trimestre)
        return self._repositorio.contraste_trimestral(anio=anio, trimestre=trimestre)


class CnbvInstitucionService:
    """Detalle trimestral por cooperativa: una fila por mes × institución."""

    def __init__(self, sesion: Session) -> None:
        self._repositorio = CnbvInstitucionRepository(sesion)

    def detalle_trimestral(
        self,
        *,
        anio: int | None = None,
        trimestre: str | None = None,
        clave_seis: str | None = None,
        institucion_id: int | None = None,
        limite: int | None = None,
    ) -> list[InstitucionTrimestreBase]:
        self._validar(anio, trimestre, clave_seis, limite)
        return self._repositorio.detalle_trimestral(
            anio=anio,
            trimestre=trimestre,
            clave_seis=clave_seis,
            institucion_id=institucion_id,
            limite=limite,
        )

    def kpis_trimestrales(
        self,
        *,
        anio: int | None = None,
        trimestre: str | None = None,
        clave_seis: str | None = None,
        institucion_id: int | None = None,
        limite: int | None = None,
    ) -> list[InstitucionTrimestreKpi]:
        self._validar(anio, trimestre, clave_seis, limite)
        return self._repositorio.kpis_trimestrales(
            anio=anio,
            trimestre=trimestre,
            clave_seis=clave_seis,
            institucion_id=institucion_id,
            limite=limite,
        )

    @staticmethod
    def _validar(
        anio: int | None,
        trimestre: str | None,
        clave_seis: str | None,
        limite: int | None,
    ) -> None:
        validar_anio(anio)
        validar_trimestre(trimestre)
        validar_clave_seis(clave_seis)
        validar_limite(limite)
