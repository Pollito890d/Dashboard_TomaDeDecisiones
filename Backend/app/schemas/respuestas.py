"""Modelos de respuesta JSON versionada de la API (Fase V, pasos 20 y 21).

Todas las respuestas correctas incluyen ``contrato_version``. Los indicadores
financieros se reutilizan de :mod:`app.schemas.consultas`: aquí solo se empaquetan
por granularidad, sin recalcular ninguna fórmula en Python.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.consultas import (
    FonacotAmbitoTimestre,
    FonacotTrimestreResumen,
    Fuente,
    Institucion,
    InstitucionTrimestreKpi,
    SectorBanda2025,
    SectorKpiMensual,
    SniivAnualResumen,
    SniivEntidadAnual,
)

CONTRATO_VERSION = "1.0.0"


class _Respuesta(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contrato_version: str = Field(
        default=CONTRATO_VERSION,
        description="Versión del contrato JSON de la API.",
    )


class PeriodosDisponibles(BaseModel):
    model_config = ConfigDict(extra="forbid")

    desde: str | None = Field(default=None, description="Primer período del catálogo (YYYY-MM).")
    hasta: str | None = Field(default=None, description="Último período del catálogo (YYYY-MM).")
    total: int = Field(description="Número de períodos del catálogo dim_mes.")


class ErrorDetalle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    campo: str = Field(description="Ruta del parámetro inválido en la petición.")
    mensaje: str = Field(description="Descripción de la validación fallida.")


class ErrorResponse(_Respuesta):
    detail: str = Field(description="Mensaje controlado del error; nunca incluye credenciales.")
    errores: list[ErrorDetalle] | None = Field(
        default=None,
        description="Detalle de errores de validación de FastAPI, cuando aplica.",
    )


class DashboardResponse(_Respuesta):
    granularidad: Literal["sectorial_mensual"] = Field(
        default="sectorial_mensual",
        description="Serie consolidada mensual; sin dimensión institución.",
    )
    fuente: str = Field(
        default="CNBV · SH_SOCAPS.xlsm!Series",
        description="Fuente oficial del indicador.",
    )
    periodo_solicitado: str | None = Field(
        default=None, description="Corte mensual efectivo (YYYY-MM) o null si no hay datos."
    )
    periodos_disponibles: PeriodosDisponibles
    corte: SectorKpiMensual | None = Field(
        default=None, description="Fila de KPIs del corte; null cuando no hay observación."
    )
    serie_anual: list[SectorKpiMensual] = Field(
        default_factory=list,
        description="Hasta 12 cortes mensuales del año solicitado, ya calculados en SQL.",
    )
    bandas_2025: list[SectorBanda2025] = Field(
        default_factory=list,
        description="Bandas observadas en 2025 y único umbral regulatorio (KPI-04).",
    )
    sin_datos: bool = Field(description="true cuando el corte y la serie están vacíos.")
    nota: str | None = Field(default=None, description="Advertencia metodológica, si aplica.")


class InstitucionesResponse(_Respuesta):
    granularidad: Literal["institucional_trimestral"] = Field(
        default="institucional_trimestral",
        description="Una fila por corte trimestral y cooperativa (clave_seis).",
    )
    fuente: str = Field(
        default="CNBV · boletines BE_SOCAPS",
        description="Fuente oficial del indicador.",
    )
    corte: str | None = Field(default=None, description="Corte mensual trimestral (YYYY-MM).")
    trimestre: str | None = Field(default=None, description="Trimestre efectivo (YYYY-Qn).")
    instituciones: list[InstitucionTrimestreKpi] = Field(
        default_factory=list, description="Fichas ya calculadas en SQL, ordenadas por activo."
    )
    total_devueltos: int = Field(description="Número de filas devueltas en esta respuesta.")
    limitado: bool = Field(description="true cuando se alcanzó el parámetro limite.")
    sin_datos: bool = Field(description="true cuando no hay fichas para los filtros solicitados.")
    nota: str | None = Field(default=None, description="Advertencia metodológica, si aplica.")


class InstitucionesCatalogoResponse(_Respuesta):
    granularidad: Literal["catalogo_instituciones"] = Field(
        default="catalogo_instituciones",
        description="Catálogo completo de cooperativas, independiente del ranking.",
    )
    instituciones: list[Institucion] = Field(
        default_factory=list, description="Todas las cooperativas del catálogo oficial."
    )
    total: int = Field(description="Número de cooperativas devueltas.")
    sin_datos: bool = Field(description="true cuando el catálogo está vacío.")


class PeriodosResponse(_Respuesta):
    granularidad: Literal["catalogo_mensual"] = Field(
        default="catalogo_mensual", description="Catálogo dim_mes."
    )
    periodos: list[str] = Field(description="Períodos disponibles en formato YYYY-MM.")
    total: int = Field(description="Número de períodos devueltos.")
    desde: str | None = Field(default=None, description="Período más antiguo devuelto (YYYY-MM).")
    hasta: str | None = Field(default=None, description="Período más reciente devuelto (YYYY-MM).")
    sin_datos: bool = Field(description="true cuando el catálogo está vacío para el filtro.")


class FuentesResponse(_Respuesta):
    granularidad: Literal["catalogo_fuentes"] = Field(
        default="catalogo_fuentes", description="Catálogo archivo_fuente."
    )
    fuentes: list[Fuente] = Field(description="Fuentes con trazabilidad SHA-256 y rol.")
    total: int = Field(description="Número de fuentes devueltas.")
    sin_datos: bool = Field(description="true cuando no hay fuentes para los filtros.")


class FonacotResponse(_Respuesta):
    granularidad: Literal["contexto_externo_trimestral"] = Field(
        default="contexto_externo_trimestral",
        description="Métricas M-03, separadas del universo CNBV.",
    )
    fuente: str = Field(
        default="FONACOT · datos abiertos de crédito",
        description="Fuente oficial del indicador.",
    )
    resumen_trimestral: list[FonacotTrimestreResumen] = Field(
        default_factory=list, description="Resumen nacional y subtotales por trimestre."
    )
    por_ambito: list[FonacotAmbitoTimestre] = Field(
        default_factory=list,
        description="Desglose por entidad/canal; vacío salvo que se solicite explícitamente.",
    )
    sin_datos: bool = Field(description="true cuando no hay resumen para el año solicitado.")


class SniivResponse(_Respuesta):
    granularidad: Literal["contexto_externo_anual"] = Field(
        default="contexto_externo_anual",
        description="Métricas M-04, separadas del universo CNBV.",
    )
    fuente: str = Field(
        default="SNIIV · financiamientos de vivienda",
        description="Fuente oficial del indicador.",
    )
    resumen_anual: list[SniivAnualResumen] = Field(
        default_factory=list, description="Resumen nacional por año."
    )
    por_entidad: list[SniivEntidadAnual] = Field(
        default_factory=list,
        description="Desglose por entidad; vacío salvo que se solicite explícitamente.",
    )
    sin_datos: bool = Field(description="true cuando no hay resumen para el año solicitado.")
