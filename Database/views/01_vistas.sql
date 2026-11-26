-- =============================================================================
-- Fase IV — Paso 16: Vistas SQL Base y de Instantánea Activa
-- Archivo: Database/views/01_vistas.sql
-- Motor: PostgreSQL 15+
-- Descripción:
--   Define la capa base de vistas modulares sobre las tablas de dimensiones,
--   trazabilidad y hechos (Database/01_schema.sql).
--   1. v_ejecucion_activa: Selecciona la última ejecución ETL con estado='exitosa'
--      para garantizar consultas sobre una instantánea completa e inmutable,
--      evitando duplicar registros entre múltiples ejecuciones.
--   2. v_cnbv_sector_conceptos_mes: Expone la serie histórica mensual de CNBV
--      (SH_SOCAPS.xlsm!Series) con metadatos de dim_concepto_cnbv y trazabilidad.
--   3. v_cnbv_sector_pivot_mes: Pivota los 26 conceptos aprobados de Series por
--      mes_id y calcula con funciones de ventana las medias móviles de 12 meses
--      consecutivos (prom12 de filas 5, 13 y 35) exigidas por KPI-05, KPI-06 y KPI-08.
--   4. v_cnbv_institucion_trim_base: Une hecho_cnbv_institucion_trim con
--      dim_institucion y hecho_cnbv_total_trim para la instantánea activa.
--   5. v_fonacot_mes_base: Desnormaliza hecho_fonacot_mes con dim_ambito_fonacot
--      (separando 'entidad' vs 'canal' APP MOVIL) y dim_genero_fonacot.
--   6. v_sniiv_mes_base: Expone hecho_sniiv_mes de la instantánea activa con
--      sus 12 dimensiones originales y tratamiento explícito de sexo nulo.
-- =============================================================================

SET search_path = public, pg_catalog;

-- -----------------------------------------------------------------------------
-- 1. Vista de instantánea activa (última ejecución ETL exitosa)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_ejecucion_activa AS
SELECT
    e.ejecucion_id,
    e.iniciada_en,
    e.terminada_en,
    e.estado,
    e.version_proceso,
    e.observaciones
FROM ejecucion_etl e
WHERE e.estado = 'exitosa'
ORDER BY e.terminada_en DESC NULLS LAST, e.ejecucion_id DESC
LIMIT 1;

COMMENT ON VIEW v_ejecucion_activa IS
'Selecciona únicamente la última ejecución ETL con estado exitosa para evitar mezclar o duplicar instantáneas.';

-- -----------------------------------------------------------------------------
-- 2. Vista base desnormalizada de conceptos mensuales CNBV (SH_SOCAPS!Series)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_cnbv_sector_conceptos_mes AS
SELECT
    h.ejecucion_id,
    h.archivo_id,
    af.ruta AS archivo_ruta,
    af.sha256 AS archivo_sha256,
    h.mes_id,
    EXTRACT(YEAR FROM h.mes_id)::integer AS anio,
    EXTRACT(MONTH FROM h.mes_id)::integer AS mes,
    to_char(h.mes_id, 'YYYY-MM') AS periodo_ym,
    c.concepto_id,
    c.hoja,
    c.fila_series,
    c.codigo_original,
    c.nombre AS concepto_nombre,
    c.naturaleza,
    c.unidad_origen,
    c.unidad_normalizada,
    h.valor
FROM hecho_cnbv_sector_mes h
JOIN v_ejecucion_activa ea
  ON ea.ejecucion_id = h.ejecucion_id
JOIN dim_concepto_cnbv c
  ON c.concepto_id = h.concepto_id
 AND c.archivo_id = h.archivo_id
JOIN archivo_fuente af
  ON af.archivo_id = h.archivo_id;

COMMENT ON VIEW v_cnbv_sector_conceptos_mes IS
'Conceptos mensuales del sector SOCAPS consolidado (SH_SOCAPS.xlsm!Series) para la ejecución ETL activa.';

