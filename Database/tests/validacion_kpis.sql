-- =============================================================================
-- Fase IV — Paso 17: Suite ASERTIVA de validación y exactitud de KPIs
-- Archivo: Database/tests/validacion_kpis.sql
-- Motor: PostgreSQL 15+
-- Dependencia: carga real de hechos y vistas Database/views/01_vistas.sql,
--              Database/views/02_kpis.sql.
--
-- Ejecución en Windows (sin psql local):
--   .\.venv\Scripts\python.exe scripts\run_sql_docker.py Database/tests/validacion_kpis.sql
--
-- Diferencia respecto a la versión anterior: ya NO imprime 'REVISAR_DIFERENCIA'
-- ni 'SIN_DATOS_EN_BD' como resultado aceptable. Cada bloque lanza
-- RAISE EXCEPTION si falta una fila o si una diferencia excede la tolerancia.
-- La suite corre en una transacción: un fallo no altera la base.
-- =============================================================================

BEGIN;
SET LOCAL search_path = public, pg_catalog;
SELECT pg_advisory_xact_lock(81370611);

DO $$
BEGIN
    IF current_database() <> 'dashboard_caja_ahorro' OR current_user <> 'dashboard_user' THEN
        RAISE EXCEPTION 'Destino no autorizado para pruebas de KPIs';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 1: instantánea activa y recuentos base
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    id bigint;
    n bigint;
BEGIN
    SELECT ejecucion_id INTO id FROM v_ejecucion_activa;
    IF id IS NULL THEN
        RAISE EXCEPTION 'SIN_DATOS_EN_BD: no hay ejecución exitosa activa';
    END IF;
    SELECT count(*) INTO n FROM hecho_cnbv_sector_mes WHERE ejecucion_id = id;
    IF n <> 598 THEN RAISE EXCEPTION 'Recuento sector_mes: esperado 598, obtenido %', n; END IF;
    SELECT count(*) INTO n FROM hecho_cnbv_institucion_trim WHERE ejecucion_id = id;
    IF n <> 620 THEN RAISE EXCEPTION 'Recuento institucion_trim: esperado 620, obtenido %', n; END IF;
    SELECT count(*) INTO n FROM hecho_cnbv_total_trim WHERE ejecucion_id = id;
    IF n <> 4 THEN RAISE EXCEPTION 'Recuento total_trim: esperado 4, obtenido %', n; END IF;
    SELECT count(*) INTO n FROM hecho_fonacot_mes WHERE ejecucion_id = id;
    IF n <> 792 THEN RAISE EXCEPTION 'Recuento fonacot_mes: esperado 792, obtenido %', n; END IF;
    SELECT count(*) INTO n FROM hecho_sniiv_mes WHERE ejecucion_id = id;
    IF n <> 325649 THEN RAISE EXCEPTION 'Recuento sniiv_mes: esperado 325649, obtenido %', n; END IF;
    RAISE NOTICE 'BLOQUE 1 OK: instantánea % — 598/620/4/792/325649', id;
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 2: matriz sectorial CNBV (2025-03 y 2025-12)
-- KPI-01..09 y M-01. Cálculo vs catálogo: <= 1e-9 pp.
-- Cálculo vs fila publicada en Series: <= 5e-7 pp (numeric(20,6) en la fuente).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
    max_catalogo numeric := 0;
    max_publicado numeric := 0;
