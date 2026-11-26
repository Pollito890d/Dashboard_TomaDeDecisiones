-- =============================================================================
-- Fase IV — Paso 17: Validación atómica de la integración y los KPIs
-- Archivo: Database/04_validation.sql
-- Motor: PostgreSQL 15+
-- Dependencia: Database/01_schema.sql, catálogos, carga de hechos y vistas
--              (Database/views/01_vistas.sql y Database/views/02_kpis.sql).
--
-- Ejecución en Windows (sin psql local):
--   .\.venv\Scripts\python.exe scripts\run_sql_docker.py Database/04_validation.sql
--
-- Criterio: TODO bloque falla con RAISE EXCEPTION si faltan datos o si hay
-- diferencias fuera de tolerancia. Todo el archivo corre en una transacción;
-- una validación fallida no deja cambios. El ÚNICO INSERT permanente es
-- pg_advisory_xact_lock: no se modifican tablas de hechos ni catálogos.
-- =============================================================================

BEGIN;
SET LOCAL search_path = public, pg_catalog;
SELECT pg_advisory_xact_lock(81370609);

DO $$
BEGIN
    IF current_database() <> 'dashboard_caja_ahorro' OR current_user <> 'dashboard_user' THEN
        RAISE EXCEPTION 'Destino no autorizado para validación';
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 1: instantánea activa y recuentos exactos de las cinco tablas de hechos
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    id bigint;
    n bigint;
BEGIN
    SELECT ejecucion_id INTO id FROM v_ejecucion_activa;
    IF id IS NULL THEN
        RAISE EXCEPTION 'No existe ejecución exitosa activa: no se valida una base vacía';
    END IF;

    SELECT count(*) INTO n FROM hecho_cnbv_sector_mes WHERE ejecucion_id = id;
    IF n <> 598 THEN
        RAISE EXCEPTION 'hecho_cnbv_sector_mes: esperadas 598 filas, obtenidas %', n;
    END IF;
    SELECT count(*) INTO n FROM hecho_cnbv_institucion_trim WHERE ejecucion_id = id;
    IF n <> 620 THEN
        RAISE EXCEPTION 'hecho_cnbv_institucion_trim: esperadas 620 filas, obtenidas %', n;
    END IF;
    SELECT count(*) INTO n FROM hecho_cnbv_total_trim WHERE ejecucion_id = id;
    IF n <> 4 THEN
        RAISE EXCEPTION 'hecho_cnbv_total_trim: esperadas 4 filas, obtenidas %', n;
    END IF;
    SELECT count(*) INTO n FROM hecho_fonacot_mes WHERE ejecucion_id = id;
    IF n <> 792 THEN
        RAISE EXCEPTION 'hecho_fonacot_mes: esperadas 792 filas, obtenidas %', n;
    END IF;
    SELECT count(*) INTO n FROM hecho_sniiv_mes WHERE ejecucion_id = id;
    IF n <> 325649 THEN
        RAISE EXCEPTION 'hecho_sniiv_mes: esperadas 325649 filas, obtenidas %', n;
    END IF;

    RAISE NOTICE 'BLOQUE 1 OK: ejecución % (598/620/4/792/325649)', id;
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 2: FK resueltas, nulos inadmisibles y unicidad por grano
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    id bigint;
    n bigint;
