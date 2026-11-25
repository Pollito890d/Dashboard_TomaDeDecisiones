-- =============================================================================
-- Fase IV — Paso 16 y Paso 17: Vistas Analíticas de KPIs y Métricas
-- Archivo: Database/views/02_kpis.sql
-- Motor: PostgreSQL 15+
-- Dependencia: Ejecutar después de Database/views/01_vistas.sql
-- Descripción:
--   Implementa en SQL todos los indicadores definidos en docs/catalogo_kpis.md:
--   - KPI-01: Índice de Morosidad (IMOR) [Sectorial mensual e Institucional trimestral]
--   - KPI-02: Índice de Cobertura (ICOR) [Sectorial mensual e Institucional derivado]
--   - KPI-03: Coeficiente de Liquidez [Sectorial mensual; componentes EF en institucional]
--   - KPI-04: Nivel de Capitalización (NICAP) [Sectorial e Institucional con umbral regulatorio]
--   - KPI-05: Tasa implícita activa de cartera vigente [Ventana 12m en Series; TI en boletín]
--   - KPI-06: Tasa implícita pasiva [Ventana 12m en Series con fila 153; TI total/tradicional]
--   - KPI-07: Capital contable / Activo total [Sectorial mensual]
--   - KPI-08: Rendimiento sobre el Activo (ROA) [Ventana 12m en Series; Indicadores en boletín]
--   - KPI-09: Índice colocación / captación [Tradicional en sectorial; Total en institucional]
--   - M-01: Participación femenina en el sector SOCAP [v(203) / (v(203) + v(204))]
--   - M-02: Participación por activo de cada institución [Activo sociedad / Activo TOTAL]
--   - M-03: FONACOT créditos, monto, participación femenina y ticket promedio
--   - M-04: SNIIV acciones, monto, participación femenina, participación INFONAVIT y promedio
-- =============================================================================

SET search_path = public, pg_catalog;