BEGIN
    FOR r IN
        WITH esperados(periodo_ym, kpi_id, valor, con_publicado) AS (
            VALUES
            ('2025-03', 'KPI-01', 4.2361948375::numeric, true),
            ('2025-03', 'KPI-02', 125.5267605593::numeric, true),
            ('2025-03', 'KPI-03', 37.6929816952::numeric, true),
            ('2025-03', 'KPI-04', 306.5197159872::numeric, true),
            ('2025-03', 'KPI-05', 18.1688146566::numeric, true),
            ('2025-03', 'KPI-06', 5.8022194344::numeric, true),
            ('2025-03', 'KPI-07', 18.0284996299::numeric, true),
            ('2025-03', 'KPI-08', 2.5445223519::numeric, true),
            ('2025-03', 'KPI-09', 68.8889316436::numeric, false),
            ('2025-03', 'M-01',   54.1876615945::numeric, false),
            ('2025-12', 'KPI-01', 4.0549697085::numeric, true),
            ('2025-12', 'KPI-02', 127.5907268062::numeric, true),
            ('2025-12', 'KPI-03', 35.6261802328::numeric, true),
            ('2025-12', 'KPI-04', 300.2533349855::numeric, true),
            ('2025-12', 'KPI-05', 18.2304798424::numeric, true),
            ('2025-12', 'KPI-06', 5.2719823640::numeric, true),
            ('2025-12', 'KPI-07', 17.8527845893::numeric, true),
            ('2025-12', 'KPI-08', 2.1536581163::numeric, true),
            ('2025-12', 'KPI-09', 69.2030772470::numeric, false),
            ('2025-12', 'M-01',   54.2112064685::numeric, false)
        ),
        observados AS (
            SELECT periodo_ym, 'KPI-01'::text AS kpi_id, kpi01_imor_pct AS calc,
                   kpi01_imor_publicado_pct AS pub FROM v_kpis_cnbv_sector_mes
            UNION ALL SELECT periodo_ym, 'KPI-02', kpi02_icor_pct, kpi02_icor_publicado_pct FROM v_kpis_cnbv_sector_mes
            UNION ALL SELECT periodo_ym, 'KPI-03', kpi03_liquidez_pct, kpi03_liquidez_publicado_pct FROM v_kpis_cnbv_sector_mes
            UNION ALL SELECT periodo_ym, 'KPI-04', kpi04_nicap_pct, kpi04_nicap_publicado_pct FROM v_kpis_cnbv_sector_mes
            UNION ALL SELECT periodo_ym, 'KPI-05', kpi05_tasa_activa_pct, kpi05_tasa_activa_publicada_pct FROM v_kpis_cnbv_sector_mes
            UNION ALL SELECT periodo_ym, 'KPI-06', kpi06_tasa_pasiva_pct, kpi06_tasa_pasiva_publicada_pct FROM v_kpis_cnbv_sector_mes
            UNION ALL SELECT periodo_ym, 'KPI-07', kpi07_capital_activo_pct, kpi07_capital_activo_publicado_pct FROM v_kpis_cnbv_sector_mes
            UNION ALL SELECT periodo_ym, 'KPI-08', kpi08_roa_pct, kpi08_roa_publicado_pct FROM v_kpis_cnbv_sector_mes
            UNION ALL SELECT periodo_ym, 'KPI-09', kpi09_colocacion_captacion_trad_pct, NULL::numeric FROM v_kpis_cnbv_sector_mes
            UNION ALL SELECT periodo_ym, 'M-01', m01_participacion_femenina_socios_pct, NULL::numeric FROM v_kpis_cnbv_sector_mes
        )
        SELECT e.periodo_ym, e.kpi_id, e.valor, e.con_publicado, o.calc, o.pub
        FROM esperados e
        LEFT JOIN observados o ON o.periodo_ym = e.periodo_ym AND o.kpi_id = e.kpi_id
        ORDER BY e.periodo_ym, e.kpi_id
    LOOP
        IF r.calc IS NULL THEN
            RAISE EXCEPTION 'SIN_DATOS_EN_BD: %/%', r.periodo_ym, r.kpi_id;
        END IF;
        max_catalogo := greatest(max_catalogo, abs(r.calc - r.valor));
        IF abs(r.calc - r.valor) > 1e-9 THEN
            RAISE EXCEPTION '%/% catálogo % vs SQL % (diff % pp)',
                r.periodo_ym, r.kpi_id, r.valor, r.calc, abs(r.calc - r.valor);
        END IF;
        IF r.con_publicado THEN
            IF r.pub IS NULL THEN
                RAISE EXCEPTION 'SIN_DATOS_EN_BD: %/% fila publicada en Series', r.periodo_ym, r.kpi_id;
            END IF;
            max_publicado := greatest(max_publicado, abs(r.calc - r.pub));
            IF abs(r.calc - r.pub) > 5e-7 THEN
                RAISE EXCEPTION '%/% Series % vs SQL % (diff % pp)',
                    r.periodo_ym, r.kpi_id, r.pub, r.calc, abs(r.calc - r.pub);
            END IF;
        END IF;
        RAISE NOTICE '% % — SQL % | catálogo % | Series %',
            r.periodo_ym, r.kpi_id,
            r.calc, r.valor, coalesce(r.pub::text, 'elaboración propia');
    END LOOP;
    RAISE NOTICE 'BLOQUE 2 OK: 20 casos; max diff catálogo % pp, max diff Series % pp',
        max_catalogo, max_publicado;
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 3: denominadores promediados de 12 meses en 2025-03 y 2025-12
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
    max_diff numeric := 0;
    n bigint;
