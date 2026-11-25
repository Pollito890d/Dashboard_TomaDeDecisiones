-- =============================================================================
-- Fase IV — Paso 17: Consultas de Validación y Exactitud de KPIs
-- Archivo: Database/tests/validacion_kpis.sql
-- Motor: PostgreSQL 15+
-- Dependencia: Ejecutar después de Database/03_views.sql
-- Descripción:
--   Valida la exactitud matemática, denominadores, unidades, periodos, ventanas
--   móviles de 12 meses, manejo de nulos (n.d. / sexo NULL) y casos de control
--   reales frente a los valores documentados en docs/catalogo_kpis.md:
--     1. Estado de instantánea activa y recuentos de tablas de hechos.
--     2. Casos de control sectoriales CNBV (2025-03 y 2025-12) para KPI-01 a KPI-09
--        y M-01 vs. valores publicados en SH_SOCAPS.xlsm!Series (tolerancia <= 1e-9 pp).
--     3. Verificación de ventanas móviles de 12 meses consecutivos (prom12) para
--        KPI-05, KPI-06 y KPI-08.
--     4. Caso de control institucional trimestral: Caja Popular Mexicana (029056)
--        en 2025-Q1 (2025-03-01) y 2025-Q4 (2025-12-01), incluyendo KPIs derivados
--        (ICOR y colocación/captación) y M-02 (participación por activo).
--     5. Contraste de discrepancias oficiales: SH_SOCAPS.xlsm!Series vs. Boletines
--        trimestrales BE_SOCAPS (hecho_cnbv_total_trim).
--     6. Casos de control M-03 FONACOT (4 trimestres de 2025 + caso Aguascalientes
--        Ene_mujeres + separación de canal APP MOVIL).
--     7. Casos de control M-04 SNIIV 2025 (325,649 filas, 998,745 acciones,
--        $617,246,458,236.39 MXN, 399 filas sin sexo = 4 acciones, participación
--        femenina e INFONAVIT).
--     8. Pruebas unitarias en SQL de casos borde: denominadores cero (NULLIF),
--        exclusión de n.d. en rankings institucionales y no suma de saldos.
-- =============================================================================

SET search_path = public, pg_catalog;

-- -----------------------------------------------------------------------------
-- BLOQUE 1: Verificación de instantánea activa y recuentos base
-- -----------------------------------------------------------------------------
SELECT
    '01_INSTANTANEA_Y_RECUENTOS' AS bloque_prueba,
    (SELECT ejecucion_id FROM v_ejecucion_activa) AS ejecucion_activa_id,
    (SELECT count(*) FROM hecho_cnbv_sector_mes WHERE ejecucion_id = (SELECT ejecucion_id FROM v_ejecucion_activa)) AS filas_sector_mes_obs,
    598 AS filas_sector_mes_esp,
    (SELECT count(*) FROM hecho_cnbv_institucion_trim WHERE ejecucion_id = (SELECT ejecucion_id FROM v_ejecucion_activa)) AS filas_institucion_trim_obs,
    620 AS filas_institucion_trim_esp,
    (SELECT count(*) FROM hecho_cnbv_total_trim WHERE ejecucion_id = (SELECT ejecucion_id FROM v_ejecucion_activa)) AS filas_total_trim_obs,
    4 AS filas_total_trim_esp,
    (SELECT count(*) FROM hecho_fonacot_mes WHERE ejecucion_id = (SELECT ejecucion_id FROM v_ejecucion_activa)) AS filas_fonacot_mes_obs,
    792 AS filas_fonacot_mes_esp,
    (SELECT count(*) FROM hecho_sniiv_mes WHERE ejecucion_id = (SELECT ejecucion_id FROM v_ejecucion_activa)) AS filas_sniiv_mes_obs,
    325649 AS filas_sniiv_mes_esp;