-- -----------------------------------------------------------------------------
-- 1. Vista de KPIs Financieros del Sector SOCAP (Mensual - SH_SOCAPS!Series)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_kpis_cnbv_sector_mes AS
SELECT
    p.ejecucion_id,
    p.mes_id,
    p.periodo_ym,
    p.anio,
    p.mes,
    p.ventana_12m_completa,

    -- Saldos y componentes contextuales en MXN (normalizados; nunca sumar entre meses)
    p.v005_activo_total_mxn                 AS activo_total_mxn,
    p.v006_disponibilidades_mxn             AS disponibilidades_mxn,
    p.v009_cartera_total_mxn                AS cartera_total_mxn,
    p.v013_cartera_vigente_mxn              AS cartera_vigente_mxn,
    p.v017_cartera_vencida_mxn              AS cartera_vencida_mxn,
    p.v021_estimacion_preventiva_mxn        AS estimacion_preventiva_mxn,
    p.v035_captacion_tradicional_mxn        AS captacion_tradicional_mxn,
    p.v046_capital_contable_mxn             AS capital_contable_mxn,
    p.v194_activos_liquidos_cp_mxn          AS activos_liquidos_cp_mxn,
    p.v195_pasivos_cp_mxn                   AS pasivos_cp_mxn,
    p.v212_capital_neto_mxn                 AS capital_neto_mxn,
    p.v213_req_capital_riesgos_mxn          AS req_capital_riesgos_mxn,

    -- Flujos de 12 meses y denominadores promediados (12 saldos mensuales consecutivos)
    p.v141_resultado_neto_12m_mxn           AS resultado_neto_12m_mxn,
    p.v145_intereses_cartera_vig_12m_mxn    AS intereses_cartera_vig_12m_mxn,
    p.v153_gastos_intereses_12m_mxn         AS gastos_intereses_12m_mxn,
    p.prom12_v005_activo_total_mxn          AS prom12_activo_total_mxn,
    p.prom12_v013_cartera_vigente_mxn       AS prom12_cartera_vigente_mxn,
    p.prom12_v035_captacion_tradicional_mxn AS prom12_captacion_tradicional_mxn,

    -- Conteos de socios
    p.v202_socios_total_publicado           AS socios_total_publicado,
    p.v203_socias_mujeres                   AS socias_mujeres,
    p.v204_socios_hombres                   AS socios_hombres,
    (p.v203_socias_mujeres + p.v204_socios_hombres) AS socios_suma_genero,

    -- KPI-01: Índice de Morosidad (IMOR) = v(17) / v(9) * 100
    ((p.v017_cartera_vencida_mxn / NULLIF(p.v009_cartera_total_mxn, 0)) * 100)::numeric(20,10)
        AS kpi01_imor_pct,
    p.v177_imor_publicado_pct               AS kpi01_imor_publicado_pct,

    -- KPI-02: Índice de Cobertura (ICOR) = ABS(v(21)) / v(17) * 100
    ((ABS(p.v021_estimacion_preventiva_mxn) / NULLIF(p.v017_cartera_vencida_mxn, 0)) * 100)::numeric(20,10)
        AS kpi02_icor_pct,
    p.v185_icor_publicado_pct               AS kpi02_icor_publicado_pct,

    -- KPI-03: Coeficiente de Liquidez = v(194) / v(195) * 100
    ((p.v194_activos_liquidos_cp_mxn / NULLIF(p.v195_pasivos_cp_mxn, 0)) * 100)::numeric(20,10)
        AS kpi03_liquidez_pct,
    p.v193_liquidez_publicado_pct           AS kpi03_liquidez_publicado_pct,

    -- KPI-04: Nivel de Capitalización (NICAP) = v(212) / v(213) * 100
    ((p.v212_capital_neto_mxn / NULLIF(p.v213_req_capital_riesgos_mxn, 0)) * 100)::numeric(20,10)
        AS kpi04_nicap_pct,
    p.v210_nicap_publicado_pct              AS kpi04_nicap_publicado_pct,
    CASE
        WHEN (p.v212_capital_neto_mxn / NULLIF(p.v213_req_capital_riesgos_mxn, 0)) * 100 >= 150 THEN 'Categoría 1 (>=150%)'
        WHEN (p.v212_capital_neto_mxn / NULLIF(p.v213_req_capital_riesgos_mxn, 0)) * 100 >= 100 THEN 'Categoría 2 (>=100% y <150%)'
        WHEN (p.v212_capital_neto_mxn / NULLIF(p.v213_req_capital_riesgos_mxn, 0)) * 100 >= 50  THEN 'Categoría 3 (>=50% y <100%)'
        WHEN (p.v212_capital_neto_mxn / NULLIF(p.v213_req_capital_riesgos_mxn, 0)) IS NOT NULL   THEN 'Categoría 4 (<50%)'
        ELSE NULL
    END AS kpi04_categoria_regulatoria,

    -- KPI-05: Tasa implícita activa = v(145) / prom12(13) * 100
    ((p.v145_intereses_cartera_vig_12m_mxn / NULLIF(p.prom12_v013_cartera_vigente_mxn, 0)) * 100)::numeric(20,10)
        AS kpi05_tasa_activa_pct,
    p.v217_tasa_activa_publicada_pct        AS kpi05_tasa_activa_publicada_pct,

    -- KPI-06: Tasa implícita pasiva = v(153) / prom12(35) * 100
    ((p.v153_gastos_intereses_12m_mxn / NULLIF(p.prom12_v035_captacion_tradicional_mxn, 0)) * 100)::numeric(20,10)
        AS kpi06_tasa_pasiva_pct,
    p.v224_tasa_pasiva_publicada_pct        AS kpi06_tasa_pasiva_publicada_pct,

    -- Spread de tasas implícitas (KPI-05 - KPI-06) en puntos porcentuales
    (
        ((p.v145_intereses_cartera_vig_12m_mxn / NULLIF(p.prom12_v013_cartera_vigente_mxn, 0)) * 100)
      - ((p.v153_gastos_intereses_12m_mxn / NULLIF(p.prom12_v035_captacion_tradicional_mxn, 0)) * 100)
    )::numeric(20,10) AS spread_tasas_pp,

    -- KPI-07: Capital contable / Activo total = v(46) / v(5) * 100
    ((p.v046_capital_contable_mxn / NULLIF(p.v005_activo_total_mxn, 0)) * 100)::numeric(20,10)
        AS kpi07_capital_activo_pct,
    p.v198_capital_activo_publicado_pct     AS kpi07_capital_activo_publicado_pct,

    -- KPI-08: Rendimiento sobre el Activo (ROA) = v(141) / prom12(5) * 100
    ((p.v141_resultado_neto_12m_mxn / NULLIF(p.prom12_v005_activo_total_mxn, 0)) * 100)::numeric(20,10)
        AS kpi08_roa_pct,
    p.v196_roa_publicado_pct                AS kpi08_roa_publicado_pct,

    -- KPI-09 (Variante sectorial mensual): Cartera vigente / Captación tradicional = v(13) / v(35) * 100
    ((p.v013_cartera_vigente_mxn / NULLIF(p.v035_captacion_tradicional_mxn, 0)) * 100)::numeric(20,10)
        AS kpi09_colocacion_captacion_trad_pct,

    -- M-01: Participación femenina en socios del sector = v(203) / (v(203) + v(204)) * 100
    -- Nota Series!C236: se usa la suma de componentes (203+204) como denominador, no v(202).
    ((p.v203_socias_mujeres / NULLIF(p.v203_socias_mujeres + p.v204_socios_hombres, 0)) * 100)::numeric(20,10)
        AS m01_participacion_femenina_socios_pct