-- -----------------------------------------------------------------------------
-- 3. Vista pivotada por mes con ventanas móviles de 12 meses consecutivos
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_cnbv_sector_pivot_mes AS
WITH pivot_raw AS (
    SELECT
        h.ejecucion_id,
        h.archivo_id,
        h.mes_id,
        to_char(h.mes_id, 'YYYY-MM') AS periodo_ym,
        EXTRACT(YEAR FROM h.mes_id)::integer AS anio,
        EXTRACT(MONTH FROM h.mes_id)::integer AS mes,
        -- Saldos en MXN (normalizados × 1,000,000 desde millones MXN inferidos)
        MAX(h.valor) FILTER (WHERE c.fila_series = 5)   AS v005_activo_total_mxn,
        MAX(h.valor) FILTER (WHERE c.fila_series = 6)   AS v006_disponibilidades_mxn,
        MAX(h.valor) FILTER (WHERE c.fila_series = 9)   AS v009_cartera_total_mxn,
        MAX(h.valor) FILTER (WHERE c.fila_series = 13)  AS v013_cartera_vigente_mxn,
        MAX(h.valor) FILTER (WHERE c.fila_series = 17)  AS v017_cartera_vencida_mxn,
        MAX(h.valor) FILTER (WHERE c.fila_series = 21)  AS v021_estimacion_preventiva_mxn,
        MAX(h.valor) FILTER (WHERE c.fila_series = 35)  AS v035_captacion_tradicional_mxn,
        MAX(h.valor) FILTER (WHERE c.fila_series = 46)  AS v046_capital_contable_mxn,
        MAX(h.valor) FILTER (WHERE c.fila_series = 194) AS v194_activos_liquidos_cp_mxn,
        MAX(h.valor) FILTER (WHERE c.fila_series = 195) AS v195_pasivos_cp_mxn,
        MAX(h.valor) FILTER (WHERE c.fila_series = 212) AS v212_capital_neto_mxn,
        MAX(h.valor) FILTER (WHERE c.fila_series = 213) AS v213_req_capital_riesgos_mxn,
        -- Flujos acumulados de 12 meses en MXN
        MAX(h.valor) FILTER (WHERE c.fila_series = 141) AS v141_resultado_neto_12m_mxn,
        MAX(h.valor) FILTER (WHERE c.fila_series = 145) AS v145_intereses_cartera_vig_12m_mxn,
        MAX(h.valor) FILTER (WHERE c.fila_series = 153) AS v153_gastos_intereses_12m_mxn,
        -- Conteos de socios
        MAX(h.valor) FILTER (WHERE c.fila_series = 202) AS v202_socios_total_publicado,
        MAX(h.valor) FILTER (WHERE c.fila_series = 203) AS v203_socias_mujeres,
        MAX(h.valor) FILTER (WHERE c.fila_series = 204) AS v204_socios_hombres,
        -- Porcentajes oficiales publicados en Series para contraste directo
        MAX(h.valor) FILTER (WHERE c.fila_series = 177) AS v177_imor_publicado_pct,
        MAX(h.valor) FILTER (WHERE c.fila_series = 185) AS v185_icor_publicado_pct,
        MAX(h.valor) FILTER (WHERE c.fila_series = 193) AS v193_liquidez_publicado_pct,
        MAX(h.valor) FILTER (WHERE c.fila_series = 196) AS v196_roa_publicado_pct,
        MAX(h.valor) FILTER (WHERE c.fila_series = 198) AS v198_capital_activo_publicado_pct,
        MAX(h.valor) FILTER (WHERE c.fila_series = 210) AS v210_nicap_publicado_pct,
        MAX(h.valor) FILTER (WHERE c.fila_series = 217) AS v217_tasa_activa_publicada_pct,
        MAX(h.valor) FILTER (WHERE c.fila_series = 224) AS v224_tasa_pasiva_publicada_pct
    FROM hecho_cnbv_sector_mes h
    JOIN v_ejecucion_activa ea
      ON ea.ejecucion_id = h.ejecucion_id
    JOIN dim_concepto_cnbv c
      ON c.concepto_id = h.concepto_id
     AND c.archivo_id = h.archivo_id
    GROUP BY h.ejecucion_id, h.archivo_id, h.mes_id
),
ventanas_12m AS (
    SELECT
        p.*,
        -- Fecha esperada del inicio de la ventana de 12 meses consecutivos (mes_id - 11 meses)
        (p.mes_id - INTERVAL '11 months')::date AS mes_inicio_ventana_esperado,
        MIN(p.mes_id) OVER w12 AS mes_inicio_ventana_real,
        COUNT(*) OVER w12 AS meses_en_ventana,
        COUNT(p.v005_activo_total_mxn) OVER w12 AS obs_v005_12m,
        COUNT(p.v013_cartera_vigente_mxn) OVER w12 AS obs_v013_12m,
        COUNT(p.v035_captacion_tradicional_mxn) OVER w12 AS obs_v035_12m,
        AVG(p.v005_activo_total_mxn) OVER w12 AS raw_prom12_v005_mxn,
        AVG(p.v013_cartera_vigente_mxn) OVER w12 AS raw_prom12_v013_mxn,
        AVG(p.v035_captacion_tradicional_mxn) OVER w12 AS raw_prom12_v035_mxn
    FROM pivot_raw p
    WINDOW w12 AS (
        PARTITION BY p.ejecucion_id
        ORDER BY p.mes_id
        ROWS BETWEEN 11 PRECEDING AND CURRENT ROW
    )
)
SELECT
    v.ejecucion_id,
    v.archivo_id,
    v.mes_id,
    v.periodo_ym,
    v.anio,
    v.mes,
    v.v005_activo_total_mxn,
    v.v006_disponibilidades_mxn,
    v.v009_cartera_total_mxn,
    v.v013_cartera_vigente_mxn,
    v.v017_cartera_vencida_mxn,
    v.v021_estimacion_preventiva_mxn,
    v.v035_captacion_tradicional_mxn,
    v.v046_capital_contable_mxn,
    v.v194_activos_liquidos_cp_mxn,
    v.v195_pasivos_cp_mxn,
    v.v212_capital_neto_mxn,
    v.v213_req_capital_riesgos_mxn,
    v.v141_resultado_neto_12m_mxn,
    v.v145_intereses_cartera_vig_12m_mxn,
    v.v153_gastos_intereses_12m_mxn,
    v.v202_socios_total_publicado,
    v.v203_socias_mujeres,
    v.v204_socios_hombres,
    v.v177_imor_publicado_pct,
    v.v185_icor_publicado_pct,
    v.v193_liquidez_publicado_pct,
    v.v196_roa_publicado_pct,
    v.v198_capital_activo_publicado_pct,
    v.v210_nicap_publicado_pct,
    v.v217_tasa_activa_publicada_pct,
    v.v224_tasa_pasiva_publicada_pct,
    -- Validación estricta de ventana móvil de 12 meses consecutivos sin huecos
    (v.meses_en_ventana = 12 AND v.mes_inicio_ventana_real = v.mes_inicio_ventana_esperado) AS ventana_12m_completa,
    CASE
        WHEN v.meses_en_ventana = 12
         AND v.mes_inicio_ventana_real = v.mes_inicio_ventana_esperado
         AND v.obs_v005_12m = 12
        THEN v.raw_prom12_v005_mxn
        ELSE NULL
    END AS prom12_v005_activo_total_mxn,
    CASE
        WHEN v.meses_en_ventana = 12
         AND v.mes_inicio_ventana_real = v.mes_inicio_ventana_esperado
         AND v.obs_v013_12m = 12
        THEN v.raw_prom12_v013_mxn
        ELSE NULL
    END AS prom12_v013_cartera_vigente_mxn,
    CASE
        WHEN v.meses_en_ventana = 12
         AND v.mes_inicio_ventana_real = v.mes_inicio_ventana_esperado
         AND v.obs_v035_12m = 12
        THEN v.raw_prom12_v035_mxn
        ELSE NULL
    END AS prom12_v035_captacion_tradicional_mxn
