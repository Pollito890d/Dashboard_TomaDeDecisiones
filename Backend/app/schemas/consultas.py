"""Modelos de fila para las vistas y catálogos consultados por los repositorios.

Cada clase corresponde a una granularidad distinta. Los campos nullable se
declaran con ``| None`` y se conservan tal cual los devuelve PostgreSQL: la capa
Python no imputa ceros ni recalcula indicadores financieros.
"""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class _Fila(BaseModel):
    model_config = ConfigDict(extra="ignore")


# ---------------------------------------------------------------------------
# Trazabilidad y catálogos
# ---------------------------------------------------------------------------
class EjecucionActiva(_Fila):
    ejecucion_id: int
    iniciada_en: datetime
    terminada_en: datetime | None = None
    estado: str
    version_proceso: str
    observaciones: str | None = None


class Fuente(_Fila):
    archivo_id: int
    fuente: str
    ruta: str
    url: str | None = None
    sha256: str
    tamano_bytes: int
    descargado_en: datetime | None = None
    periodo_desde: date | None = None
    periodo_hasta: date | None = None
    rol: str


class Periodo(_Fila):
    mes_id: date


class Institucion(_Fila):
    institucion_id: int
    clave_seis: str
    clave_boletin: str
    clave_catalogo: str | None = None
    nombre: str


# ---------------------------------------------------------------------------
# CNBV sectorial mensual (SH_SOCAPS!Series)
# ---------------------------------------------------------------------------
class ConceptoSectorMensual(_Fila):
    ejecucion_id: int
    archivo_id: int
    archivo_ruta: str
    archivo_sha256: str
    mes_id: date
    anio: int
    mes: int
    periodo_ym: str
    concepto_id: int
    hoja: str
    fila_series: int
    codigo_original: str | None = None
    concepto_nombre: str
    naturaleza: str
    unidad_origen: str
    unidad_normalizada: str
    valor: Decimal | None = None


class SectorPivoteMensual(_Fila):
    ejecucion_id: int
    archivo_id: int
    mes_id: date
    periodo_ym: str
    anio: int
    mes: int
    v005_activo_total_mxn: Decimal | None = None
    v006_disponibilidades_mxn: Decimal | None = None
    v009_cartera_total_mxn: Decimal | None = None
    v013_cartera_vigente_mxn: Decimal | None = None
    v017_cartera_vencida_mxn: Decimal | None = None
    v021_estimacion_preventiva_mxn: Decimal | None = None
    v035_captacion_tradicional_mxn: Decimal | None = None
    v046_capital_contable_mxn: Decimal | None = None
    v194_activos_liquidos_cp_mxn: Decimal | None = None
    v195_pasivos_cp_mxn: Decimal | None = None
    v212_capital_neto_mxn: Decimal | None = None
    v213_req_capital_riesgos_mxn: Decimal | None = None
    v141_resultado_neto_12m_mxn: Decimal | None = None
    v145_intereses_cartera_vig_12m_mxn: Decimal | None = None
    v153_gastos_intereses_12m_mxn: Decimal | None = None
    v202_socios_total_publicado: Decimal | None = None
    v203_socias_mujeres: Decimal | None = None
    v204_socios_hombres: Decimal | None = None
    v177_imor_publicado_pct: Decimal | None = None
    v185_icor_publicado_pct: Decimal | None = None
    v193_liquidez_publicado_pct: Decimal | None = None
    v196_roa_publicado_pct: Decimal | None = None
    v198_capital_activo_publicado_pct: Decimal | None = None
    v210_nicap_publicado_pct: Decimal | None = None
    v217_tasa_activa_publicada_pct: Decimal | None = None
    v224_tasa_pasiva_publicada_pct: Decimal | None = None
    ventana_12m_completa: bool
    prom12_v005_activo_total_mxn: Decimal | None = None
    prom12_v013_cartera_vigente_mxn: Decimal | None = None
    prom12_v035_captacion_tradicional_mxn: Decimal | None = None


