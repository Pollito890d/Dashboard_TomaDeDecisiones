# Documentación de Vistas SQL — Fase IV (Paso 16)

**Rama:** `feature/fase-4-vistas-kpis`  
**Motor:** PostgreSQL 15+  
**Archivos implementados:**
- [Database/views/01_vistas.sql](../Database/views/01_vistas.sql) — Vistas base, control de instantánea activa (`v_ejecucion_activa`) y ventanas móviles de 12 meses.
- [Database/views/02_kpis.sql](../Database/views/02_kpis.sql) — Vistas analíticas de los 9 KPIs financieros del sector CNBV (`KPI-01` a `KPI-09`), métricas institucionales trimestrales y métricas de contexto externo (`M-01` a `M-04`).
- [Database/03_views.sql](../Database/03_views.sql) — Script maestro que carga en orden `01_vistas.sql` y `02_kpis.sql`.

---

## 1. Principios de Diseño y Reglas de Integridad Analítica

Las vistas fueron diseñadas siguiendo estrictamente las especificaciones de [docs/modelo_datos.md](modelo_datos.md), [docs/diccionario_datos.md](diccionario_datos.md) y [docs/catalogo_kpis.md](catalogo_kpis.md):

1. **Aislamiento de Instantánea (`v_ejecucion_activa`):**
   - El modelo analítico almacena cada corrida del ETL como una instantánea inmutable en `ejecucion_etl`.
   - Para evitar que el backend sume o duplique registros si el ETL se ejecuta varias veces, todas las vistas hacen `JOIN` contra `v_ejecucion_activa`, la cual selecciona exclusivamente la última ejecución con `estado = 'exitosa'`.
2. **Protección contra División por Cero (`NULLIF`):**
   - Todos los cocientes aplican `NULLIF(denominador, 0)`. Si el denominador es `0` o `NULL`, el KPI devuelve `NULL` («no disponible»), sin lanzar excepción ni imputar ceros ficticios.
3. **Saldos Semiaditivos y Ventanas Móviles de 12 Meses (`prom12`):**
   - Los saldos contables (`ACTIVO`, `Cartera vigente`, `Cartera vencida`, `Captación`) se consultan siempre al cierre de su periodo (`mes_id`) y **nunca se suman entre meses o trimestres**.
   - Para `KPI-05` (Tasa implícita activa), `KPI-06` (Tasa implícita pasiva) y `KPI-08` (ROA), la vista `v_cnbv_sector_pivot_mes` calcula el promedio móvil de los 12 saldos mensuales consecutivos (`ROWS BETWEEN 11 PRECEDING AND CURRENT ROW`) y verifica que existan exactamente 12 meses consecutivos (`mes_inicio_ventana_real = mes_id - INTERVAL '11 months'`) sin valores nulos. Si un corte tiene menos de 12 meses previos en la base (por ejemplo, `2024-02` a `2024-12`), `ventana_12m_completa` es `FALSE` y el promedio devuelve `NULL`.
4. **Separación de Universos y Fuentes Externas:**
   - No se mezclan en una misma vista la serie mensual consolidada del sector (`SH_SOCAPS.xlsm!Series`) con el detalle trimestral por cooperativa (`BE_SOCAPS_2025XX.xlsx`), ni se atribuyen créditos de FONACOT o financiamientos de SNIIV a cooperativas individuales.

---

## 2. Catálogo de Vistas Implementadas

### 2.1 Capa Base (`Database/views/01_vistas.sql`)

