# Integración ETL ↔ PostgreSQL — completada (Fases II–IV)

**Rama:** `feature/fase-4-vistas-kpis`  
**Fecha:** 2026-11-25  
**Nota:** el archivo conserva su nombre histórico; el estado que describía («nada ejecutado») ya no aplica. Todo lo siguiente se ejecutó con datos reales. No se hicieron commits ni merges.

La Fase II entregó `Database/01_schema.sql` y las dimensiones/catálogos ya cargados: 19 `archivo_fuente`, 165 `dim_mes`, 155 `dim_institucion`, 26 `dim_concepto_cnbv`, 33 `dim_ambito_fonacot`, 2 `dim_genero_fonacot`. No se volvió a ejecutar `ETL/load_catalogs.py` ni se modificó el esquema.

---

## 1. Cómo se ejecuta

El modo local de `ETL/run_etl.py` sigue igual: no requiere PostgreSQL ni `DATABASE_URL` y publica salidas en `data/processed/` solo si pasan las validaciones. La carga ocurre únicamente con `--cargar`, que exige las tres fuentes:

```powershell
.\.venv\Scripts\python.exe ETL\run_etl.py --cargar
.\.venv\Scripts\python.exe scripts\run_sql_docker.py Database/04_validation.sql
.\.venv\Scripts\python.exe scripts\run_sql_docker.py Database/tests/validacion_kpis.sql
.\.venv\Scripts\python.exe -m pytest ETL/tests -q -s
```

`ETL/run_etl.py::cargar_postgres()` delega en `ETL/load_facts.py::cargar()`. El loader valida que `DATABASE_URL` apunte solo a `postgresql+psycopg`, `localhost`/`127.0.0.1`/`::1`, puerto `5432`, base `dashboard_caja_ahorro` y usuario `dashboard_user`; la contraseña nunca se imprime. En Windows se usa `scripts/run_sql_docker.py` porque no hay `psql` local: el script lee la URL desde `Backend/.env`, valida el destino y ejecuta el SQL dentro del contenedor Docker `dashboard-postgres`.

---

## 2. Mapeo salida → tabla aplicado

| Salida verificada | Destino | Resolución / control |
|---|---|---|
| `cnbv_sector_mes.csv` | `hecho_cnbv_sector_mes` | `archivo_fuente` por ruta + SHA-256; `concepto_id` por (`archivo_id`, `hoja='Series'`, `fila_series`); se comprueban nombre, naturaleza y unidades contra `dim_concepto_cnbv`. |
| `cnbv_institucion_trim.csv` | `hecho_cnbv_institucion_trim` | `institucion_id` por `clave_seis` y `clave_boletin`; no se crean instituciones; 18 medidas 1:1; `estado_reporte` obligatorio. |
| `cnbv_total_trim.csv` | `hecho_cnbv_total_trim` | `archivo_id` del boletín y 7 medidas 1:1 por mes. |
| `fonacot.csv` | `hecho_fonacot_mes` | `ambito_id`, `genero_id`, ambos `archivo_id`, etiquetas originales obligatorias y medidas 1:1. |
| `sniiv.csv` | `hecho_sniiv_mes` | `archivo_id` del CSV original, 12 dimensiones y medidas 1:1; campo vacío → `NULL`. |

Columnas sin destino en el esquema (`marcas_origen`, `nombre_boletin`, `fila_origen`) se registran en `ejecucion_etl.observaciones` bajo `columnas_no_modeladas`. No se agregaron columnas ni se cambió `Database/01_schema.sql`.

---

## 3. Decisiones cerradas