BEGIN
    SELECT ejecucion_id INTO id FROM v_ejecucion_activa;

    SELECT count(*) INTO n
    FROM hecho_cnbv_sector_mes h
    LEFT JOIN dim_mes m ON m.mes_id = h.mes_id
    LEFT JOIN dim_concepto_cnbv c ON c.concepto_id = h.concepto_id AND c.archivo_id = h.archivo_id
    LEFT JOIN ejecucion_archivo ea ON ea.ejecucion_id = h.ejecucion_id AND ea.archivo_id = h.archivo_id
    WHERE h.ejecucion_id = id AND (m.mes_id IS NULL OR c.concepto_id IS NULL OR ea.archivo_id IS NULL);
    IF n > 0 THEN
        RAISE EXCEPTION 'CNBV sector: % filas con FK o trazabilidad sin resolver', n;
    END IF;

    SELECT count(*) INTO n
    FROM hecho_cnbv_institucion_trim h
    LEFT JOIN dim_mes m ON m.mes_id = h.mes_id
    LEFT JOIN dim_institucion i ON i.institucion_id = h.institucion_id
    LEFT JOIN ejecucion_archivo ea ON ea.ejecucion_id = h.ejecucion_id AND ea.archivo_id = h.archivo_id
    WHERE h.ejecucion_id = id AND (m.mes_id IS NULL OR i.institucion_id IS NULL OR ea.archivo_id IS NULL);
    IF n > 0 THEN
        RAISE EXCEPTION 'CNBV institución: % filas con FK o trazabilidad sin resolver', n;
    END IF;

    SELECT count(*) INTO n
    FROM hecho_cnbv_total_trim h
    LEFT JOIN dim_mes m ON m.mes_id = h.mes_id
    LEFT JOIN ejecucion_archivo ea ON ea.ejecucion_id = h.ejecucion_id AND ea.archivo_id = h.archivo_id
    WHERE h.ejecucion_id = id AND (m.mes_id IS NULL OR ea.archivo_id IS NULL);
    IF n > 0 THEN
        RAISE EXCEPTION 'CNBV total trimestral: % filas con FK o trazabilidad sin resolver', n;
    END IF;

    SELECT count(*) INTO n
    FROM hecho_fonacot_mes h
    LEFT JOIN dim_mes m ON m.mes_id = h.mes_id
    LEFT JOIN dim_ambito_fonacot a ON a.ambito_id = h.ambito_id
    LEFT JOIN dim_genero_fonacot g ON g.genero_id = h.genero_id
    LEFT JOIN ejecucion_archivo ec ON ec.ejecucion_id = h.ejecucion_id AND ec.archivo_id = h.archivo_creditos_id
    LEFT JOIN ejecucion_archivo em ON em.ejecucion_id = h.ejecucion_id AND em.archivo_id = h.archivo_monto_id
    WHERE h.ejecucion_id = id
      AND (m.mes_id IS NULL OR a.ambito_id IS NULL OR g.genero_id IS NULL
           OR (h.archivo_creditos_id IS NOT NULL AND ec.archivo_id IS NULL)
           OR (h.archivo_monto_id IS NOT NULL AND em.archivo_id IS NULL));
    IF n > 0 THEN
        RAISE EXCEPTION 'FONACOT: % filas con FK o trazabilidad sin resolver', n;
    END IF;

    SELECT count(*) INTO n
    FROM hecho_sniiv_mes h
    LEFT JOIN dim_mes m ON m.mes_id = h.mes_id
    LEFT JOIN ejecucion_archivo ea ON ea.ejecucion_id = h.ejecucion_id AND ea.archivo_id = h.archivo_id
    WHERE h.ejecucion_id = id AND (m.mes_id IS NULL OR ea.archivo_id IS NULL);
    IF n > 0 THEN
        RAISE EXCEPTION 'SNIIV: % filas con FK o trazabilidad sin resolver', n;
    END IF;

    SELECT count(*) INTO n FROM (
        SELECT 1 FROM hecho_cnbv_sector_mes WHERE ejecucion_id = id
        GROUP BY ejecucion_id, mes_id, concepto_id HAVING count(*) > 1) q;
    IF n > 0 THEN RAISE EXCEPTION 'CNBV sector: % granos duplicados', n; END IF;
    SELECT count(*) INTO n FROM (
        SELECT 1 FROM hecho_cnbv_institucion_trim WHERE ejecucion_id = id
        GROUP BY ejecucion_id, mes_id, institucion_id HAVING count(*) > 1) q;
    IF n > 0 THEN RAISE EXCEPTION 'CNBV institución: % granos duplicados', n; END IF;
    SELECT count(*) INTO n FROM (
        SELECT 1 FROM hecho_cnbv_total_trim WHERE ejecucion_id = id
        GROUP BY ejecucion_id, mes_id HAVING count(*) > 1) q;
    IF n > 0 THEN RAISE EXCEPTION 'CNBV total: % granos duplicados', n; END IF;
    SELECT count(*) INTO n FROM (
        SELECT 1 FROM hecho_fonacot_mes WHERE ejecucion_id = id
        GROUP BY ejecucion_id, mes_id, ambito_id, genero_id HAVING count(*) > 1) q;
    IF n > 0 THEN RAISE EXCEPTION 'FONACOT: % granos duplicados', n; END IF;
    SELECT count(*) INTO n FROM (
        SELECT 1 FROM hecho_sniiv_mes WHERE ejecucion_id = id
        GROUP BY ejecucion_id, mes_id, cve_ent, cve_mun, organismo, modalidad, destino,
                 tipo, sexo, edad_rango, ingresos_rango, vivienda_valor HAVING count(*) > 1) q;
    IF n > 0 THEN RAISE EXCEPTION 'SNIIV: % granos duplicados', n; END IF;

    RAISE NOTICE 'BLOQUE 2 OK: FK, trazabilidad y unicidad sin violaciones';
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 3: KPI-01..09 y M-01 en 2025-03 y 2025-12.
-- Tolerancias: 1e-9 pp contra el catálogo (cálculo SQL) y 5e-7 pp contra la
-- fila publicada en Series (almacenada con numeric(20,6)).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
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
            RAISE EXCEPTION '%/% sin datos en la instantánea activa', r.periodo_ym, r.kpi_id;
        END IF;
        IF abs(r.calc - r.valor) > 1e-9 THEN
            RAISE EXCEPTION '%/% vs catálogo: esperado %, obtenido % (diff % pp)',
                r.periodo_ym, r.kpi_id, r.valor, r.calc, abs(r.calc - r.valor);
        END IF;
        IF r.con_publicado AND r.pub IS NULL THEN
            RAISE EXCEPTION '%/% sin fila publicada en Series', r.periodo_ym, r.kpi_id;
        END IF;
        IF r.con_publicado AND abs(r.calc - r.pub) > 5e-7 THEN
            RAISE EXCEPTION '%/% vs Series: publicado %, calculado % (diff % pp)',
                r.periodo_ym, r.kpi_id, r.pub, r.calc, abs(r.calc - r.pub);
        END IF;
    END LOOP;

    RAISE NOTICE 'BLOQUE 3 OK: 20 casos KPI-01..09 y M-01 (1e-9 pp catálogo / 5e-7 pp Series)';
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 4: denominadores promediados de 12 saldos consecutivos (KPI-05/-06/-08)
-- Tolerancia 1e-6 MXN por la escala numeric(30,6) de los saldos cargados.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
    n bigint;