BEGIN
    SELECT count(*) INTO n FROM v_kpis_cnbv_sector_mes
    WHERE anio = 2025 AND NOT ventana_12m_completa;
    IF n <> 0 THEN RAISE EXCEPTION '% cortes de 2025 con ventana incompleta', n; END IF;

    FOR r IN
        WITH esperados(periodo_ym, v013, v035, v005) AS (
            VALUES
            ('2025-03', 154141597205.166667::numeric, 219038275966.916667::numeric, 278842081529.583333::numeric),
            ('2025-12', 167139479473.083333::numeric, 241771565852.500000::numeric, 305801657665.000000::numeric)
        )
        SELECT e.*, o.ventana_12m_completa, o.prom12_cartera_vigente_mxn AS obs013,
               o.prom12_captacion_tradicional_mxn AS obs035, o.prom12_activo_total_mxn AS obs005,
               o.intereses_cartera_vig_12m_mxn AS num05, o.gastos_intereses_12m_mxn AS num06,
               o.resultado_neto_12m_mxn AS num08
        FROM esperados e
        LEFT JOIN v_kpis_cnbv_sector_mes o ON o.periodo_ym = e.periodo_ym
    LOOP
        IF NOT r.ventana_12m_completa OR r.obs013 IS NULL OR r.obs035 IS NULL OR r.obs005 IS NULL
           OR r.num05 IS NULL OR r.num06 IS NULL OR r.num08 IS NULL THEN
            RAISE EXCEPTION 'SIN_DATOS_EN_BD: prom12 o numeradores de 12m en %', r.periodo_ym;
        END IF;
        max_diff := greatest(max_diff, abs(r.obs013 - r.v013), abs(r.obs035 - r.v035), abs(r.obs005 - r.v005));
        IF abs(r.obs013 - r.v013) > 1e-6 OR abs(r.obs035 - r.v035) > 1e-6
           OR abs(r.obs005 - r.v005) > 1e-6 THEN
            RAISE EXCEPTION '% prom12 fuera de tolerancia: %/%/% vs %/%/%',
                r.periodo_ym, r.obs013, r.obs035, r.obs005, r.v013, r.v035, r.v005;
        END IF;
        RAISE NOTICE '% prom12(13) % | prom12(35) % | prom12(5) % | numeradores %/%/%',
            r.periodo_ym, r.obs013, r.obs035, r.obs005, r.num05, r.num06, r.num08;
    END LOOP;
    RAISE NOTICE 'BLOQUE 3 OK: ventanas consecutivas; max diff % MXN', max_diff;
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 4: caso de control institucional Caja Popular Mexicana (029056)
-- Saldos exactos; publicados a 1e-8 pp; derivados a 1e-8 pp por redondeo.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
    max_derivado numeric := 0;