FROM v_cnbv_sector_pivot_mes p;

COMMENT ON VIEW v_kpis_cnbv_sector_mes IS
'Calcula los 9 KPIs financieros sectoriales mensuales (KPI-01 a KPI-09), el spread de tasas y M-01 (participación femenina), incluyendo las columnas publicadas en Series para contraste exacto.';

-- -----------------------------------------------------------------------------
-- 2. Vista de Bandas Observadas 2025 para los KPIs Sectoriales
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_kpis_cnbv_sector_bandas_2025 AS
WITH s2025 AS (
    SELECT *
    FROM v_kpis_cnbv_sector_mes
    WHERE anio = 2025
)
SELECT
    'KPI-01'::text AS kpi_id,
    'Índice de Morosidad (IMOR)'::text AS nombre,
    'observado_2025'::text AS tipo_umbral,
    MIN(kpi01_imor_pct) AS min_2025_pct,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY kpi01_imor_pct)::numeric(20,10) AS mediana_2025_pct,
    MAX(kpi01_imor_pct) AS max_2025_pct,
    NULL::numeric(20,10) AS umbral_regulatorio_min_pct,
    'Banda observada en los 12 cortes mensuales de 2025 (no regulatoria)'::text AS nota_umbral
FROM s2025
UNION ALL
SELECT
    'KPI-02', 'Índice de Cobertura (ICOR)', 'observado_2025',
    MIN(kpi02_icor_pct),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY kpi02_icor_pct)::numeric(20,10),
    MAX(kpi02_icor_pct),
    NULL::numeric(20,10),
    'Banda observada en 2025; 100% equivale a provisiones iguales a cartera vencida (lectura contable)'
FROM s2025
UNION ALL
SELECT
    'KPI-03', 'Coeficiente de liquidez', 'observado_2025',
    MIN(kpi03_liquidez_pct),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY kpi03_liquidez_pct)::numeric(20,10),
    MAX(kpi03_liquidez_pct),
    NULL::numeric(20,10),
    'Banda observada en 2025; se descarta la meta sintética 80% del wireframe original'
FROM s2025
UNION ALL
SELECT
    'KPI-04', 'Nivel de Capitalización (NICAP)', 'regulatorio',
    MIN(kpi04_nicap_pct),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY kpi04_nicap_pct)::numeric(20,10),
    MAX(kpi04_nicap_pct),
    100.0000000000::numeric(20,10),
    'Regulatorio CNBV: >100% cobertura adecuada; Categoría 1 >=150%, Cat 2 >=100% y <150%, Cat 3 >=50% y <100%, Cat 4 <50%'
FROM s2025
UNION ALL
SELECT
    'KPI-05', 'Tasa implícita activa de cartera vigente', 'observado_2025',
    MIN(kpi05_tasa_activa_pct),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY kpi05_tasa_activa_pct)::numeric(20,10),
    MAX(kpi05_tasa_activa_pct),
    NULL::numeric(20,10),
    'Banda observada en 2025 con ventana móvil de 12 saldos mensuales'