FROM ventanas_12m v;

COMMENT ON VIEW v_cnbv_sector_pivot_mes IS
'Pivote mensual de los 26 conceptos CNBV Series con promedios móviles de 12 saldos mensuales consecutivos (prom12). Si la ventana tiene menos de 12 meses consecutivos, prom12 devuelve NULL.';

-- -----------------------------------------------------------------------------
-- 4. Vista base institucional trimestral CNBV (Boletines BE_SOCAPS)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_cnbv_institucion_trim_base AS
SELECT
    i.institucion_trim_id,
    i.ejecucion_id,
    i.archivo_id,
    af.ruta AS archivo_ruta,
    i.mes_id,
    to_char(i.mes_id, 'YYYY-MM') AS periodo_ym,
    EXTRACT(YEAR FROM i.mes_id)::integer AS anio,
    to_char(i.mes_id, 'YYYY') || '-Q' ||
        (((EXTRACT(MONTH FROM i.mes_id)::integer - 1) / 3) + 1)::text AS trimestre,
    i.institucion_id,
    di.clave_seis,
    di.clave_boletin,
    di.clave_catalogo,
    di.nombre AS institucion_nombre,
    i.estado_reporte,
    i.socios,
    i.sucursales,
    i.activo_mxn,
    i.disponibilidades_mxn,
    i.cartera_vigente_mxn,
    i.cartera_vencida_mxn,
    i.estimacion_mxn,
    i.captacion_total_mxn,
    i.captacion_tradicional_mxn,
    i.ingresos_intereses_trim_mxn,
    i.gastos_intereses_trim_mxn,
    i.imor_pct,
    i.nicap_pct,
    i.participacion_activo_pct,
    i.categoria_nicap,
    i.tasa_activa_pct,
    i.tasa_pasiva_total_pct,
    i.tasa_pasiva_tradicional_pct,
    t.activo_mxn AS total_sector_activo_mxn,
    t.cartera_vigente_mxn AS total_sector_cartera_vigente_mxn,
    t.captacion_total_mxn AS total_sector_captacion_total_mxn,
    t.imor_pct AS total_sector_imor_pct,
    t.icor_pct AS total_sector_icor_pct,
    t.nicap_pct AS total_sector_nicap_pct,
    t.roa_pct AS total_sector_roa_pct