BEGIN
    FOR r IN
        WITH esperados(
            periodo_ym, socios, activo, disp, vigente, vencida, estimacion,
            imor, nicap, categoria, m02, colocacion, icor
        ) AS (
            VALUES
            ('2025-03', 3692848::bigint,
             114228216874.000000::numeric, 1739002836.000000::numeric,
             58779416190.000000::numeric, 1946111129.000000::numeric,
             -2902114622.000000::numeric,
             3.2047661254::numeric, 252.3931729344::numeric, '1'::text,
             38.7596208040::numeric, 61.5092339937::numeric, 149.1237873698::numeric),
            ('2025-12', 3873780::bigint,
             126888191520.000000::numeric, 1481021783.000000::numeric,
             67171203942.000000::numeric, 1943667351.000000::numeric,
             -3089756405.000000::numeric,
             2.8122274044::numeric, 235.6833561551::numeric, '1'::text,
             39.4283734536::numeric, 62.9331980237::numeric, 158.9652881365::numeric)
        )
        SELECT e.*, o.institucion_nombre, o.socios AS obs_socios, o.activo_mxn AS obs_activo,
               o.disponibilidades_mxn AS obs_disp, o.cartera_vigente_mxn AS obs_vigente,
               o.cartera_vencida_mxn AS obs_vencida, o.estimacion_mxn AS obs_estimacion,
               o.kpi01_imor_publicado_pct AS obs_imor_pub, o.kpi01_imor_recalculado_pct AS obs_imor_calc,
               o.kpi04_nicap_publicado_pct AS obs_nicap, o.kpi04_categoria_nicap AS obs_categoria,
               o.m02_participacion_activo_publicada_pct AS obs_m02_pub,
               o.m02_participacion_activo_recalculada_pct AS obs_m02_calc,
               o.kpi09_colocacion_captacion_total_derivado_pct AS obs_colocacion,
               o.kpi02_icor_derivado_pct AS obs_icor
        FROM esperados e
        LEFT JOIN v_kpis_cnbv_institucion_trim o
          ON o.periodo_ym = e.periodo_ym AND o.clave_seis = '029056'
    LOOP
        IF r.institucion_nombre IS NULL OR r.obs_imor_pub IS NULL OR r.obs_imor_calc IS NULL
           OR r.obs_nicap IS NULL OR r.obs_categoria IS NULL OR r.obs_m02_pub IS NULL
           OR r.obs_m02_calc IS NULL OR r.obs_colocacion IS NULL OR r.obs_icor IS NULL THEN
            RAISE EXCEPTION 'SIN_DATOS_EN_BD: CPM %', r.periodo_ym;
        END IF;
        IF r.obs_socios IS DISTINCT FROM r.socios
           OR r.obs_activo IS DISTINCT FROM r.activo
           OR r.obs_disp IS DISTINCT FROM r.disp
           OR r.obs_vigente IS DISTINCT FROM r.vigente
           OR r.obs_vencida IS DISTINCT FROM r.vencida
           OR r.obs_estimacion IS DISTINCT FROM r.estimacion THEN
            RAISE EXCEPTION '% CPM saldos/socios distintos', r.periodo_ym;
        END IF;
        max_derivado := greatest(
            max_derivado,
            abs(r.obs_imor_pub - r.imor), abs(r.obs_imor_calc - r.imor),
            abs(r.obs_nicap - r.nicap), abs(r.obs_m02_pub - r.m02),
            abs(r.obs_m02_calc - r.m02), abs(r.obs_colocacion - r.colocacion),
            abs(r.obs_icor - r.icor));
        IF max_derivado > 1e-8 OR r.obs_categoria <> r.categoria THEN
            RAISE EXCEPTION '% CPM fuera de tolerancia: IMOR %/%, NICAP %, cat %, M-02 %/%, coloc %, ICOR %',
                r.periodo_ym, r.obs_imor_pub, r.obs_imor_calc, r.obs_nicap, r.obs_categoria,
                r.obs_m02_pub, r.obs_m02_calc, r.obs_colocacion, r.obs_icor;
        END IF;
        RAISE NOTICE '% CPM — socios % | activo % | IMOR % | NICAP %/cat % | M-02 % | coloc % | ICOR %',
            r.periodo_ym, r.obs_socios, r.obs_activo, r.obs_imor_pub,
            r.obs_nicap, r.obs_categoria, r.obs_m02_pub, r.obs_colocacion, r.obs_icor;
    END LOOP;
    RAISE NOTICE 'BLOQUE 4 OK: CPM Q1/Q4; max diff derivados % pp', max_derivado;
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 5: contraste oficial documentado (Series vs boletines)
-- Se verifican 4 cortes, etiquetas con año y conciliación boletín ↔ Σ sociedades.
-- Las diferencias entre fuentes se reportan, no se corrigen.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
    n bigint;
BEGIN
    SELECT count(*) INTO n FROM v_kpis_cnbv_contraste_trim;
    IF n <> 4 THEN RAISE EXCEPTION 'SIN_DATOS_EN_BD: contraste trimestral con % filas', n; END IF;
    FOR r IN
        SELECT c.periodo_ym, c.trimestre, c.series_activo_total_mxn, c.boletin_activo_total_mxn,
               (SELECT sum(i.activo_mxn) FROM hecho_cnbv_institucion_trim i
                WHERE i.ejecucion_id = c.ejecucion_id AND i.mes_id = c.mes_id) AS suma_instituciones,
               c.diff_imor_pp, c.diff_icor_pp, c.diff_nicap_pp, c.diff_roa_pp
        FROM v_kpis_cnbv_contraste_trim c
        ORDER BY c.mes_id
    LOOP
        IF r.trimestre !~ '^2025-Q[1-4]$' THEN
            RAISE EXCEPTION 'Etiqueta trimestral sin año: %', r.trimestre;
        END IF;
        IF r.series_activo_total_mxn IS NULL OR r.boletin_activo_total_mxn IS NULL
           OR r.suma_instituciones IS NULL OR r.diff_imor_pp IS NULL
           OR r.diff_icor_pp IS NULL OR r.diff_nicap_pp IS NULL OR r.diff_roa_pp IS NULL THEN
            RAISE EXCEPTION 'SIN_DATOS_EN_BD: contraste %', r.trimestre;
        END IF;
        IF abs(r.boletin_activo_total_mxn - r.suma_instituciones) > 1 THEN
            RAISE EXCEPTION '% boletín % vs Σ sociedades %', r.trimestre,
                r.boletin_activo_total_mxn, r.suma_instituciones;
        END IF;
        RAISE NOTICE '% % — activo Series % | boletín % | Σ sociedades % | diffs IMOR/ICOR/NICAP/ROA %/%/%/% pp',
            r.periodo_ym, r.trimestre, r.series_activo_total_mxn, r.boletin_activo_total_mxn,
            r.suma_instituciones, r.diff_imor_pp, r.diff_icor_pp, r.diff_nicap_pp, r.diff_roa_pp;
    END LOOP;
    RAISE NOTICE 'BLOQUE 5 OK: discrepancias oficiales conservadas y documentadas';
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 6: M-03 FONACOT (cuatro trimestres 2025 + Aguascalientes + APP MOVIL)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
    n bigint;