FROM s2025
UNION ALL
SELECT
    'KPI-06', 'Tasa implícita pasiva', 'observado_2025',
    MIN(kpi06_tasa_pasiva_pct),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY kpi06_tasa_pasiva_pct)::numeric(20,10),
    MAX(kpi06_tasa_pasiva_pct),
    NULL::numeric(20,10),
    'Banda observada en 2025; usa fila 153 que reproduce exactamente la fila 224 publicada'
FROM s2025
UNION ALL
SELECT
    'KPI-07', 'Capital contable / Activo total', 'observado_2025',
    MIN(kpi07_capital_activo_pct),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY kpi07_capital_activo_pct)::numeric(20,10),
    MAX(kpi07_capital_activo_pct),
    NULL::numeric(20,10),
    'Banda observada en 2025 (no regulatoria)'
FROM s2025
UNION ALL
SELECT
    'KPI-08', 'Rendimiento sobre el activo (ROA)', 'observado_2025',
    MIN(kpi08_roa_pct),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY kpi08_roa_pct)::numeric(20,10),
    MAX(kpi08_roa_pct),
    NULL::numeric(20,10),
    'Banda observada en 2025 con ventana móvil de 12 saldos mensuales de ACTIVO'
FROM s2025
UNION ALL
SELECT
    'KPI-09', 'Índice colocación / captación (sectorial)', 'observado_2025',
    MIN(kpi09_colocacion_captacion_trad_pct),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY kpi09_colocacion_captacion_trad_pct)::numeric(20,10),
    MAX(kpi09_colocacion_captacion_trad_pct),
    NULL::numeric(20,10),
    'Banda observada en 2025 (Cartera vigente / Captación tradicional)'
FROM s2025
UNION ALL
SELECT
    'M-01', 'Participación femenina en el sector SOCAP', 'sin_umbral',
    MIN(m01_participacion_femenina_socios_pct),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY m01_participacion_femenina_socios_pct)::numeric(20,10),
    MAX(m01_participacion_femenina_socios_pct),
    NULL::numeric(20,10),
    'Sin umbral; denominador = suma de mujeres (203) + hombres (204) conforme a nota Series!C236'
FROM s2025;

COMMENT ON VIEW v_kpis_cnbv_sector_bandas_2025 IS
'Resumen de bandas de referencia observadas en los 12 meses de 2025 y umbral regulatorio de NICAP.';