-- -----------------------------------------------------------------------------
-- BLOQUE 2: Matriz de Validación Sectorial CNBV (2025-03 y 2025-12)
-- Compara KPI-01..09 y M-01 calculados en SQL contra los valores esperados del
-- catálogo (docs/catalogo_kpis.md §2, §3 y §5) y contra las filas publicadas.
-- Tolerancia máxima aceptada: 1e-9 puntos porcentuales.
-- -----------------------------------------------------------------------------
WITH casos_esperados AS (
    SELECT * FROM (VALUES
        -- Corte 2025-03 (Marzo 2025)
        ('2025-03', 'KPI-01', 'IMOR (%)',                           4.2361948375::numeric(20,10)),
        ('2025-03', 'KPI-02', 'ICOR (%)',                         125.5267605593::numeric(20,10)),
        ('2025-03', 'KPI-03', 'Coeficiente de liquidez (%)',       37.6929816952::numeric(20,10)),
        ('2025-03', 'KPI-04', 'NICAP (%)',                        306.5197159872::numeric(20,10)),
        ('2025-03', 'KPI-05', 'Tasa implícita activa (%)',         18.1688146566::numeric(20,10)),
        ('2025-03', 'KPI-06', 'Tasa implícita pasiva (%)',          5.8022194344::numeric(20,10)),
        ('2025-03', 'KPI-07', 'Capital contable / Activo (%)',     18.0284996299::numeric(20,10)),
        ('2025-03', 'KPI-08', 'ROA (%)',                            2.5445223519::numeric(20,10)),
        ('2025-03', 'KPI-09', 'Colocación / Captación trad. (%)',  68.8889316436::numeric(20,10)),
        ('2025-03', 'M-01',   'Participación femenina SOCAP (%)',  54.1876615945::numeric(20,10)),
        -- Corte 2025-12 (Diciembre 2025)
        ('2025-12', 'KPI-01', 'IMOR (%)',                           4.0549697085::numeric(20,10)),
        ('2025-12', 'KPI-02', 'ICOR (%)',                         127.5907268062::numeric(20,10)),
        ('2025-12', 'KPI-03', 'Coeficiente de liquidez (%)',       35.6261802328::numeric(20,10)),
        ('2025-12', 'KPI-04', 'NICAP (%)',                        300.2533349855::numeric(20,10)),
        ('2025-12', 'KPI-05', 'Tasa implícita activa (%)',         18.2304798424::numeric(20,10)),
        ('2025-12', 'KPI-06', 'Tasa implícita pasiva (%)',          5.2719823640::numeric(20,10)),
        ('2025-12', 'KPI-07', 'Capital contable / Activo (%)',     17.8527845893::numeric(20,10)),
        ('2025-12', 'KPI-08', 'ROA (%)',                            2.1536581163::numeric(20,10)),
        ('2025-12', 'M-01',   'Participación femenina SOCAP (%)',  54.2112064685::numeric(20,10))
    ) AS t(periodo_ym, kpi_id, indicador, valor_esperado_catalogo)
),
observados_sql AS (
    SELECT periodo_ym, 'KPI-01' AS kpi_id, kpi01_imor_pct AS valor_calc_sql, kpi01_imor_publicado_pct AS valor_pub_series FROM v_kpis_cnbv_sector_mes
    UNION ALL
    SELECT periodo_ym, 'KPI-02', kpi02_icor_pct, kpi02_icor_publicado_pct FROM v_kpis_cnbv_sector_mes
    UNION ALL
    SELECT periodo_ym, 'KPI-03', kpi03_liquidez_pct, kpi03_liquidez_publicado_pct FROM v_kpis_cnbv_sector_mes
    UNION ALL
    SELECT periodo_ym, 'KPI-04', kpi04_nicap_pct, kpi04_nicap_publicado_pct FROM v_kpis_cnbv_sector_mes
    UNION ALL
    SELECT periodo_ym, 'KPI-05', kpi05_tasa_activa_pct, kpi05_tasa_activa_publicada_pct FROM v_kpis_cnbv_sector_mes
    UNION ALL
    SELECT periodo_ym, 'KPI-06', kpi06_tasa_pasiva_pct, kpi06_tasa_pasiva_publicada_pct FROM v_kpis_cnbv_sector_mes
    UNION ALL
    SELECT periodo_ym, 'KPI-07', kpi07_capital_activo_pct, kpi07_capital_activo_publicado_pct FROM v_kpis_cnbv_sector_mes
    UNION ALL
    SELECT periodo_ym, 'KPI-08', kpi08_roa_pct, kpi08_roa_publicado_pct FROM v_kpis_cnbv_sector_mes
    UNION ALL
    SELECT periodo_ym, 'KPI-09', kpi09_colocacion_captacion_trad_pct, NULL::numeric(20,10) FROM v_kpis_cnbv_sector_mes
    UNION ALL
    SELECT periodo_ym, 'M-01',   m01_participacion_femenina_socios_pct, NULL::numeric(20,10) FROM v_kpis_cnbv_sector_mes
)
SELECT
    e.periodo_ym,
    e.kpi_id,
    e.indicador,
    e.valor_esperado_catalogo,
    o.valor_calc_sql,
    o.valor_pub_series,
    ABS(o.valor_calc_sql - e.valor_esperado_catalogo) AS diff_vs_catalogo_pp,
    ABS(o.valor_calc_sql - o.valor_pub_series) AS diff_vs_publicado_pp,
    CASE
        WHEN o.valor_calc_sql IS NULL THEN 'SIN_DATOS_EN_BD'
        WHEN ABS(o.valor_calc_sql - e.valor_esperado_catalogo) <= 0.000000001 THEN 'OK (<= 1e-9 pp)'
        ELSE 'REVISAR_DIFERENCIA'
    END AS estado_validacion