class SectorKpiMensual(_Fila):
    ejecucion_id: int
    mes_id: date
    periodo_ym: str
    anio: int
    mes: int
    ventana_12m_completa: bool
    activo_total_mxn: Decimal | None = None
    disponibilidades_mxn: Decimal | None = None
    cartera_total_mxn: Decimal | None = None
    cartera_vigente_mxn: Decimal | None = None
    cartera_vencida_mxn: Decimal | None = None
    estimacion_preventiva_mxn: Decimal | None = None
    captacion_tradicional_mxn: Decimal | None = None
    capital_contable_mxn: Decimal | None = None
    activos_liquidos_cp_mxn: Decimal | None = None
    pasivos_cp_mxn: Decimal | None = None
    capital_neto_mxn: Decimal | None = None
    req_capital_riesgos_mxn: Decimal | None = None
    resultado_neto_12m_mxn: Decimal | None = None
    intereses_cartera_vig_12m_mxn: Decimal | None = None
    gastos_intereses_12m_mxn: Decimal | None = None
    prom12_activo_total_mxn: Decimal | None = None
    prom12_cartera_vigente_mxn: Decimal | None = None
    prom12_captacion_tradicional_mxn: Decimal | None = None
    socios_total_publicado: Decimal | None = None
    socias_mujeres: Decimal | None = None
    socios_hombres: Decimal | None = None
    socios_suma_genero: Decimal | None = None
    kpi01_imor_pct: Decimal | None = None
    kpi01_imor_publicado_pct: Decimal | None = None
    kpi02_icor_pct: Decimal | None = None
    kpi02_icor_publicado_pct: Decimal | None = None
    kpi03_liquidez_pct: Decimal | None = None
    kpi03_liquidez_publicado_pct: Decimal | None = None
    kpi04_nicap_pct: Decimal | None = None
    kpi04_nicap_publicado_pct: Decimal | None = None
    kpi04_categoria_regulatoria: str | None = None
    kpi05_tasa_activa_pct: Decimal | None = None
    kpi05_tasa_activa_publicada_pct: Decimal | None = None
    kpi06_tasa_pasiva_pct: Decimal | None = None
    kpi06_tasa_pasiva_publicada_pct: Decimal | None = None
    spread_tasas_pp: Decimal | None = None
    kpi07_capital_activo_pct: Decimal | None = None
    kpi07_capital_activo_publicado_pct: Decimal | None = None
    kpi08_roa_pct: Decimal | None = None
    kpi08_roa_publicado_pct: Decimal | None = None
    kpi09_colocacion_captacion_trad_pct: Decimal | None = None
    m01_participacion_femenina_socios_pct: Decimal | None = None


class SectorBanda2025(_Fila):
    kpi_id: str
    nombre: str
    tipo_umbral: str
    min_2025_pct: Decimal | None = None
    mediana_2025_pct: Decimal | None = None
    max_2025_pct: Decimal | None = None
    umbral_regulatorio_min_pct: Decimal | None = None
    nota_umbral: str


class ContrasteTrimestre(_Fila):
    ejecucion_id: int
    mes_id: date
    periodo_ym: str
    trimestre: str
    boletin_activo_total_mxn: Decimal | None = None
    series_activo_total_mxn: Decimal | None = None
    boletin_cartera_vigente_mxn: Decimal | None = None
    series_cartera_vigente_mxn: Decimal | None = None
    boletin_captacion_total_mxn: Decimal | None = None
    series_captacion_tradicional_mxn: Decimal | None = None
    series_imor_pct: Decimal | None = None
    boletin_imor_pct: Decimal | None = None
    diff_imor_pp: Decimal | None = None
    series_icor_pct: Decimal | None = None
    boletin_icor_pct: Decimal | None = None
    diff_icor_pp: Decimal | None = None
    series_nicap_pct: Decimal | None = None
    boletin_nicap_pct: Decimal | None = None
    diff_nicap_pp: Decimal | None = None
    series_roa_pct: Decimal | None = None
    boletin_roa_pct: Decimal | None = None
    diff_roa_pp: Decimal | None = None
    boletin_kpi09_colocacion_captacion_total_pct: Decimal | None = None
    series_kpi09_colocacion_captacion_trad_pct: Decimal | None = None