-- -----------------------------------------------------------------------------
-- 3. Vista Institucional Trimestral y Ranking de Cooperativas (Boletines CNBV)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_kpis_cnbv_institucion_trim AS
SELECT
    b.institucion_trim_id,
    b.ejecucion_id,
    b.mes_id,
    b.periodo_ym,
    b.anio,
    b.trimestre,
    b.institucion_id,
    b.clave_seis,
    b.clave_boletin,
    b.clave_catalogo,
    b.institucion_nombre,
    b.estado_reporte,

    -- Conteos y saldos al cierre en MXN (semiaditivos: no sumar entre trimestres)
    b.socios,
    b.sucursales,
    b.activo_mxn,
    b.disponibilidades_mxn,
    b.cartera_vigente_mxn,
    b.cartera_vencida_mxn,
    (b.cartera_vigente_mxn + b.cartera_vencida_mxn) AS cartera_total_calc_mxn,
    b.estimacion_mxn,
    b.captacion_total_mxn,
    b.captacion_tradicional_mxn,
    b.ingresos_intereses_trim_mxn,
    b.gastos_intereses_trim_mxn,

    -- KPI-01 Institucional (IMOR publicado y verificado por fórmula)
    b.imor_pct AS kpi01_imor_publicado_pct,
    ((b.cartera_vencida_mxn / NULLIF(b.cartera_vigente_mxn + b.cartera_vencida_mxn, 0)) * 100)::numeric(20,10)
        AS kpi01_imor_recalculado_pct,

    -- KPI-02 Institucional (ICOR derivado, no publicado individualmente en boletín)
    ((ABS(b.estimacion_mxn) / NULLIF(b.cartera_vencida_mxn, 0)) * 100)::numeric(20,10)
        AS kpi02_icor_derivado_pct,

    -- KPI-03 Institucional: NO REPRODUCIBLE por cooperativa (se expone NULL explícito y nota)
    NULL::numeric(20,10) AS kpi03_liquidez_no_disponible_pct,

    -- KPI-04 Institucional (NICAP publicado y categoría regulatoria)
    b.nicap_pct AS kpi04_nicap_publicado_pct,
    b.categoria_nicap AS kpi04_categoria_nicap,

    -- KPI-05 y KPI-06 Variante Institucional Trimestral (publicadas en hoja TI)
    b.tasa_activa_pct AS kpi05_tasa_activa_ti_pct,
    b.tasa_pasiva_total_pct AS kpi06_tasa_pasiva_total_ti_pct,
    b.tasa_pasiva_tradicional_pct AS kpi06_tasa_pasiva_tradicional_ti_pct,
    (b.tasa_activa_pct - b.tasa_pasiva_total_pct)::numeric(20,10) AS spread_ti_total_pp,

    -- KPI-09 Variante Institucional Trimestral (Derivado: Cartera vigente / Captación total * 100)
    ((b.cartera_vigente_mxn / NULLIF(b.captacion_total_mxn, 0)) * 100)::numeric(20,10)
        AS kpi09_colocacion_captacion_total_derivado_pct,

    -- M-02: Participación por activo de cada institución (publicada vs recalculada contra TOTAL)
    b.participacion_activo_pct AS m02_participacion_activo_publicada_pct,
    ((b.activo_mxn / NULLIF(b.total_sector_activo_mxn, 0)) * 100)::numeric(20,10)
        AS m02_participacion_activo_recalculada_pct,

    -- Rankings por trimestre (excluyendo sociedades con valor NULL / n.d.)
    CASE
        WHEN b.imor_pct IS NOT NULL THEN
            DENSE_RANK() OVER (
                PARTITION BY b.ejecucion_id, b.mes_id, (b.imor_pct IS NOT NULL)
                ORDER BY b.imor_pct DESC
            )
        ELSE NULL
    END AS rank_imor_mayor_riesgo,
    CASE
        WHEN b.activo_mxn IS NOT NULL THEN
            DENSE_RANK() OVER (
                PARTITION BY b.ejecucion_id, b.mes_id, (b.activo_mxn IS NOT NULL)
                ORDER BY b.activo_mxn DESC
            )
        ELSE NULL
    END AS rank_activo_mayor_tamano,
    CASE
        WHEN b.nicap_pct IS NOT NULL THEN
            DENSE_RANK() OVER (
                PARTITION BY b.ejecucion_id, b.mes_id, (b.nicap_pct IS NOT NULL)
                ORDER BY b.nicap_pct DESC
            )
        ELSE NULL
    END AS rank_nicap_fortaleza
FROM v_cnbv_institucion_trim_base b;

COMMENT ON VIEW v_kpis_cnbv_institucion_trim IS
'Ficha trimestral y rankings por cooperativa SOCAP. Excluye registros con NULL (n.d.) de los rankings y etiqueta explícitamente ICOR y colocación/captación como derivados.';

-- -----------------------------------------------------------------------------
-- 4. Vista de Contraste Trimestral: SH_SOCAPS!Series vs. Boletines BE_SOCAPS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_kpis_cnbv_contraste_trim AS
SELECT
    t.ejecucion_id,
    t.mes_id,
    to_char(t.mes_id, 'YYYY-MM') AS periodo_ym,
    '2025-Q' || (EXTRACT(MONTH FROM t.mes_id)::integer / 3)::text AS trimestre,

    -- Saldos del total trimestral del boletín vs Series
    t.activo_mxn AS boletin_activo_total_mxn,
    s.activo_total_mxn AS series_activo_total_mxn,
    t.cartera_vigente_mxn AS boletin_cartera_vigente_mxn,
    s.cartera_vigente_mxn AS series_cartera_vigente_mxn,
    t.captacion_total_mxn AS boletin_captacion_total_mxn,
    s.captacion_tradicional_mxn AS series_captacion_tradicional_mxn,

    -- KPI-01 IMOR
    s.kpi01_imor_pct AS series_imor_pct,
    t.imor_pct AS boletin_imor_pct,
    (t.imor_pct - s.kpi01_imor_pct)::numeric(20,10) AS diff_imor_pp,

    -- KPI-02 ICOR
    s.kpi02_icor_pct AS series_icor_pct,
    t.icor_pct AS boletin_icor_pct,
    (t.icor_pct - s.kpi02_icor_pct)::numeric(20,10) AS diff_icor_pp,

    -- KPI-04 NICAP
    s.kpi04_nicap_pct AS series_nicap_pct,
    t.nicap_pct AS boletin_nicap_pct,
    (t.nicap_pct - s.kpi04_nicap_pct)::numeric(20,10) AS diff_nicap_pp,

    -- KPI-08 ROA
    s.kpi08_roa_pct AS series_roa_pct,
    t.roa_pct AS boletin_roa_pct,
    (t.roa_pct - s.kpi08_roa_pct)::numeric(20,10) AS diff_roa_pp,

    -- KPI-09 Colocación / Captación (Institucional usa Captación Total; Series usa Captación Tradicional)
    ((t.cartera_vigente_mxn / NULLIF(t.captacion_total_mxn, 0)) * 100)::numeric(20,10)
        AS boletin_kpi09_colocacion_captacion_total_pct,
    s.kpi09_colocacion_captacion_trad_pct
        AS series_kpi09_colocacion_captacion_trad_pct