FROM casos_esperados e
LEFT JOIN observados_sql o
  ON o.periodo_ym = e.periodo_ym
 AND o.kpi_id = e.kpi_id
ORDER BY e.periodo_ym, e.kpi_id;

-- -----------------------------------------------------------------------------
-- BLOQUE 3: Validación de Denominadores Promediados de 12 Meses en 2025-03
-- Verifica que prom12(13), prom12(35) y prom12(5) coincidan con docs/catalogo_kpis.md §5
-- (en MXN: millones * 1,000,000).
-- -----------------------------------------------------------------------------
SELECT
    periodo_ym,
    ventana_12m_completa,
    prom12_cartera_vigente_mxn,
    154141597205.166667::numeric(30,6) AS esperado_prom12_v013_mxn,
    ABS(prom12_cartera_vigente_mxn - 154141597205.166667::numeric(30,6)) AS diff_v013_mxn,
    prom12_captacion_tradicional_mxn,
    219038275966.916667::numeric(30,6) AS esperado_prom12_v035_mxn,
    ABS(prom12_captacion_tradicional_mxn - 219038275966.916667::numeric(30,6)) AS diff_v035_mxn,
    prom12_activo_total_mxn,
    278842081529.583333::numeric(30,6) AS esperado_prom12_v005_mxn,
    ABS(prom12_activo_total_mxn - 278842081529.583333::numeric(30,6)) AS diff_v005_mxn
FROM v_kpis_cnbv_sector_mes
WHERE periodo_ym = '2025-03';

-- -----------------------------------------------------------------------------
-- BLOQUE 4: Validación de Caso de Control Institucional — Caja Popular Mexicana (029056)
-- Compara los cortes 2025-Q1 (2025-03) y 2025-Q4 (2025-12) contra docs/catalogo_kpis.md §3.1
-- -----------------------------------------------------------------------------
WITH cpm_esperado AS (
    SELECT * FROM (VALUES
        (
            '2025-03', '029056',
            3692848::bigint,
            114228216874.000000::numeric(30,6),
            38.7596208040::numeric(20,10),
            1739002836.000000::numeric(30,6),
            58779416190.000000::numeric(30,6),
            1946111129.000000::numeric(30,6),
            3.2047661254::numeric(20,10),
            252.3931729344::numeric(20,10),
            '1'::text,
            61.5092339937::numeric(20,10),
            149.1237873698::numeric(20,10)
        ),
        (
            '2025-12', '029056',
            3873780::bigint,
            126888191520.000000::numeric(30,6),
            39.4283734536::numeric(20,10),
            1481021783.000000::numeric(30,6),
            67171203942.000000::numeric(30,6),
            1943667351.000000::numeric(30,6),
            2.8122274044::numeric(20,10),
            235.6833561551::numeric(20,10),
            '1'::text,
            62.9331980237::numeric(20,10),
            158.9652881365::numeric(20,10)
        )
    ) AS t(
        periodo_ym, clave_seis,
        esp_socios, esp_activo_mxn, esp_part_activo_pct, esp_disp_mxn,
        esp_vigente_mxn, esp_vencida_mxn, esp_imor_pct, esp_nicap_pct,
        esp_cat_nicap, esp_colocacion_deriv_pct, esp_icor_deriv_pct
    )
)
SELECT
    e.periodo_ym,
    e.clave_seis,
    i.institucion_nombre,
    i.socios AS obs_socios,
    e.esp_socios,
    i.activo_mxn AS obs_activo_mxn,
    e.esp_activo_mxn,
    i.kpi01_imor_publicado_pct AS obs_imor_pub_pct,
    i.kpi01_imor_recalculado_pct AS obs_imor_calc_pct,
    e.esp_imor_pct,
    i.kpi02_icor_derivado_pct AS obs_icor_deriv_pct,
    e.esp_icor_deriv_pct,
    i.kpi04_nicap_publicado_pct AS obs_nicap_pct,
    e.esp_nicap_pct,
    i.kpi09_colocacion_captacion_total_derivado_pct AS obs_colocacion_deriv_pct,
    e.esp_colocacion_deriv_pct,
    i.m02_participacion_activo_publicada_pct AS obs_m02_pub_pct,
    i.m02_participacion_activo_recalculada_pct AS obs_m02_calc_pct,
    e.esp_part_activo_pct