BEGIN
    SELECT count(*) INTO n FROM v_kpis_cnbv_sector_mes
    WHERE anio = 2025 AND NOT ventana_12m_completa;
    IF n <> 0 THEN
        RAISE EXCEPTION '% cortes de 2025 no tienen ventana de 12 meses consecutivos', n;
    END IF;

    FOR r IN
        WITH esperados(periodo_ym, v013, v035, v005) AS (
            VALUES
            ('2025-03', 154141597205.166667::numeric, 219038275966.916667::numeric, 278842081529.583333::numeric),
            ('2025-12', 167139479473.083333::numeric, 241771565852.500000::numeric, 305801657665.000000::numeric)
        )
        SELECT e.*, o.ventana_12m_completa, o.prom12_cartera_vigente_mxn,
               o.prom12_captacion_tradicional_mxn, o.prom12_activo_total_mxn
        FROM esperados e
        LEFT JOIN v_kpis_cnbv_sector_mes o ON o.periodo_ym = e.periodo_ym
    LOOP
        IF NOT r.ventana_12m_completa
           OR r.prom12_cartera_vigente_mxn IS NULL
           OR r.prom12_captacion_tradicional_mxn IS NULL
           OR r.prom12_activo_total_mxn IS NULL THEN
            RAISE EXCEPTION '% sin ventana 12m completa o con prom12 nulo', r.periodo_ym;
        END IF;
        IF abs(r.prom12_cartera_vigente_mxn - r.v013) > 1e-6
           OR abs(r.prom12_captacion_tradicional_mxn - r.v035) > 1e-6
           OR abs(r.prom12_activo_total_mxn - r.v005) > 1e-6 THEN
            RAISE EXCEPTION '% prom12 fuera de tolerancia: obtenidos %/%/%',
                r.periodo_ym, r.prom12_cartera_vigente_mxn,
                r.prom12_captacion_tradicional_mxn, r.prom12_activo_total_mxn;
        END IF;
    END LOOP;

    RAISE NOTICE 'BLOQUE 4 OK: 12 ventanas consecutivas en 2025 y prom12 dentro de 1e-6 MXN';
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 5: caso de control institucional Caja Popular Mexicana (029056).
-- Derivados institucionales: tolerancia 1e-8 pp por redondeo de las fuentes.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
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
        IF r.institucion_nombre IS NULL THEN
            RAISE EXCEPTION '% sin fila para Caja Popular Mexicana (029056)', r.periodo_ym;
        END IF;
        IF r.obs_socios IS DISTINCT FROM r.socios
           OR r.obs_activo IS DISTINCT FROM r.activo
           OR r.obs_disp IS DISTINCT FROM r.disp
           OR r.obs_vigente IS DISTINCT FROM r.vigente
           OR r.obs_vencida IS DISTINCT FROM r.vencida
           OR r.obs_estimacion IS DISTINCT FROM r.estimacion THEN
            RAISE EXCEPTION '%/% saldos o socios distintos: %/%/%/%/%/%',
                r.periodo_ym, '029056', r.obs_socios, r.obs_activo, r.obs_disp,
                r.obs_vigente, r.obs_vencida, r.obs_estimacion;
        END IF;
        IF r.obs_imor_pub IS NULL OR r.obs_imor_calc IS NULL OR r.obs_nicap IS NULL
           OR r.obs_categoria IS NULL OR r.obs_m02_pub IS NULL OR r.obs_m02_calc IS NULL
           OR r.obs_colocacion IS NULL OR r.obs_icor IS NULL THEN
            RAISE EXCEPTION '%/% KPI derivado nulo', r.periodo_ym, '029056';
        END IF;
        IF abs(r.obs_imor_pub - r.imor) > 1e-8
           OR abs(r.obs_imor_calc - r.imor) > 1e-8
           OR abs(r.obs_nicap - r.nicap) > 1e-8
           OR abs(r.obs_m02_pub - r.m02) > 1e-8
           OR abs(r.obs_m02_calc - r.m02) > 1e-8
           OR abs(r.obs_colocacion - r.colocacion) > 1e-8
           OR abs(r.obs_icor - r.icor) > 1e-8 THEN
            RAISE EXCEPTION '%/% KPI fuera de tolerancia 1e-8 pp: IMOR %/%, NICAP %, M-02 %/%, coloc % ICOR %',
                r.periodo_ym, '029056', r.obs_imor_pub, r.obs_imor_calc, r.obs_nicap,
                r.obs_m02_pub, r.obs_m02_calc, r.obs_colocacion, r.obs_icor;
        END IF;
        IF r.obs_categoria <> r.categoria THEN
            RAISE EXCEPTION '%/% categoría NICAP: esperada %, obtenida %',
                r.periodo_ym, '029056', r.categoria, r.obs_categoria;
        END IF;
    END LOOP;

    RAISE NOTICE 'BLOQUE 5 OK: CPM Q1/Q4 con saldos exactos y derivados dentro de 1e-8 pp';
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 6: M-03 FONACOT (cuatro trimestres, Aguascalientes y APP MOVIL)
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
               o.m03_ticket_promedio_nacional_mxn AS obs_ticket
        FROM esperados e
        LEFT JOIN v_kpis_fonacot_trim_resumen o
          ON o.trimestre = e.trimestre AND o.anio = 2025
    LOOP
        IF r.obs_creditos IS NULL OR r.obs_monto IS NULL OR r.obs_part IS NULL OR r.obs_ticket IS NULL THEN
            RAISE EXCEPTION '% sin datos en v_kpis_fonacot_trim_resumen', r.trimestre;
        END IF;
        IF r.obs_creditos <> r.creditos
           OR abs(r.obs_monto - r.monto) > 1e-6
           OR abs(r.obs_part - r.part) > 1e-10
           OR abs(r.obs_ticket - r.ticket) > 1e-6 THEN
            RAISE EXCEPTION '% FONACOT fuera de tolerancia: créditos %, monto %, part %, ticket %',
                r.trimestre, r.obs_creditos, r.obs_monto, r.obs_part, r.obs_ticket;
        END IF;
    END LOOP;

    SELECT count(*) INTO n
    FROM v_kpis_fonacot_trim_resumen
    WHERE anio = 2025
      AND (creditos_solo_entidades + creditos_canal_app_movil) IS DISTINCT FROM creditos_totales_nacional;
    IF n > 0 THEN
        RAISE EXCEPTION '% trimestres FONACOT no separan correctamente APP MOVIL', n;
    END IF;

    SELECT count(*) INTO n
    FROM v_fonacot_mes_base
    WHERE periodo_ym = '2025-01' AND ambito_canonico = 'AGUASCALIENTES' AND genero = 'mujeres'
      AND creditos = 1326 AND monto_mxn = 32050929.750000;
    IF n <> 1 THEN
        RAISE EXCEPTION 'Caso puntual FONACOT Aguascalientes 2025-01/mujeres: % filas coincidentes', n;
    END IF;

    RAISE NOTICE 'BLOQUE 6 OK: FONACOT 2025, Aguascalientes y separación APP MOVIL';
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 7: M-04 SNIIV 2025 (totales, nulos de sexo y participaciones)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
BEGIN
    SELECT * INTO r FROM v_kpis_sniiv_anual_resumen WHERE anio = 2025;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No hay resumen SNIIV 2025 en la instantánea activa';
    END IF;

    IF r.total_registros_csv <> 325649 OR r.m04_acciones_totales <> 998745
       OR r.acciones_mujeres <> 452066 OR r.acciones_hombres <> 546675
       OR r.acciones_con_sexo_definido <> 998741
       OR r.filas_sin_sexo <> 399 OR r.acciones_sin_sexo <> 4
       OR r.acciones_infonavit <> 666957 THEN
        RAISE EXCEPTION 'SNIIV conteos inesperados: filas %, acciones %, mujeres %, hombres %, sin sexo %/%',
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
        RAISE EXCEPTION 'SNIIV participaciones fuera de tolerancia: %/%/%',
            r.m04_participacion_mujeres_acciones_pct,
            r.m04_participacion_mujeres_monto_pct,
            r.m04_participacion_infonavit_acciones_pct;
    END IF;

    RAISE NOTICE 'BLOQUE 7 OK: SNIIV 325649 filas / 998745 acciones / sexo nulo conservado';
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 8: contraste oficial Series vs boletines y etiquetas trimestrales con año
-- Las diferencias entre fuentes se documentan, no se fuerzan a cero. Sí se exige
-- que el total del boletín concilie con Σ activo de sus 155 sociedades (±1 MXN).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
    n bigint;
