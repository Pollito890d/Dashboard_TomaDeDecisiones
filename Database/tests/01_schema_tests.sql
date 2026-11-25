-- Ejecutar contra dashboard_caja_ahorro con ON_ERROR_STOP; nunca confirma registros.
-- IDs explícitos negativos evitan avanzar secuencias de identidad.
BEGIN;
SET LOCAL search_path = public, pg_catalog;

DO $$
DECLARE
    prueba record;
    fallo_esperado boolean;
    total integer;
BEGIN
    SELECT count(*) INTO total FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname = ANY (ARRAY[
        'archivo_fuente','ejecucion_etl','ejecucion_archivo','dim_mes','dim_institucion',
        'dim_concepto_cnbv','dim_ambito_fonacot','dim_genero_fonacot',
        'hecho_cnbv_sector_mes','hecho_cnbv_institucion_trim','hecho_cnbv_total_trim',
        'hecho_fonacot_mes','hecho_sniiv_mes']);
    IF total <> 13 THEN RAISE EXCEPTION 'No están las 13 tablas esperadas'; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
                   JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_index i ON i.indexrelid=c.conindid
                   WHERE n.nspname='public' AND t.relname='hecho_sniiv_mes'
                     AND c.conname='sniiv_grano_uq' AND c.contype='u' AND i.indnullsnotdistinct) THEN
        RAISE EXCEPTION 'Falta unicidad SNIIV con nulos iguales';
    END IF;

    INSERT INTO archivo_fuente (archivo_id,fuente,ruta,sha256,tamano_bytes,rol) VALUES
        (-801,'CNBV','__prueba_cnbv__',repeat('a',64),0,'hechos'),
        (-802,'FONACOT','__prueba_fonacot__',repeat('b',64),0,'hechos'),
        (-803,'SNIIV','__prueba_sniiv__',repeat('c',64),0,'hechos'),
        (-804,'CNBV','__prueba_otro__',repeat('d',64),0,'hechos');
    INSERT INTO ejecucion_etl (ejecucion_id,iniciada_en,estado,version_proceso)
        VALUES (-801,now(),'iniciada','prueba');
    INSERT INTO ejecucion_archivo VALUES (-801,-801,'hechos',true),(-801,-802,'hechos',true),(-801,-803,'hechos',true),(-801,-804,'hechos',true);
    INSERT INTO dim_mes VALUES ('2025-03-01'),('2025-04-01');
    INSERT INTO dim_institucion (institucion_id,clave_seis,clave_boletin,nombre) VALUES (-801,'000001','1','prueba');
    INSERT INTO dim_concepto_cnbv (concepto_id,archivo_id,hoja,fila_series,nombre,naturaleza,unidad_origen,unidad_normalizada)
        VALUES (-801,-801,'Series',1,'prueba','saldo','millones_mxn_inferidos','mxn');
    INSERT INTO dim_ambito_fonacot VALUES (-801,'canal','APP MOVIL');
    INSERT INTO dim_genero_fonacot VALUES (-801,'mujeres');
    INSERT INTO hecho_cnbv_sector_mes (sector_mes_id,ejecucion_id,archivo_id,mes_id,concepto_id,valor)
        VALUES (-801,-801,-801,'2025-03-01',-801,-123.123456);
    INSERT INTO hecho_cnbv_institucion_trim (institucion_trim_id,ejecucion_id,archivo_id,mes_id,institucion_id,estado_reporte,estimacion_mxn)
        VALUES (-801,-801,-801,'2025-03-01',-801,'parcial',-1.123456);
    INSERT INTO hecho_cnbv_total_trim (total_trim_id,ejecucion_id,archivo_id,mes_id)
        VALUES (-801,-801,-801,'2025-03-01');
    INSERT INTO hecho_fonacot_mes (fonacot_mes_id,ejecucion_id,archivo_creditos_id,mes_id,ambito_id,genero_id,etiqueta_creditos_original,creditos)
        VALUES (-801,-801,-802,'2025-03-01',-801,-801,'prueba',NULL);
    INSERT INTO hecho_sniiv_mes (sniiv_mes_id,ejecucion_id,archivo_id,mes_id,cve_ent,sexo,acciones,monto_mxn)
        VALUES (-801,-801,-803,'2025-03-01','01',NULL,NULL,123.123456);
    -- Una dimensión distinta con nulos comunes debe admitirse.
    INSERT INTO hecho_sniiv_mes (sniiv_mes_id,ejecucion_id,archivo_id,mes_id,cve_ent,sexo)
        VALUES (-802,-801,-803,'2025-03-01','01','2');
    IF (SELECT valor FROM hecho_cnbv_sector_mes WHERE sector_mes_id=-801) <> -123.123456 OR
       (SELECT estimacion_mxn FROM hecho_cnbv_institucion_trim WHERE institucion_trim_id=-801) <> -1.123456 OR
       (SELECT monto_mxn FROM hecho_sniiv_mes WHERE sniiv_mes_id=-801) <> 123.123456 THEN
        RAISE EXCEPTION 'No se preservaron signo o precisión';
    END IF;

    -- Cada caso debe fallar con el SQLSTATE exacto; cualquier otro error aborta.
    FOR prueba IN SELECT * FROM (VALUES
      ('duplicado sector','23505', $q$INSERT INTO hecho_cnbv_sector_mes (sector_mes_id,ejecucion_id,archivo_id,mes_id,concepto_id) VALUES (-802,-801,-801,'2025-03-01',-801)$q$),
      ('duplicado institución','23505', $q$INSERT INTO hecho_cnbv_institucion_trim (institucion_trim_id,ejecucion_id,archivo_id,mes_id,institucion_id,estado_reporte) VALUES (-802,-801,-801,'2025-03-01',-801,'publicado')$q$),
      ('duplicado total','23505', $q$INSERT INTO hecho_cnbv_total_trim (total_trim_id,ejecucion_id,archivo_id,mes_id) VALUES (-802,-801,-801,'2025-03-01')$q$),
      ('duplicado FONACOT','23505', $q$INSERT INTO hecho_fonacot_mes (fonacot_mes_id,ejecucion_id,archivo_creditos_id,mes_id,ambito_id,genero_id,etiqueta_creditos_original) VALUES (-802,-801,-802,'2025-03-01',-801,-801,'prueba')$q$),
      ('duplicado SNIIV con nulos','23505', $q$INSERT INTO hecho_sniiv_mes (sniiv_mes_id,ejecucion_id,archivo_id,mes_id,cve_ent) VALUES (-803,-801,-803,'2025-03-01','01')$q$),
      ('FK mes inexistente','23503', $q$INSERT INTO hecho_sniiv_mes (sniiv_mes_id,ejecucion_id,archivo_id,mes_id) VALUES (-803,-801,-803,'2026-01-01')$q$),
      ('FK ejecución archivo','23503', $q$INSERT INTO hecho_sniiv_mes (sniiv_mes_id,ejecucion_id,archivo_id,mes_id) VALUES (-803,-801,-999,'2025-03-01')$q$),
      ('FK concepto archivo','23503', $q$INSERT INTO hecho_cnbv_sector_mes (sector_mes_id,ejecucion_id,archivo_id,mes_id,concepto_id) VALUES (-802,-801,-804,'2025-04-01',-801)$q$),
      ('FK archivo opcional FONACOT','23503', $q$INSERT INTO hecho_fonacot_mes (fonacot_mes_id,ejecucion_id,archivo_monto_id,mes_id,ambito_id,genero_id,etiqueta_monto_original) VALUES (-802,-801,-999,'2025-04-01',-801,-801,'prueba')$q$),
      ('día de mes','23514', $q$INSERT INTO dim_mes VALUES ('2025-03-02')$q$),
      ('trimestre institucional','23514', $q$INSERT INTO hecho_cnbv_institucion_trim (institucion_trim_id,ejecucion_id,archivo_id,mes_id,institucion_id,estado_reporte) VALUES (-802,-801,-801,'2025-04-01',-801,'publicado')$q$),
      ('trimestre total','23514', $q$INSERT INTO hecho_cnbv_total_trim (total_trim_id,ejecucion_id,archivo_id,mes_id) VALUES (-802,-801,-801,'2025-04-01')$q$),
      ('hash inválido','23514', $q$INSERT INTO archivo_fuente (archivo_id,fuente,ruta,sha256,tamano_bytes,rol) VALUES (-805,'CNBV','__hash__','invalid',0,'hechos')$q$),
      ('unidad incompatible','23514', $q$INSERT INTO dim_concepto_cnbv (concepto_id,archivo_id,hoja,fila_series,nombre,naturaleza,unidad_origen,unidad_normalizada) VALUES (-802,-801,'Series',2,'prueba','saldo','conteo','conteo')$q$),
      ('APP como entidad','23514', $q$INSERT INTO dim_ambito_fonacot VALUES (-802,'entidad','APP MOVIL')$q$),
      ('FONACOT sin archivo','23514', $q$INSERT INTO hecho_fonacot_mes (fonacot_mes_id,ejecucion_id,mes_id,ambito_id,genero_id) VALUES (-802,-801,'2025-04-01',-801,-801)$q$),
      ('FONACOT archivo sin etiqueta','23514', $q$INSERT INTO hecho_fonacot_mes (fonacot_mes_id,ejecucion_id,archivo_creditos_id,mes_id,ambito_id,genero_id) VALUES (-802,-801,-802,'2025-04-01',-801,-801)$q$),
      ('FONACOT medida sin archivo','23514', $q$INSERT INTO hecho_fonacot_mes (fonacot_mes_id,ejecucion_id,archivo_creditos_id,etiqueta_creditos_original,mes_id,ambito_id,genero_id,monto_mxn) VALUES (-802,-801,-802,'prueba','2025-04-01',-801,-801,1)$q$)
    ) AS casos(nombre, estado, sentencia)
    LOOP
        fallo_esperado := false;
        BEGIN
            EXECUTE prueba.sentencia;
        EXCEPTION WHEN OTHERS THEN
            IF SQLSTATE <> prueba.estado THEN RAISE; END IF;
            fallo_esperado := true;
        END;
        IF NOT fallo_esperado THEN RAISE EXCEPTION 'No se rechazó: %', prueba.nombre; END IF;
        RAISE NOTICE 'OK: %', prueba.nombre;
    END LOOP;
    RAISE NOTICE 'OK: 13 tablas, SNIIV nulos, inserciones válidas, signos y precisión';
END $$;
ROLLBACK;