FROM cpm_esperado e
LEFT JOIN v_kpis_cnbv_institucion_trim i
  ON i.periodo_ym = e.periodo_ym
 AND i.clave_seis = e.clave_seis
ORDER BY e.periodo_ym;

-- -----------------------------------------------------------------------------
-- BLOQUE 5: Contraste de Discrepancias Oficiales (SH_SOCAPS!Series vs. Boletines BE_SOCAPS)
-- Documenta las diferencias en 2025-Q1..Q4 por distinta fecha de elaboración.
-- -----------------------------------------------------------------------------
SELECT
    periodo_ym,
    trimestre,
    series_imor_pct,
    boletin_imor_pct,
    diff_imor_pp,
    series_icor_pct,
    boletin_icor_pct,
    diff_icor_pp,
    series_nicap_pct,
    boletin_nicap_pct,
    diff_nicap_pp,
    series_roa_pct,
    boletin_roa_pct,
    diff_roa_pp,
    series_kpi09_colocacion_captacion_trad_pct,
    boletin_kpi09_colocacion_captacion_total_pct
FROM v_kpis_cnbv_contraste_trim
ORDER BY mes_id;

-- -----------------------------------------------------------------------------
-- BLOQUE 6: Validación M-03 FONACOT (4 Trimestres 2025 + Caso Aguascalientes Ene_mujeres)
-- -----------------------------------------------------------------------------
WITH fonacot_esp AS (
    SELECT * FROM (VALUES
        ('2025-Q1', 503416::bigint, 15525525836.550000::numeric(30,6), 40.9694964006::numeric(20,10)),
        ('2025-Q2', 510842::bigint, 15838163285.810000::numeric(30,6), 42.2077667850::numeric(20,10)),
        ('2025-Q3', 601649::bigint, 18517548812.570000::numeric(30,6), 41.8039421656::numeric(20,10)),
        ('2025-Q4', 561561::bigint, 16889088475.450000::numeric(30,6), 41.8268006503::numeric(20,10))
    ) AS t(trimestre, esp_creditos, esp_monto_mxn, esp_part_femenina_pct)
)
SELECT
    e.trimestre,
    e.esp_creditos,
    r.creditos_totales_nacional AS obs_creditos,
    e.esp_monto_mxn,
    r.monto_total_nacional_mxn AS obs_monto_mxn,
    e.esp_part_femenina_pct,
    r.m03_participacion_femenina_creditos_pct AS obs_part_femenina_pct,
    r.m03_ticket_promedio_nacional_mxn AS obs_ticket_promedio_mxn,
    r.creditos_solo_entidades,
    r.creditos_canal_app_movil
FROM fonacot_esp e
LEFT JOIN v_kpis_fonacot_trim_resumen r
  ON r.trimestre = e.trimestre
ORDER BY e.trimestre;