BEGIN
    SELECT count(*) INTO n FROM v_kpis_cnbv_contraste_trim;
    IF n <> 4 THEN
        RAISE EXCEPTION 'Contraste trimestral: esperados 4 cortes, obtenidos %', n;
    END IF;

    FOR r IN
        SELECT c.trimestre, c.series_activo_total_mxn, c.boletin_activo_total_mxn,
               (SELECT sum(i.activo_mxn) FROM hecho_cnbv_institucion_trim i
                WHERE i.ejecucion_id = c.ejecucion_id AND i.mes_id = c.mes_id) AS suma_instituciones
        FROM v_kpis_cnbv_contraste_trim c
        ORDER BY c.mes_id
    LOOP
        IF r.trimestre !~ '^2025-Q[1-4]$' THEN
            RAISE EXCEPTION 'Etiqueta trimestral inválida (sin año): %', r.trimestre;
        END IF;
        IF r.series_activo_total_mxn IS NULL OR r.boletin_activo_total_mxn IS NULL
           OR r.suma_instituciones IS NULL THEN
            RAISE EXCEPTION '% contraste incompleto: Series/boletín/sociedades nulos', r.trimestre;
        END IF;
        IF abs(r.boletin_activo_total_mxn - r.suma_instituciones) > 1 THEN
            RAISE EXCEPTION '% activo boletín % vs Σ sociedades % (diff % MXN)',
                r.trimestre, r.boletin_activo_total_mxn, r.suma_instituciones,
                abs(r.boletin_activo_total_mxn - r.suma_instituciones);
        END IF;
    END LOOP;

    RAISE NOTICE 'BLOQUE 8 OK: 4 etiquetas 2025-Qn y boletín = Σ sociedades (±1 MXN)';
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 9: casos borde (NULLIF, ventanas incompletas y rankings sin nulos)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    n bigint;
    ok boolean;