| Vista | Grano | Tablas Origen | Propósito para el Backend / Análisis |
|---|---|---|---|
| `v_ejecucion_activa` | 1 fila (`ejecucion_id`) | `ejecucion_etl` | Obtiene el `ejecucion_id` de la última carga con `estado = 'exitosa'`. Si aún no se han cargado hechos, devuelve 0 filas y todas las vistas dependientes responden limpiamente con 0 filas. |
| `v_cnbv_sector_conceptos_mes` | `mes_id` × `concepto_id` | `hecho_cnbv_sector_mes`, `dim_concepto_cnbv`, `archivo_fuente` | Expone en formato largo los 26 conceptos mensuales del sector SOCAPS con su fila original de `Series`, código, naturaleza (`saldo`, `flujo_12m`, `conteo`, `porcentaje`), unidad y hash SHA-256 de trazabilidad. |
| `v_cnbv_sector_pivot_mes` | `mes_id` (1 fila por mes) | `hecho_cnbv_sector_mes`, `dim_concepto_cnbv` | Pivota los 26 conceptos de `Series` en columnas tipadas con nombre explícito (`v005_activo_total_mxn`, `v013_cartera_vigente_mxn`, etc.) y calcula con funciones de ventana `prom12_v005_activo_total_mxn`, `prom12_v013_cartera_vigente_mxn` y `prom12_v035_captacion_tradicional_mxn`. |
| `v_cnbv_institucion_trim_base` | `mes_id` × `institucion_id` | `hecho_cnbv_institucion_trim`, `dim_institucion`, `hecho_cnbv_total_trim`, `archivo_fuente` | Une cada sociedad trimestral con sus claves normalizadas (`clave_seis`, `clave_boletin`, `clave_catalogo`, `nombre`) y adjunta en la misma fila el total sectorial publicado del trimestre (`hecho_cnbv_total_trim`) para calcular participaciones sin subconsultas repetidas. |
| `v_fonacot_mes_base` | `mes_id` × `ambito_id` × `genero_id` | `hecho_fonacot_mes`, `dim_ambito_fonacot`, `dim_genero_fonacot` | Desnormaliza los hechos mensuales de FONACOT con trimestre (`2025-Q1..Q4`), tipo de ámbito (`entidad` vs. `canal` para `APP MOVIL`), nombre canónico y género (`mujeres`, `hombres`). |
| `v_sniiv_mes_base` | 12 dimensiones SNIIV | `hecho_sniiv_mes` | Expone los financiamientos de vivienda de la ejecución activa conservando las 12 dimensiones textuales, etiqueta legible de sexo (`Hombre`, `Mujer`, `No especificado / NULL`) y bandera `es_infonavit` (`organismo = '1'`). |

---

### 2.2 Capa Analítica de KPIs (`Database/views/02_kpis.sql`)

