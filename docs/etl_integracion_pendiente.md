# Integración pendiente ETL ↔ PostgreSQL (tras el merge de fases II y III)

Este documento prepara la carga; **nada de lo siguiente se ha ejecutado**. La fase III entrega archivos locales validados; la inserción, las FK, la idempotencia SQL, el rollback y la conciliación desde la base quedan a cargo de la integración. `ETL/run_etl.py --cargar` devuelve el código 2 y `cargar_postgres()` lanza `NotImplementedError`: no se simula ninguna conexión.

Esquema de referencia: `Database/01_schema.sql` en `main@f6ace0e`, solo lectura. Dimensiones ya cargadas por `ETL/load_catalogs.py` (paso 09): 19 `archivo_fuente`, 165 `dim_mes`, 155 `dim_institucion`, 26 `dim_concepto_cnbv`, 33 `dim_ambito_fonacot`, 2 `dim_genero_fonacot`.

## 1. Mapeo salida → tabla

### Trazabilidad (por ejecución)

1. `INSERT ejecucion_etl (iniciada_en, estado='iniciada', version_proceso='etl-local-fase3-1.0')`.
2. Por cada entrada de `etl_manifest.json` → `archivo_fuente` por (`ruta`, `sha256`) → `INSERT ejecucion_archivo (funcion, hash_verificado=true)`. Función: `hechos` para los CSV/XLSX de hechos; `metadato` para el diccionario SNIIV; `contraste` para el JSON SNIIV.
3. Al final, en la misma transacción: `UPDATE ejecucion_etl SET estado='exitosa', terminada_en=now()`. Ante cualquier error, `ROLLBACK` completo; no publicar ejecuciones parciales.

### `cnbv_sector_mes.csv` → `hecho_cnbv_sector_mes`

| Columna destino | Origen |
|---|---|
| ejecucion_id, archivo_id | Ejecución + `archivo_fuente` de `SH_SOCAPS.xlsm` |
| mes_id | `mes` |
| concepto_id | `dim_concepto_cnbv` por (`archivo_id`, `hoja='Series'`, `fila_series`) |
| valor | `valor` (MXN, conteo o % según concepto) |

Comprobar antes de insertar que `concepto`, `naturaleza` y las dos unidades del CSV coinciden con `dim_concepto_cnbv` (nombre, naturaleza, unidad_origen, unidad_normalizada); si difieren, cancelar.

### `cnbv_institucion_trim.csv` → `hecho_cnbv_institucion_trim`

`institucion_id` por `dim_institucion.clave_seis = clave_seis`; si no existe, cancelar (no crear instituciones). `archivo_id` del boletín (`archivo`); `mes_id = mes`; las 18 medidas y `estado_reporte` 1:1 por nombre. `marcas_origen` y `nombre_boletin` **no tienen columna** en el esquema; se conservan en el CSV. Decidir si se agrega una columna de observaciones (cambio de esquema a cargo del responsable de base de datos).

### `cnbv_total_trim.csv` → `hecho_cnbv_total_trim`

1:1 por nombre (`activo_mxn`, `cartera_vigente_mxn`, `captacion_total_mxn`, `imor_pct`, `icor_pct`, `nicap_pct`, `roa_pct`) + `archivo_id` del boletín.

### `fonacot.csv` → `hecho_fonacot_mes`

`ambito_id` por (`tipo_ambito`, `ambito_canonico`) en `dim_ambito_fonacot`; `genero_id` por `etiqueta = genero`; `archivo_creditos_id`/`archivo_monto_id` por la ruta de cada CSV; `creditos`, `monto_mxn`, `etiqueta_creditos_original`, `etiqueta_monto_original` 1:1. El CSV siempre trae ambos archivos y etiquetas, como exigen `fonacot_creditos_ck` y `fonacot_monto_ck`.

### `sniiv.csv` → `hecho_sniiv_mes`