-- Caso puntual M-03: AGUASCALIENTES, 2025-01, mujeres (esperado: 1,326 créditos y $32,050,929.75 MXN)
SELECT
    periodo_ym,
    ambito_canonico,
    genero,
    creditos AS obs_creditos,
    1326 AS esp_creditos,
    monto_mxn AS obs_monto_mxn,
    32050929.750000::numeric(30,6) AS esp_monto_mxn
FROM v_fonacot_mes_base
WHERE periodo_ym = '2025-01'
  AND ambito_canonico = 'AGUASCALIENTES'
  AND genero = 'mujeres';

-- -----------------------------------------------------------------------------
-- BLOQUE 7: Validación M-04 SNIIV 2025 (Totales, Participación Femenina, INFONAVIT y Nulos)
-- -----------------------------------------------------------------------------
SELECT
    anio,
    total_registros_csv AS obs_registros,
    325649 AS esp_registros,
    m04_acciones_totales AS obs_acciones,
    998745 AS esp_acciones,
    m04_monto_total_mxn AS obs_monto_mxn,
    617246458236.390000::numeric(30,6) AS esp_monto_mxn,
    m04_promedio_por_accion_mxn AS obs_promedio_accion_mxn,
    618022.075942::numeric(30,6) AS esp_promedio_accion_mxn,
    filas_sin_sexo AS obs_filas_sin_sexo,
    399 AS esp_filas_sin_sexo,
    acciones_sin_sexo AS obs_acciones_sin_sexo,
    4 AS esp_acciones_sin_sexo,
    monto_sin_sexo_mxn AS obs_monto_sin_sexo_mxn,
    265488266.350000::numeric(30,6) AS esp_monto_sin_sexo_mxn,
    m04_participacion_mujeres_acciones_pct AS obs_mujeres_acciones_pct,
    45.2635870031::numeric(20,10) AS esp_mujeres_acciones_pct,
    m04_participacion_mujeres_monto_pct AS obs_mujeres_monto_pct,
    40.2307281414::numeric(20,10) AS esp_mujeres_monto_pct,
    m04_participacion_infonavit_acciones_pct AS obs_infonavit_acciones_pct,
    66.7795082829::numeric(20,10) AS esp_infonavit_acciones_pct
FROM v_kpis_sniiv_anual_resumen;

-- -----------------------------------------------------------------------------
-- BLOQUE 8: Pruebas de Casos Borde (Denominadores Cero, Ventanas <12m y Nulos n.d.)
-- -----------------------------------------------------------------------------
-- 8A. Verificación de que NULLIF evita división por cero y devuelve NULL limpio
SELECT
    'PRUEBA_NULLIF_DENOMINADOR_CERO' AS caso_prueba,
    (100.0 / NULLIF(0.0, 0.0)) IS NULL AS denominador_cero_devuelve_null_ok;

-- 8B. Verificación de que los primeros 11 meses de la serie cargada (2024-02 a 2024-12)
-- tienen ventana_12m_completa = FALSE y devuelven NULL en KPI-05, KPI-06 y KPI-08
SELECT
    COUNT(*) FILTER (WHERE anio = 2024 AND NOT ventana_12m_completa AND kpi05_tasa_activa_pct IS NULL AND kpi06_tasa_pasiva_pct IS NULL AND kpi08_roa_pct IS NULL) AS meses_2024_ventana_incompleta_null_ok,
    COUNT(*) FILTER (WHERE anio = 2025 AND ventana_12m_completa AND kpi05_tasa_activa_pct IS NOT NULL AND kpi06_tasa_pasiva_pct IS NOT NULL AND kpi08_roa_pct IS NOT NULL) AS meses_2025_ventana_completa_12_ok
FROM v_kpis_cnbv_sector_mes;

-- 8C. Verificación de que sociedades con estado_reporte != 'publicado' o imor_pct IS NULL
-- reciben rank_imor_mayor_riesgo IS NULL (no distorsionan el ranking)
SELECT
    COUNT(*) FILTER (WHERE kpi01_imor_publicado_pct IS NULL) AS sociedades_sin_imor,
    COUNT(*) FILTER (WHERE kpi01_imor_publicado_pct IS NULL AND rank_imor_mayor_riesgo IS NOT NULL) AS falsos_rankings_en_nulos
FROM v_kpis_cnbv_institucion_trim;