# ---------------------------------------------------------------------------
# CNBV institucional trimestral (boletines BE_SOCAPS)
# ---------------------------------------------------------------------------
class InstitucionTrimestreBase(_Fila):
    institucion_trim_id: int
    ejecucion_id: int
    archivo_id: int
    archivo_ruta: str
    mes_id: date
    periodo_ym: str
    anio: int
    trimestre: str
    institucion_id: int
    clave_seis: str
    clave_boletin: str
    clave_catalogo: str | None = None
    institucion_nombre: str
    estado_reporte: str
    socios: Decimal | None = None
    sucursales: Decimal | None = None
    activo_mxn: Decimal | None = None
    disponibilidades_mxn: Decimal | None = None
    cartera_vigente_mxn: Decimal | None = None
    cartera_vencida_mxn: Decimal | None = None
    estimacion_mxn: Decimal | None = None
    captacion_total_mxn: Decimal | None = None
    captacion_tradicional_mxn: Decimal | None = None
    ingresos_intereses_trim_mxn: Decimal | None = None
    gastos_intereses_trim_mxn: Decimal | None = None
    imor_pct: Decimal | None = None
    nicap_pct: Decimal | None = None
    participacion_activo_pct: Decimal | None = None
    categoria_nicap: str | None = None
    tasa_activa_pct: Decimal | None = None
    tasa_pasiva_total_pct: Decimal | None = None
    tasa_pasiva_tradicional_pct: Decimal | None = None
    total_sector_activo_mxn: Decimal | None = None
    total_sector_cartera_vigente_mxn: Decimal | None = None
    total_sector_captacion_total_mxn: Decimal | None = None
    total_sector_imor_pct: Decimal | None = None
    total_sector_icor_pct: Decimal | None = None
    total_sector_nicap_pct: Decimal | None = None
    total_sector_roa_pct: Decimal | None = None


class InstitucionTrimestreKpi(_Fila):
    institucion_trim_id: int
    ejecucion_id: int
    mes_id: date
    periodo_ym: str
    anio: int
    trimestre: str
    institucion_id: int
    clave_seis: str
    clave_boletin: str
    clave_catalogo: str | None = None
    institucion_nombre: str
    estado_reporte: str
    socios: Decimal | None = None
    sucursales: Decimal | None = None
    activo_mxn: Decimal | None = None
    disponibilidades_mxn: Decimal | None = None
    cartera_vigente_mxn: Decimal | None = None
    cartera_vencida_mxn: Decimal | None = None
    cartera_total_calc_mxn: Decimal | None = None
    estimacion_mxn: Decimal | None = None
    captacion_total_mxn: Decimal | None = None
    captacion_tradicional_mxn: Decimal | None = None
    ingresos_intereses_trim_mxn: Decimal | None = None
    gastos_intereses_trim_mxn: Decimal | None = None
    kpi01_imor_publicado_pct: Decimal | None = None
    kpi01_imor_recalculado_pct: Decimal | None = None
    kpi02_icor_derivado_pct: Decimal | None = None
    kpi03_liquidez_no_disponible_pct: Decimal | None = None
    kpi04_nicap_publicado_pct: Decimal | None = None
    kpi04_categoria_nicap: str | None = None
    kpi05_tasa_activa_ti_pct: Decimal | None = None
    kpi06_tasa_pasiva_total_ti_pct: Decimal | None = None
    kpi06_tasa_pasiva_tradicional_ti_pct: Decimal | None = None
    spread_ti_total_pp: Decimal | None = None
    kpi09_colocacion_captacion_total_derivado_pct: Decimal | None = None
    m02_participacion_activo_publicada_pct: Decimal | None = None
    m02_participacion_activo_recalculada_pct: Decimal | None = None
    rank_imor_mayor_riesgo: int | None = None
    rank_activo_mayor_tamano: int | None = None
    rank_nicap_fortaleza: int | None = None


# ---------------------------------------------------------------------------
# FONACOT
# ---------------------------------------------------------------------------
class FonacotMes(_Fila):
    fonacot_mes_id: int
    ejecucion_id: int
    mes_id: date
    periodo_ym: str
    anio: int
    mes: int
    trimestre: str
    ambito_id: int
    tipo_ambito: str
    ambito_canonico: str
    genero_id: int
    genero: str
    etiqueta_creditos_original: str | None = None
    etiqueta_monto_original: str | None = None
    creditos: Decimal | None = None
    monto_mxn: Decimal | None = None
    archivo_creditos_id: int
    archivo_monto_id: int