FROM hecho_cnbv_total_trim t
JOIN v_ejecucion_activa ea
  ON ea.ejecucion_id = t.ejecucion_id
LEFT JOIN v_kpis_cnbv_sector_mes s
  ON s.ejecucion_id = t.ejecucion_id
 AND s.mes_id = t.mes_id;

COMMENT ON VIEW v_kpis_cnbv_contraste_trim IS
'Contrasta los indicadores publicados en los boletines trimestrales (hecho_cnbv_total_trim) frente a la serie histórica mensual (SH_SOCAPS.xlsm!Series), documentando discrepancias por fecha de elaboración.';

-- -----------------------------------------------------------------------------
-- 5. Vistas M-03 FONACOT: Créditos, Monto, Participación Femenina y Ticket Promedio
-- -----------------------------------------------------------------------------
-- 5A. Resumen Trimestral Nacional (con y sin APP MOVIL)
CREATE OR REPLACE VIEW v_kpis_fonacot_trim_resumen AS
SELECT
    f.ejecucion_id,
    f.anio,
    f.trimestre,
    -- Total nacional (incluyendo APP MOVIL, tal como viene en los CSV oficiales)
    SUM(f.creditos) AS creditos_totales_nacional,
    SUM(f.creditos) FILTER (WHERE f.genero = 'mujeres') AS creditos_mujeres_nacional,
    SUM(f.creditos) FILTER (WHERE f.genero = 'hombres') AS creditos_hombres_nacional,
    ((SUM(f.creditos) FILTER (WHERE f.genero = 'mujeres')::numeric
      / NULLIF(SUM(f.creditos)::numeric, 0)) * 100)::numeric(20,10)
        AS m03_participacion_femenina_creditos_pct,
    SUM(f.monto_mxn) AS monto_total_nacional_mxn,
    SUM(f.monto_mxn) FILTER (WHERE f.genero = 'mujeres') AS monto_mujeres_nacional_mxn,
    SUM(f.monto_mxn) FILTER (WHERE f.genero = 'hombres') AS monto_hombres_nacional_mxn,
    ((SUM(f.monto_mxn) FILTER (WHERE f.genero = 'mujeres')
      / NULLIF(SUM(f.monto_mxn), 0)) * 100)::numeric(20,10)
        AS m03_participacion_femenina_monto_pct,
    (SUM(f.monto_mxn) / NULLIF(SUM(f.creditos)::numeric, 0))::numeric(30,6)
        AS m03_ticket_promedio_nacional_mxn,

    -- Subtotal exclusivo de Entidades Federativas (excluyendo canal APP MOVIL)
    SUM(f.creditos) FILTER (WHERE f.tipo_ambito = 'entidad') AS creditos_solo_entidades,
    SUM(f.monto_mxn) FILTER (WHERE f.tipo_ambito = 'entidad') AS monto_solo_entidades_mxn,
    ((SUM(f.creditos) FILTER (WHERE f.tipo_ambito = 'entidad' AND f.genero = 'mujeres')::numeric
      / NULLIF(SUM(f.creditos) FILTER (WHERE f.tipo_ambito = 'entidad')::numeric, 0)) * 100)::numeric(20,10)
        AS m03_participacion_femenina_solo_entidades_pct,

    -- Subtotal del canal APP MOVIL
    SUM(f.creditos) FILTER (WHERE f.tipo_ambito = 'canal') AS creditos_canal_app_movil,
    SUM(f.monto_mxn) FILTER (WHERE f.tipo_ambito = 'canal') AS monto_canal_app_movil_mxn