BEGIN
    FOR r IN
        WITH esperados(trimestre, creditos, monto, part, ticket) AS (
            VALUES
            ('2025-Q1', 503416::bigint, 15525525836.550000::numeric, 40.9694964006::numeric, 30840.350399::numeric),
            ('2025-Q2', 510842::bigint, 15838163285.810000::numeric, 42.2077667850::numeric, 31004.035075::numeric),
            ('2025-Q3', 601649::bigint, 18517548812.570000::numeric, 41.8039421656::numeric, 30777.993170::numeric),
            ('2025-Q4', 561561::bigint, 16889088475.450000::numeric, 41.8268006503::numeric, 30075.251799::numeric)
        )
        SELECT e.*, o.creditos_totales_nacional AS obs_creditos,
               o.monto_total_nacional_mxn AS obs_monto,
               o.m03_participacion_femenina_creditos_pct AS obs_part,
               o.m03_ticket_promedio_nacional_mxn AS obs_ticket,
               o.creditos_solo_entidades, o.creditos_canal_app_movil
        FROM esperados e
        LEFT JOIN v_kpis_fonacot_trim_resumen o ON o.trimestre = e.trimestre AND o.anio = 2025
    LOOP
        IF r.obs_creditos IS NULL OR r.obs_monto IS NULL OR r.obs_part IS NULL OR r.obs_ticket IS NULL THEN
            RAISE EXCEPTION 'SIN_DATOS_EN_BD: FONACOT %', r.trimestre;
        END IF;
        IF r.obs_creditos <> r.creditos OR abs(r.obs_monto - r.monto) > 1e-6
           OR abs(r.obs_part - r.part) > 1e-10 OR abs(r.obs_ticket - r.ticket) > 1e-6
           OR (r.creditos_solo_entidades + r.creditos_canal_app_movil) IS DISTINCT FROM r.obs_creditos THEN
            RAISE EXCEPTION '% FONACOT fuera de tolerancia: créditos %, monto %, part %, ticket %, entidades+APP %/%',
                r.trimestre, r.obs_creditos, r.obs_monto, r.obs_part, r.obs_ticket,
                r.creditos_solo_entidades, r.creditos_canal_app_movil;
        END IF;
        RAISE NOTICE '% FONACOT — créditos % | monto % | mujeres % | ticket % | entidades % + APP %',
            r.trimestre, r.obs_creditos, r.obs_monto, r.obs_part, r.obs_ticket,
            r.creditos_solo_entidades, r.creditos_canal_app_movil;
    END LOOP;

    SELECT count(*) INTO n
    FROM v_fonacot_mes_base
    WHERE periodo_ym = '2025-01' AND ambito_canonico = 'AGUASCALIENTES' AND genero = 'mujeres'
      AND creditos = 1326 AND monto_mxn = 32050929.750000;
    IF n <> 1 THEN
        RAISE EXCEPTION 'Caso Aguascalientes 2025-01/mujeres: % filas coincidentes (esperada 1)', n;
    END IF;
    RAISE NOTICE 'BLOQUE 6 OK: FONACOT 4 trimestres, Aguascalientes y APP MOVIL separado';
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 7: M-04 SNIIV 2025
-- Participaciones corregidas con base en los importes reales cargados:
-- 452,066 / 998,741 = 45.2635868559 % (acciones)
-- monto mujeres / monto con sexo = 40.2307278633 %
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
BEGIN
    SELECT * INTO r FROM v_kpis_sniiv_anual_resumen WHERE anio = 2025;
    IF NOT FOUND THEN RAISE EXCEPTION 'SIN_DATOS_EN_BD: resumen SNIIV 2025'; END IF;

    IF r.total_registros_csv <> 325649 OR r.m04_acciones_totales <> 998745
       OR r.acciones_mujeres <> 452066 OR r.acciones_hombres <> 546675
       OR r.acciones_con_sexo_definido <> 998741 OR r.acciones_sin_sexo <> 4
       OR r.filas_sin_sexo <> 399 OR r.acciones_infonavit <> 666957 THEN
        RAISE EXCEPTION 'SNIIV conteos: filas %, acciones %, mujeres %, hombres %, sin sexo %/%',
            r.total_registros_csv, r.m04_acciones_totales, r.acciones_mujeres,
            r.acciones_hombres, r.filas_sin_sexo, r.acciones_sin_sexo;
    END IF;
    IF abs(r.m04_monto_total_mxn - 617246458236.390000) > 1e-6
       OR abs(r.m04_promedio_por_accion_mxn - 618022.075942) > 1e-6
       OR abs(r.monto_sin_sexo_mxn - 265488266.350000) > 1e-6
       OR abs(r.monto_mujeres_mxn - 248215934996.930000) > 1e-6
       OR abs(r.monto_hombres_mxn - 368765034973.110000) > 1e-6 THEN
        RAISE EXCEPTION 'SNIIV importes fuera de tolerancia: total %, promedio %, sin sexo %',
            r.m04_monto_total_mxn, r.m04_promedio_por_accion_mxn, r.monto_sin_sexo_mxn;
    END IF;
    IF abs(r.m04_participacion_mujeres_acciones_pct - 45.2635868559) > 1e-10
       OR abs(r.m04_participacion_mujeres_monto_pct - 40.2307278633) > 1e-10
       OR abs(r.m04_participacion_infonavit_acciones_pct - 66.7795082829) > 1e-10 THEN
        RAISE EXCEPTION 'SNIIV participaciones: acciones %, monto %, INFONAVIT % (valores corregidos)',
            r.m04_participacion_mujeres_acciones_pct,
            r.m04_participacion_mujeres_monto_pct,
            r.m04_participacion_infonavit_acciones_pct;
    END IF;
    RAISE NOTICE 'BLOQUE 7 OK: SNIIV — % filas, % acciones, mujeres %/% (participacion % pp), monto %, INFONAVIT % pp',
        r.total_registros_csv, r.m04_acciones_totales, r.acciones_mujeres,
        r.acciones_con_sexo_definido, r.m04_participacion_mujeres_acciones_pct,
        r.m04_monto_total_mxn, r.m04_participacion_infonavit_acciones_pct;
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 8: pruebas de casos borde (NULLIF, ventanas <12m y nulos en rankings)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    n bigint;
    ok boolean;