class FonacotTrimestreResumen(_Fila):
    ejecucion_id: int
    anio: int
    trimestre: str
    creditos_totales_nacional: Decimal | None = None
    creditos_mujeres_nacional: Decimal | None = None
    creditos_hombres_nacional: Decimal | None = None
    m03_participacion_femenina_creditos_pct: Decimal | None = None
    monto_total_nacional_mxn: Decimal | None = None
    monto_mujeres_nacional_mxn: Decimal | None = None
    monto_hombres_nacional_mxn: Decimal | None = None
    m03_participacion_femenina_monto_pct: Decimal | None = None
    m03_ticket_promedio_nacional_mxn: Decimal | None = None
    creditos_solo_entidades: Decimal | None = None
    monto_solo_entidades_mxn: Decimal | None = None
    m03_participacion_femenina_solo_entidades_pct: Decimal | None = None
    creditos_canal_app_movil: Decimal | None = None
    monto_canal_app_movil_mxn: Decimal | None = None


class FonacotAmbitoTimestre(_Fila):
    ejecucion_id: int
    anio: int
    trimestre: str
    ambito_id: int
    tipo_ambito: str
    ambito_canonico: str
    creditos_totales: Decimal | None = None
    creditos_mujeres: Decimal | None = None
    creditos_hombres: Decimal | None = None
    m03_participacion_femenina_creditos_pct: Decimal | None = None
    monto_total_mxn: Decimal | None = None
    monto_mujeres_mxn: Decimal | None = None
    monto_hombres_mxn: Decimal | None = None
    m03_ticket_promedio_mxn: Decimal | None = None


# ---------------------------------------------------------------------------
# SNIIV
# ---------------------------------------------------------------------------
class SniivMes(_Fila):
    sniiv_mes_id: int
    ejecucion_id: int
    archivo_id: int
    mes_id: date
    periodo_ym: str
    anio: int
    mes: int
    cve_ent: str | None = None
    cve_mun: str | None = None
    entidad: str | None = None
    municipio: str | None = None
    organismo: str | None = None
    modalidad: str | None = None
    destino: str | None = None
    tipo: str | None = None
    sexo: str | None = None
    sexo_etiqueta: str
    es_infonavit: bool | None = None
    edad_rango: str | None = None
    ingresos_rango: str | None = None
    vivienda_valor: str | None = None
    acciones: Decimal | None = None
    monto_mxn: Decimal | None = None


class SniivAnualResumen(_Fila):
    ejecucion_id: int
    anio: int
    total_registros_csv: int
    m04_acciones_totales: Decimal | None = None
    m04_monto_total_mxn: Decimal | None = None
    m04_promedio_por_accion_mxn: Decimal | None = None
    acciones_mujeres: Decimal | None = None
    acciones_hombres: Decimal | None = None
    acciones_con_sexo_definido: Decimal | None = None
    filas_sin_sexo: int
    acciones_sin_sexo: Decimal | None = None
    monto_sin_sexo_mxn: Decimal | None = None
    monto_mujeres_mxn: Decimal | None = None
    monto_hombres_mxn: Decimal | None = None
    monto_con_sexo_definido_mxn: Decimal | None = None
    m04_participacion_mujeres_acciones_pct: Decimal | None = None
    m04_participacion_mujeres_monto_pct: Decimal | None = None
    acciones_infonavit: Decimal | None = None
    monto_infonavit_mxn: Decimal | None = None
    m04_participacion_infonavit_acciones_pct: Decimal | None = None


class SniivEntidadAnual(_Fila):
    ejecucion_id: int
    anio: int
    cve_ent: str | None = None
    entidad_nombre: str | None = None
    registros_csv: int
    acciones_totales: Decimal | None = None
    monto_total_mxn: Decimal | None = None
    promedio_por_accion_mxn: Decimal | None = None
    acciones_mujeres: Decimal | None = None
    acciones_hombres: Decimal | None = None
    acciones_sin_sexo: Decimal | None = None
    m04_participacion_mujeres_acciones_pct: Decimal | None = None
    m04_participacion_mujeres_monto_pct: Decimal | None = None
    acciones_infonavit: Decimal | None = None
    m04_participacion_infonavit_acciones_pct: Decimal | None = None