BEGIN
    SELECT (100.0 / NULLIF(0.0, 0.0)) IS NULL INTO ok;
    IF NOT ok THEN
        RAISE EXCEPTION 'NULLIF no devuelve NULL con denominador cero';
    END IF;

    SELECT count(*) INTO n
    FROM v_kpis_cnbv_sector_mes
    WHERE NOT ventana_12m_completa
      AND (kpi05_tasa_activa_pct IS NOT NULL
           OR kpi06_tasa_pasiva_pct IS NOT NULL
           OR kpi08_roa_pct IS NOT NULL);
    IF n > 0 THEN
        RAISE EXCEPTION '% cortes con ventana incompleta tienen KPI de 12m calculado', n;
    END IF;

    SELECT count(*) INTO n
    FROM v_kpis_cnbv_institucion_trim
    WHERE kpi01_imor_publicado_pct IS NULL AND rank_imor_mayor_riesgo IS NOT NULL;
    IF n > 0 THEN
        RAISE EXCEPTION '% sociedades con IMOR nulo fueron incluidas en el ranking', n;
    END IF;

    RAISE NOTICE 'BLOQUE 9 OK: NULLIF, ventanas incompletas y rankings sin nulos';
END $$;

-- -----------------------------------------------------------------------------
-- BLOQUE 10: control de rollback con savepoint (equivalente al usado por el loader)
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE st_validacion_rollback (id integer PRIMARY KEY) ON COMMIT DROP;
INSERT INTO st_validacion_rollback (id) VALUES (1);

SAVEPOINT sp_validacion_fase4;
INSERT INTO st_validacion_rollback (id) VALUES (2);
ROLLBACK TO SAVEPOINT sp_validacion_fase4;
RELEASE SAVEPOINT sp_validacion_fase4;

DO $$
DECLARE
    n bigint;
BEGIN
    SELECT count(*) INTO n FROM st_validacion_rollback;
    IF n <> 1 OR EXISTS (SELECT 1 FROM st_validacion_rollback WHERE id = 2) THEN
        RAISE EXCEPTION 'Rollback con savepoint incompleto: % filas persistieron', n;
    END IF;
    RAISE NOTICE 'BLOQUE 10 OK: savepoint revertió la fila inducida sin afectar la base';
END $$;
DROP TABLE st_validacion_rollback;

SELECT 'VALIDACION_FASE_IV_OK' AS resultado,
       (SELECT ejecucion_id FROM v_ejecucion_activa) AS ejecucion_activa,
       now() AS validada_en;

COMMIT;