FROM v_fonacot_mes_base f
GROUP BY f.ejecucion_id, f.anio, f.trimestre;

COMMENT ON VIEW v_kpis_fonacot_trim_resumen IS
'M-03 FONACOT por trimestre: créditos totales, monto en MXN, participación femenina (%) y ticket promedio, separando el total nacional (que incluye APP MOVIL) del subtotal de entidades federativas.';

-- 5B. Desglose por Ámbito (Entidad Federativa o Canal) y Trimestre
CREATE OR REPLACE VIEW v_kpis_fonacot_ambito_trim AS
SELECT
    f.ejecucion_id,
    f.anio,
    f.trimestre,
    f.ambito_id,
    f.tipo_ambito,
    f.ambito_canonico,
    SUM(f.creditos) AS creditos_totales,
    SUM(f.creditos) FILTER (WHERE f.genero = 'mujeres') AS creditos_mujeres,
    SUM(f.creditos) FILTER (WHERE f.genero = 'hombres') AS creditos_hombres,
    ((SUM(f.creditos) FILTER (WHERE f.genero = 'mujeres')::numeric
      / NULLIF(SUM(f.creditos)::numeric, 0)) * 100)::numeric(20,10)
        AS m03_participacion_femenina_creditos_pct,
    SUM(f.monto_mxn) AS monto_total_mxn,
    SUM(f.monto_mxn) FILTER (WHERE f.genero = 'mujeres') AS monto_mujeres_mxn,
    SUM(f.monto_mxn) FILTER (WHERE f.genero = 'hombres') AS monto_hombres_mxn,
    (SUM(f.monto_mxn) / NULLIF(SUM(f.creditos)::numeric, 0))::numeric(30,6)
        AS m03_ticket_promedio_mxn
FROM v_fonacot_mes_base f
GROUP BY f.ejecucion_id, f.anio, f.trimestre, f.ambito_id, f.tipo_ambito, f.ambito_canonico;

COMMENT ON VIEW v_kpis_fonacot_ambito_trim IS
'M-03 FONACOT desglosado por ámbito (entidad federativa o canal APP MOVIL) y trimestre.';

-- -----------------------------------------------------------------------------
-- 6. Vistas M-04 SNIIV: Financiamientos de Vivienda (Anual, por Entidad y por Mes)
-- -----------------------------------------------------------------------------
-- 6A. Resumen Anual Nacional SNIIV (M-04)
CREATE OR REPLACE VIEW v_kpis_sniiv_anual_resumen AS
SELECT
    s.ejecucion_id,
    s.anio,
    COUNT(*) AS total_registros_csv,
    SUM(s.acciones) AS m04_acciones_totales,
    SUM(s.monto_mxn) AS m04_monto_total_mxn,
    (SUM(s.monto_mxn) / NULLIF(SUM(s.acciones)::numeric, 0))::numeric(30,6)
        AS m04_promedio_por_accion_mxn,

    -- Desglose por sexo (1=Hombre, 2=Mujer; NULL se conserva en el total y se excluye del denominador de género)
    SUM(s.acciones) FILTER (WHERE s.sexo = '2') AS acciones_mujeres,
    SUM(s.acciones) FILTER (WHERE s.sexo = '1') AS acciones_hombres,
    SUM(s.acciones) FILTER (WHERE s.sexo IN ('1', '2')) AS acciones_con_sexo_definido,
    COUNT(*) FILTER (WHERE s.sexo IS NULL) AS filas_sin_sexo,
    COALESCE(SUM(s.acciones) FILTER (WHERE s.sexo IS NULL), 0) AS acciones_sin_sexo,
    COALESCE(SUM(s.monto_mxn) FILTER (WHERE s.sexo IS NULL), 0) AS monto_sin_sexo_mxn,

    SUM(s.monto_mxn) FILTER (WHERE s.sexo = '2') AS monto_mujeres_mxn,
    SUM(s.monto_mxn) FILTER (WHERE s.sexo = '1') AS monto_hombres_mxn,
    SUM(s.monto_mxn) FILTER (WHERE s.sexo IN ('1', '2')) AS monto_con_sexo_definido_mxn,

    -- Fórmulas M-04 de participación femenina sobre registros con sexo in ('1','2')
    ((SUM(s.acciones) FILTER (WHERE s.sexo = '2')::numeric
      / NULLIF(SUM(s.acciones) FILTER (WHERE s.sexo IN ('1', '2'))::numeric, 0)) * 100)::numeric(20,10)
        AS m04_participacion_mujeres_acciones_pct,
    ((SUM(s.monto_mxn) FILTER (WHERE s.sexo = '2')
      / NULLIF(SUM(s.monto_mxn) FILTER (WHERE s.sexo IN ('1', '2')), 0)) * 100)::numeric(20,10)
        AS m04_participacion_mujeres_monto_pct,

    -- Participación de INFONAVIT (organismo = '1') sobre acciones totales
    SUM(s.acciones) FILTER (WHERE s.organismo = '1') AS acciones_infonavit,
    SUM(s.monto_mxn) FILTER (WHERE s.organismo = '1') AS monto_infonavit_mxn,
    ((SUM(s.acciones) FILTER (WHERE s.organismo = '1')::numeric
      / NULLIF(SUM(s.acciones)::numeric, 0)) * 100)::numeric(20,10)
        AS m04_participacion_infonavit_acciones_pct