FROM hecho_cnbv_institucion_trim i
JOIN v_ejecucion_activa ea
  ON ea.ejecucion_id = i.ejecucion_id
JOIN dim_institucion di
  ON di.institucion_id = i.institucion_id
JOIN archivo_fuente af
  ON af.archivo_id = i.archivo_id
LEFT JOIN hecho_cnbv_total_trim t
  ON t.ejecucion_id = i.ejecucion_id
 AND t.mes_id = i.mes_id;

COMMENT ON VIEW v_cnbv_institucion_trim_base IS
'Detalle trimestral por cooperativa SOCAP unido con su dimensión institucional y el total sectorial publicado del boletín correspondiente.';

-- -----------------------------------------------------------------------------
-- 5. Vista base mensual FONACOT (Créditos e importe por entidad/canal y género)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_fonacot_mes_base AS
SELECT
    f.fonacot_mes_id,
    f.ejecucion_id,
    f.mes_id,
    to_char(f.mes_id, 'YYYY-MM') AS periodo_ym,
    EXTRACT(YEAR FROM f.mes_id)::integer AS anio,
    EXTRACT(MONTH FROM f.mes_id)::integer AS mes,
    EXTRACT(YEAR FROM f.mes_id)::integer::text || '-Q' ||
        (((EXTRACT(MONTH FROM f.mes_id)::integer - 1) / 3) + 1)::text AS trimestre,
    f.ambito_id,
    a.tipo AS tipo_ambito,
    a.nombre_canonico AS ambito_canonico,
    f.genero_id,
    g.etiqueta AS genero,
    f.etiqueta_creditos_original,
    f.etiqueta_monto_original,
    f.creditos,
    f.monto_mxn,
    f.archivo_creditos_id,
    f.archivo_monto_id
FROM hecho_fonacot_mes f
JOIN v_ejecucion_activa ea
  ON ea.ejecucion_id = f.ejecucion_id
JOIN dim_ambito_fonacot a
  ON a.ambito_id = f.ambito_id
JOIN dim_genero_fonacot g
  ON g.genero_id = f.genero_id;

COMMENT ON VIEW v_fonacot_mes_base IS
'Hechos mensuales de FONACOT para la ejecución activa, distinguiendo tipo_ambito entidad vs canal (APP MOVIL) y género.';

-- -----------------------------------------------------------------------------
-- 6. Vista base mensual SNIIV (Financiamientos de vivienda con 12 dimensiones)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_sniiv_mes_base AS
SELECT
    s.sniiv_mes_id,
    s.ejecucion_id,
    s.archivo_id,
    s.mes_id,
    to_char(s.mes_id, 'YYYY-MM') AS periodo_ym,
    EXTRACT(YEAR FROM s.mes_id)::integer AS anio,
    EXTRACT(MONTH FROM s.mes_id)::integer AS mes,
    s.cve_ent,
    s.cve_mun,
    s.entidad,
    s.municipio,
    s.organismo,
    s.modalidad,
    s.destino,
    s.tipo,
    s.sexo,
    CASE
        WHEN s.sexo = '1' THEN 'Hombre'
        WHEN s.sexo = '2' THEN 'Mujer'
        ELSE 'No especificado / NULL'
    END AS sexo_etiqueta,
    (s.organismo = '1') AS es_infonavit,
    s.edad_rango,
    s.ingresos_rango,
    s.vivienda_valor,
    s.acciones,
    s.monto_mxn
FROM hecho_sniiv_mes s
JOIN v_ejecucion_activa ea
  ON ea.ejecucion_id = s.ejecucion_id;

COMMENT ON VIEW v_sniiv_mes_base IS
'Hechos mensuales de SNIIV 2025 para la ejecución activa, preservando las 12 dimensiones originales y las 399 filas con sexo NULL.';