BEGIN
    SELECT (100.0 / NULLIF(0.0, 0.0)) IS NULL INTO ok;
    IF NOT ok THEN RAISE EXCEPTION 'PRUEBA_NULLIF_DENOMINADOR_CERO falló'; END IF;

    SELECT count(*) INTO n
    FROM v_kpis_cnbv_sector_mes
    WHERE NOT ventana_12m_completa
      AND (kpi05_tasa_activa_pct IS NOT NULL OR kpi06_tasa_pasiva_pct IS NOT NULL
           OR kpi08_roa_pct IS NOT NULL);
    IF n > 0 THEN RAISE EXCEPTION '% cortes incompletos con KPI de 12m no nulo', n; END IF;

    SELECT count(*) INTO n
    FROM v_kpis_cnbv_institucion_trim
    WHERE kpi01_imor_publicado_pct IS NULL AND rank_imor_mayor_riesgo IS NOT NULL;
    IF n > 0 THEN RAISE EXCEPTION '% falsos rankings en sociedades con IMOR nulo', n; END IF;

    RAISE NOTICE 'BLOQUE 8 OK: NULLIF, ventanas y rankings sin nulos';
END $$;

SELECT 'VALIDACION_KPIS_ASERTIVA_OK' AS resultado,
       (SELECT ejecucion_id FROM v_ejecucion_activa) AS ejecucion_activa,
       now() AS validada_en;

COMMIT;