| Vista | Grano | Indicadores que Resuelve | Descripción y Reglas de Negocio |
|---|---|---|---|
| `v_kpis_cnbv_sector_mes` | `mes_id` (mensual) | `KPI-01` a `KPI-09`, `spread_tasas_pp` y `M-01` | Vista principal para el modo **Sectorial Mensual**. Calcula en SQL los 9 KPIs financieros y la participación femenina (`M-01`), exponiendo a la par las columnas oficiales publicadas (`v177`, `v185`, `v193`, `v196`, `v198`, `v210`, `v217`, `v224`) y la clasificación regulatoria de NICAP (`Categoría 1` a `4`). |
| `v_kpis_cnbv_sector_bandas_2025` | `kpi_id` (10 filas) | Bandas de referencia `observado_2025` y `regulatorio` | Calcula dinámicamente sobre los 12 cortes mensuales de 2025 el mínimo, la mediana (`PERCENTILE_CONT(0.5)`) y el máximo de cada indicador sectorial, junto con el umbral regulatorio de `100%` exclusivo para `KPI-04` (NICAP). |
| `v_kpis_cnbv_institucion_trim` | `mes_id` × `institucion_id` (trimestral) | `KPI-01`, `KPI-02` (derivado), `KPI-04`, `KPI-05`/`06` (`TI`), `KPI-09` (derivado), `M-02` y Rankings | Vista principal para el modo **Institucional Trimestral** y tabla comparativa de cooperativas. Calcula `kpi02_icor_derivado_pct`, `kpi09_colocacion_captacion_total_derivado_pct` y `m02_participacion_activo_recalculada_pct`. Incluye `DENSE_RANK()` por IMOR, Activo y NICAP excluyendo valores `NULL` (`n.d.`). Expone `kpi03_liquidez_no_disponible_pct` como `NULL` explícito porque los boletines no publican el corte `<= 30 días`. |
| `v_kpis_cnbv_contraste_trim` | `mes_id` (4 cortes trimestrales) | Contraste `Series` vs. Boletines `BE_SOCAPS` | Compara en `2025-03`, `2025-06`, `2025-09` y `2025-12` los valores de `v_kpis_cnbv_sector_mes` frente a `hecho_cnbv_total_trim` (`diff_imor_pp`, `diff_icor_pp`, `diff_nicap_pp`, `diff_roa_pp`), permitiendo auditar diferencias por fecha de elaboración. |
| `v_kpis_fonacot_trim_resumen` | `anio` × `trimestre` (4 filas) | `M-03` Nacional y Subtotal Entidades | Calcula créditos totales, monto en MXN, participación femenina en créditos y en monto (`%`), y ticket promedio en MXN. Separa explícitamente el total nacional (que incluye `APP MOVIL`) del subtotal exclusivo de las 32 entidades federativas. |
| `v_kpis_fonacot_ambito_trim` | `anio` × `trimestre` × `ambito_id` | `M-03` por Entidad Federativa / Canal | Desglose trimestral por estado o canal (`APP MOVIL`) para gráficos de barras y filtros territoriales de contexto externo. |
| `v_kpis_sniiv_anual_resumen` | `anio` (1 fila para 2025) | `M-04` Resumen Nacional | Concilia registros totales (`325,649`), acciones (`998,745`), monto (`$617,246,458,236.39`), promedio por acción (`$618,022.08`), filas sin sexo (`399` filas = `4` acciones), participación femenina en acciones (`45.263587%`) y en monto (`40.230728%` sobre `sexo IN ('1','2')`), y participación de INFONAVIT (`66.779508%`). |
| `v_kpis_sniiv_entidad_anual` | `anio` × `cve_ent` | `M-04` por Entidad Federativa | Desglose de acciones, monto, participación femenina y participación INFONAVIT por entidad federativa (`01` a `32` más registros con `cve_ent IS NULL`). |

---

## 3. Guía de Consumo para el Backend (Fase V — FastAPI)

- **Endpoint `/api/dashboard` (modo sectorial mensual):**
  - Consultar `SELECT * FROM v_kpis_cnbv_sector_mes WHERE anio = 2025 ORDER BY mes_id;` para obtener la serie de los 12 meses de 2025 y las tarjetas del corte seleccionado.
  - Consultar `SELECT * FROM v_kpis_cnbv_sector_bandas_2025;` para poblar las bandas de referencia (`observado_2025` y `regulatorio`).
- **Endpoint `/api/dashboard` o `/api/instituciones` (modo institucional trimestral):**
  - Consultar `SELECT * FROM v_kpis_cnbv_institucion_trim WHERE periodo_ym = :corte ORDER BY rank_activo_mayor_tamano NULLS LAST;` para el ranking o filtrar por `clave_seis = :clave` (por ejemplo `'029056'` para Caja Popular Mexicana).
- **Endpoint `/api/fonacot` y `/api/sniiv` (modo contexto externo):**
  - Consultar `v_kpis_fonacot_trim_resumen`, `v_kpis_fonacot_ambito_trim`, `v_kpis_sniiv_anual_resumen` y `v_kpis_sniiv_entidad_anual`.

---

## 4. Comandos de Ejecución en PostgreSQL

Desde la raíz del repositorio:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U dashboard_user -h localhost -p 5432 -d dashboard_caja_ahorro -v ON_ERROR_STOP=1 -f Database/03_views.sql
```

O ejecutando cada archivo individualmente:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U dashboard_user -h localhost -p 5432 -d dashboard_caja_ahorro -v ON_ERROR_STOP=1 -f Database/views/01_vistas.sql
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U dashboard_user -h localhost -p 5432 -d dashboard_caja_ahorro -v ON_ERROR_STOP=1 -f Database/views/02_kpis.sql
```