1. **Redondeo:** se acepta la escala del esquema (`numeric(30,6)` para MXN, `numeric(20,10)` para porcentajes). El ETL local emite tres advertencias esperadas: `186` importes con más de 6 decimales, `1` porcentaje con más de 10 y `3,655` porcentajes con más de 10 decimales. La carga verifica que el redondeo no exceda `1e-6 MXN` / `1e-10 pp` y compara fila a fila el resultado insertado contra la salida con `EXCEPT`.
2. **Instantánea:** `v_ejecucion_activa` selecciona la última ejecución `exitosa`. No se publican ejecuciones parciales.
3. **Método:** una transacción por ejecución con `pg_advisory_xact_lock(81370610)`, tablas temporales `ON COMMIT DROP`, `COPY ... FROM STDIN WITH (FORMAT csv, NULL '')` e `INSERT ... SELECT` con casts. No hay `DELETE`, `TRUNCATE` ni `DROP` sobre tablas permanentes.
4. **Trazabilidad:** una fila en `ejecucion_etl` y 19 en `ejecucion_archivo` (`14 hechos`, `3 metadato`, `2 contraste`) por carga. `iniciada_en` y `terminada_en` usan `now()` del servidor para cumplir `ejecucion_fechas_ck`.
5. **Idempotencia:** los SHA-256 de las cinco salidas se guardan en `ejecucion_etl.observaciones` con `integracion='etl-postgres-fase4-1.0'`. Si coinciden con la última ejecución exitosa, la carga se omite sin inserciones.
6. **Conciliación:** FONACOT y SNIIV se verifican desde la base contra los totales esperados. El boletín se concilia con Σ activo de sus sociedades (`±1 MXN`). `Series` y el boletín tienen fechas distintas: se exige que ambos estén presentes, sin forzar su igualdad.
7. **Rollback:** cualquier error revierte la transacción completa. Las pruebas usan un savepoint para inducir un fallo sin confirmar datos.

---

## 4. Evidencia real

Carga:

```text
Carga PostgreSQL exitosa: ejecución 6
```

Estado en la base:

| Objeto | Valor |
|---|---:|
| `ejecucion_etl` | 1 fila; `ejecucion_id=6`; `estado=exitosa` |
| `ejecucion_archivo` | 19 filas (14/3/2) |
| `hecho_cnbv_sector_mes` | 598 |
| `hecho_cnbv_institucion_trim` | 620 |
| `hecho_cnbv_total_trim` | 4 |
| `hecho_fonacot_mes` | 792 |
| `hecho_sniiv_mes` | 325649 |
| `pg_views` | 14 |

Validaciones:

```text
VALIDACION_FASE_IV_OK | ejecucion_activa 6 | 10 bloques OK
VALIDACION_KPIS_ASERTIVA_OK | ejecucion_activa 6 | 8 bloques OK
28 passed in 85.05s
```

Otras verificaciones:

- Segunda carga con las mismas salidas: `omitida_idempotente`, ejecución `6`, sin inserciones.
- Fallo inducido: `ejecucion_etl` quedó en `1` y los cinco recuentos sin cambios.
- Máximas diferencias: catálogo `0 pp`, `Series` `0.0000004407 pp`, `prom12` `0.00000033 MXN`, derivados CPM `0.0000000076 pp`.
- SNIIV: 325649 filas, 998745 acciones, 617246458236.39 MXN, 399 filas / 4 acciones sin sexo.
- Control negativo SQL: al inducir `2e-9 pp` en KPI-09 2025-12, la suite terminó con `ERROR` y código `3` (detalle en [`docs/validacion_kpis.md`](validacion_kpis.md)).

---

## 5. Pruebas que estaban pendientes

| # | Prueba | Resultado real |
|---|---|---|
| 1 | Recuentos de las cinco tablas | 598 / 620 / 4 / 792 / 325649 |
| 2 | FK, trazabilidad y nulos inadmisibles | 0 violaciones |
| 3 | Unicidad por grano | 0 violaciones |
| 4 | SNIIV: acciones, monto y sexo nulo | 998745; 617246458236.39; 399 filas / 4 acciones |
| 5 | FONACOT por trimestre | 503416 / 510842 / 601649 / 561561 créditos; montos verificados |
| 6 | KPI-01…09 y M-01 en SQL | 20 casos; diff catálogo `0 pp`, diff Series `0.0000004407 pp` |
| 7 | Ventanas de 12 meses | 12 cortes consecutivos; diff `0.00000033 MXN` |
| 8 | Caja Popular Mexicana Q1/Q4 | saldos exactos; derivados diff `0.0000000076 pp` |
| 9 | Diferencia CSV ↔ BD por redondeo | dentro de `1e-6 MXN` / `1e-10 pp` |
| 10 | Idempotencia | `omitida_idempotente`, sin duplicados |
| 11 | Fallo inducido | rollback; sin ejecución parcial |
| 12 | Hechos externos sin institución | FONACOT/SNIIV sin columna de institución, por diseño |

Con esto, el punto de control 3 queda completo: extracción, transformación, conciliación local, carga atómica y validación desde la base. FastAPI y el consumo desde `Frontend/` siguen fuera de este paso.