1:1 por nombre (`cve_ent`, `cve_mun`, `entidad`, `municipio`, 8 códigos, `acciones`, `monto_mxn`); `mes_id = mes`; `archivo_id` del CSV. Campo vacío → NULL (en `COPY ... CSV` el campo vacío sin comillas ya es NULL). `fila_origen` no tiene columna destino. La unicidad del CSV es la misma que `sniiv_grano_uq UNIQUE NULLS NOT DISTINCT`.

## 2. Decisiones abiertas para la integración

1. **Redondeo a la escala del esquema.** Hay 187 importes con más de 6 decimales y 3,655 porcentajes con más de 10 (artefactos binarios de Excel). `numeric(30,6)`/`numeric(20,10)` los redondearán. Propuesta: aceptar el redondeo documentado y validar después de insertar que |valor_bd − valor_csv| < 1e-6 MXN / 1e-10 pp. Alternativa: ampliar la escala (cambio de esquema).
2. **Selección de instantánea.** El modelo prevé consultar una ejecución `exitosa` explícita. Falta definir la regla (p. ej. la última exitosa) y si se crea una vista.
3. **Método de carga.** `COPY` a tablas temporales + `INSERT ... SELECT` con joins a dimensiones (rápido para 325,649 filas SNIIV) o `executemany` por lotes con SQLAlchemy. Ambos dentro de una sola transacción por ejecución, con `pg_advisory_xact_lock` como `load_catalogs.py`.
4. **Idempotencia.** Reejecutar con los mismos archivos crea **otra** ejecución (diseño del modelo). Para evitar duplicados por error, comparar los SHA-256 de salida de `etl_manifest.json` con los de la última ejecución exitosa y omitir la carga si son iguales, o registrarlo explícitamente.
5. Las etiquetas `marcas_origen` y `nombre_boletin` por corte se pierden si no se agrega una columna (ver §1).

## 3. Pruebas SQL pendientes (`Database/04_validation.sql`, por implementar tras el merge)

| # | Prueba | Esperado |
|---|---|---|
| 1 | Recuentos por tabla de hechos para la ejecución cargada | 598 / 620 / 4 / 792 / 325,649 |
| 2 | Todas las FK resueltas (sin `institucion_id`, `concepto_id`, `ambito_id`, `genero_id` ni `archivo_id` nulos o huérfanos) | 0 huérfanos |
| 3 | Unicidad por grano (`*_grano_uq`) | 0 violaciones |
| 4 | Σ `hecho_sniiv_mes.acciones`, Σ `monto_mxn`, filas con `sexo IS NULL` | 998,745; 617,246,458,236.39; 399 filas / 4 acciones |
| 5 | Σ FONACOT por trimestre (créditos, monto) | Tabla del paso 12 en [etl_conciliacion.md](etl_conciliacion.md) |
| 6 | KPI-01…09 y M-01 en SQL para 2025-03 y 2025-12 vs. publicados | Igual a `catalogo_kpis.md` dentro de 1e-9 pp |
| 7 | Ventanas de 12 meses: 12 meses consecutivos no nulos por corte 2025 | 12 en cada corte |
| 8 | Caja Popular Mexicana Q1/Q4: socios, IMOR, ICOR derivado | Igual a `catalogo_kpis.md` §3.1 |
| 9 | Diferencia CSV ↔ BD tras el redondeo | < 1e-6 MXN y < 1e-10 pp |
| 10 | Reejecución de la carga (idempotencia según la decisión 4) | Sin duplicados dentro de una ejecución |
| 11 | Fallo inducido a mitad de carga | `ROLLBACK`; sin filas ni ejecución `exitosa` |
| 12 | Hechos externos sin relación con instituciones | FONACOT/SNIIV sin columnas de institución (por diseño) |

Hasta ejecutar estas pruebas, el punto de control 3 queda **parcial**: extracción, transformación y conciliación local listas; integración con PostgreSQL pendiente.