FROM v_sniiv_mes_base s
GROUP BY s.ejecucion_id, s.anio;

COMMENT ON VIEW v_kpis_sniiv_anual_resumen IS
'M-04 SNIIV resumen anual: concilia 325,649 filas, 998,745 acciones y $617,246,458,236.39 MXN, excluyendo las 399 filas sin sexo (4 acciones) solo del denominador de participación femenina.';

-- 6B. Desglose SNIIV por Entidad Federativa
CREATE OR REPLACE VIEW v_kpis_sniiv_entidad_anual AS
SELECT
    s.ejecucion_id,
    s.anio,
    s.cve_ent,
    MAX(s.entidad) AS entidad_nombre,
    COUNT(*) AS registros_csv,
    SUM(s.acciones) AS acciones_totales,
    SUM(s.monto_mxn) AS monto_total_mxn,
    (SUM(s.monto_mxn) / NULLIF(SUM(s.acciones)::numeric, 0))::numeric(30,6)
        AS promedio_por_accion_mxn,
    SUM(s.acciones) FILTER (WHERE s.sexo = '2') AS acciones_mujeres,
    SUM(s.acciones) FILTER (WHERE s.sexo = '1') AS acciones_hombres,
    COALESCE(SUM(s.acciones) FILTER (WHERE s.sexo IS NULL), 0) AS acciones_sin_sexo,
    ((SUM(s.acciones) FILTER (WHERE s.sexo = '2')::numeric
      / NULLIF(SUM(s.acciones) FILTER (WHERE s.sexo IN ('1', '2'))::numeric, 0)) * 100)::numeric(20,10)
        AS m04_participacion_mujeres_acciones_pct,
    ((SUM(s.monto_mxn) FILTER (WHERE s.sexo = '2')
      / NULLIF(SUM(s.monto_mxn) FILTER (WHERE s.sexo IN ('1', '2')), 0)) * 100)::numeric(20,10)
        AS m04_participacion_mujeres_monto_pct,
    SUM(s.acciones) FILTER (WHERE s.organismo = '1') AS acciones_infonavit,
    ((SUM(s.acciones) FILTER (WHERE s.organismo = '1')::numeric
      / NULLIF(SUM(s.acciones)::numeric, 0)) * 100)::numeric(20,10)
        AS m04_participacion_infonavit_acciones_pct
FROM v_sniiv_mes_base s
GROUP BY s.ejecucion_id, s.anio, s.cve_ent;

COMMENT ON VIEW v_kpis_sniiv_entidad_anual IS
'M-04 SNIIV desglosado por código de entidad federativa (cve_ent), preservando clave con cero inicial y nulos.';
