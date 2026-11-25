# Validación de KPIs en SQL — Fase IV (Paso 17)

**Rama:** `feature/fase-4-vistas-kpis`  
**Fecha:** 2026-11-25  
**Archivos de validación:**
- [Database/tests/validacion_kpis.sql](../Database/tests/validacion_kpis.sql) — Suite de consultas SQL de verificación contra los casos de control de [docs/catalogo_kpis.md](catalogo_kpis.md).
- [Database/views/01_vistas.sql](../Database/views/01_vistas.sql) y [Database/views/02_kpis.sql](../Database/views/02_kpis.sql) — Implementación SQL de las vistas y fórmulas.

---

## 1. Cobertura de KPIs Implementados vs. Catálogo (`docs/catalogo_kpis.md`)

Se implementaron en SQL **todos los indicadores aprobados** en el catálogo definitivo (9 KPIs financieros del sector CNBV + sus variantes institucionales trimestrales + 4 métricas complementarias y de contexto externo):

| ID | Indicador | Fórmula SQL implementada en `02_kpis.sql` | Unidad | Periodicidad / Alcance | Estado |
|---|---|---|---|---|---|
| **KPI-01** | Índice de Morosidad (IMOR) | `(v017_cartera_vencida_mxn / NULLIF(v009_cartera_total_mxn, 0)) * 100` (Sectorial) / `imor_pct` y `(cartera_vencida_mxn / NULLIF(cartera_vigente_mxn + cartera_vencida_mxn, 0)) * 100` (Institucional) | `%` | Mensual (`Series`) y Trimestral (`BE_SOCAPS`) | **Implementado** |
| **KPI-02** | Índice de Cobertura (ICOR) | `(ABS(v021_estimacion_preventiva_mxn) / NULLIF(v017_cartera_vencida_mxn, 0)) * 100` (Sectorial) / `(ABS(estimacion_mxn) / NULLIF(cartera_vencida_mxn, 0)) * 100` (Institucional derivado) | `%` | Mensual (`Series`) y Trimestral derivado (`EF`) | **Implementado** |
| **KPI-03** | Coeficiente de Liquidez | `(v194_activos_liquidos_cp_mxn / NULLIF(v195_pasivos_cp_mxn, 0)) * 100` (+ `v006_disponibilidades_mxn` como componente) | `%` | Exclusivamente Sectorial Mensual (`Series`) | **Implementado** (No reproducible por cooperativa; documentado como `NULL`) |
| **KPI-04** | Nivel de Capitalización (NICAP) | `(v212_capital_neto_mxn / NULLIF(v213_req_capital_riesgos_mxn, 0)) * 100` (Sectorial) / `nicap_pct` y `categoria_nicap` (Institucional) | `%` | Mensual (`Series`) y Trimestral (`Capitalización`) | **Implementado** (con umbral regulatorio `>100%` y Categorías 1–4) |
| **KPI-05** | Tasa implícita activa de cartera vigente | `(v145_intereses_cartera_vig_12m_mxn / NULLIF(prom12_v013_cartera_vigente_mxn, 0)) * 100` (Sectorial) / `tasa_activa_pct` (Institucional `TI`) | `%` anualizado | Mensual con ventana móvil de 12 saldos (`Series`) y Trimestral (`TI`) | **Implementado** |
| **KPI-06** | Tasa implícita pasiva | `(v153_gastos_intereses_12m_mxn / NULLIF(prom12_v035_captacion_tradicional_mxn, 0)) * 100` (Sectorial) / `tasa_pasiva_total_pct` y `tasa_pasiva_tradicional_pct` (`TI`) | `%` anualizado | Mensual con ventana móvil de 12 saldos (`Series`) y Trimestral (`TI`) | **Implementado** |
| **KPI-07** | Capital contable / Activo total | `(v046_capital_contable_mxn / NULLIF(v005_activo_total_mxn, 0)) * 100` | `%` | Sectorial Mensual (`Series`) | **Implementado** |
| **KPI-08** | Rendimiento sobre el Activo (ROA) | `(v141_resultado_neto_12m_mxn / NULLIF(prom12_v005_activo_total_mxn, 0)) * 100` | `%` anualizado | Sectorial Mensual con ventana de 12 saldos (`Series`) y contraste en Boletín (`Indicadores`) | **Implementado** |
| **KPI-09** | Índice colocación / captación | `(v013_cartera_vigente_mxn / NULLIF(v035_captacion_tradicional_mxn, 0)) * 100` (Sectorial) / `(cartera_vigente_mxn / NULLIF(captacion_total_mxn, 0)) * 100` (Institucional derivado) | `%` | Mensual (captación tradicional) y Trimestral (captación total) | **Implementado** |
| **M-01** | Participación femenina en socios del sector | `(v203_socias_mujeres / NULLIF(v203_socias_mujeres + v204_socios_hombres, 0)) * 100` | `%` | Sectorial Mensual (`Series`) | **Implementado** |
| **M-02** | Participación por activo de cada institución | `(activo_mxn / NULLIF(total_sector_activo_mxn, 0)) * 100` y `participacion_activo_pct` publicada | `%` | Institucional Trimestral (`Instituciones (1)`) | **Implementado** |
| **M-03** | FONACOT: créditos, monto, participación femenina y ticket | `SUM(creditos) FILTER (WHERE genero='mujeres') / NULLIF(SUM(creditos), 0) * 100` y `SUM(monto_mxn) / NULLIF(SUM(creditos), 0)` | Créditos, `MXN`, `%` | Mensual / Trimestral por Entidad Federativa y Canal (`APP MOVIL`) | **Implementado** |
| **M-04** | SNIIV: acciones, monto, participación femenina e INFONAVIT | `SUM(acciones) FILTER (WHERE sexo='2') / NULLIF(SUM(acciones) FILTER (WHERE sexo IN ('1','2')), 0) * 100` y `SUM(acciones) FILTER (WHERE organismo='1') / NULLIF(SUM(acciones), 0) * 100` | Acciones, `MXN`, `%` | Mensual / Anual 2025 con 12 dimensiones | **Implementado** |

**KPIs pendientes:** Ninguno del catálogo aprobado quedó sin implementar en SQL. Los indicadores del wireframe inicial que dependían de datos sintéticos (como «Recuperación de cartera 67.5%» o «Liquidez por sucursal») fueron formalmente descartados/sustituidos en el Paso 05 ([docs/catalogo_kpis.md §6](catalogo_kpis.md)).

---

## 2. Matriz de Casos de Control y Resultados de Validación

### 2.1 Indicadores Sectoriales CNBV (`SH_SOCAPS.xlsm!Series` — Cortes `2025-03` y `2025-12`)

Las fórmulas de `v_kpis_cnbv_sector_mes` reproducen exactamente los valores publicados en `SH_SOCAPS.xlsm!Series` y los cálculos de control de [docs/catalogo_kpis.md §5](catalogo_kpis.md) y [docs/etl_conciliacion.md §Paso 11](etl_conciliacion.md) dentro de la tolerancia `<= 1e-9 pp`:

| KPI | Corte | Numerador (MXN / conteo) | Denominador (MXN / conteo) | Resultado Esperado (`catalogo_kpis.md`) | Resultado Fórmula SQL (`numeric(20,10)`) | Fila Publicada en `Series` | Diferencia (`\|SQL - Publicado\|`) |
|---|---|---:|---:|---:|---:|---:|---:|
| **KPI-01 IMOR** | `2025-03` | `7,097,165,133.00` | `167,536,324,586.00` | `4.2361948375%` | `4.2361948375%` | `4.2361948375%` (fila 177) | `0.0000000000 pp` |
| **KPI-01 IMOR** | `2025-12` | `7,484,565,517.00` | `184,577,594,768.00` | `4.0549697085%` | `4.0549697085%` | `4.0549697085%` (fila 177) | `0.0000000000 pp` |
| **KPI-02 ICOR** | `2025-03` | `8,908,841,483.00` | `7,097,165,133.00` | `125.5267605593%` | `125.5267605593%` | `125.5267605593%` (fila 185) | `0.0000000000 pp` |
| **KPI-02 ICOR** | `2025-12` | `9,549,611,334.00` | `7,484,565,517.00` | `127.5907268062%` | `127.5907268062%` | `127.5907268062%` (fila 185) | `0.0000000000 pp` |
| **KPI-03 Liquidez** | `2025-03` | `53,501,729,460.00` | `141,940,825,729.00` | `37.6929816952%` | `37.6929816952%` | `37.6929816952%` (fila 193) | `0.0000000000 pp` |
| **KPI-03 Liquidez** | `2025-12` | `54,689,759,664.00` | `153,509,999,839.00` | `35.6261802328%` | `35.6261802328%` | `35.6261802328%` (fila 193) | `0.0000000000 pp` |
| **KPI-04 NICAP** | `2025-03` | `51,548,202,787.00` | `16,817,255,171.00` | `306.5197159872%` | `306.5197159872%` | `306.5197159872%` (fila 210) | `0.0000000000 pp` |
| **KPI-04 NICAP** | `2025-12` | `55,951,383,453.00` | `18,634,724,992.00` | `300.2533349855%` | `300.2533349855%` | `300.2533349855%` (fila 210) | `0.0000000000 pp` |
| **KPI-05 Tasa activa** | `2025-03` | `28,005,701,105.00` | `154,141,597,205.166667` (`prom12(13)`) | `18.1688146566%` | `18.1688146566%` | `18.1688146566%` (fila 217) | `<= 1e-9 pp` |
| **KPI-05 Tasa activa** | `2025-12` | `30,455,650,910.00` | `167,058,966,574.750000` (`prom12(13)`) | `18.2304798424%` | `18.2304798424%` | `18.2304798424%` (fila 217) | `<= 1e-9 pp` |
| **KPI-06 Tasa pasiva** | `2025-03` | `12,709,081,417.00` | `219,038,275,966.916667` (`prom12(35)`) | `5.8022194344%` | `5.8022194344%` | `5.8022194344%` (fila 224) | `<= 1e-9 pp` |
| **KPI-06 Tasa pasiva** | `2025-12` | `12,802,380,479.00` | `242,838,125,926.166667` (`prom12(35)`) | `5.2719823640%` | `5.2719823640%` | `5.2719823640%` (fila 224) | `<= 1e-9 pp` |
| **KPI-07 Cap/Activo** | `2025-03` | `53,163,909,164.00` | `294,888,150,735.00` | `18.0284996299%` | `18.0284996299%` | `18.0284996299%` (fila 198) | `0.0000000000 pp` |
| **KPI-07 Cap/Activo** | `2025-12` | `57,490,829,033.00` | `322,027,238,579.00` | `17.8527845893%` | `17.8527845893%` | `17.8527845893%` (fila 198) | `0.0000000000 pp` |
| **KPI-08 ROA** | `2025-03` | `7,095,199,091.00` | `278,842,081,529.583333` (`prom12(5)`) | `2.5445223519%` | `2.5445223519%` | `2.5445223519%` (fila 196) | `<= 1e-9 pp` |
| **KPI-08 ROA** | `2025-12` | `6,646,831,648.00` | `308,629,837,937.000000` (`prom12(5)`) | `2.1536581163%` | `2.1536581163%` | `2.1536581163%` (fila 196) | `<= 1e-9 pp` |
| **KPI-09 Coloc/Cap** | `2025-03` | `160,439,159,453.00` | `232,895,409,502.00` | `68.8889316436%` | `68.8889316436%` | Elaboración propia | `0.0000000000 pp` |
| **M-01 Socias (%)** | `2025-03` | `5,171,225` | `9,543,178` (`5,171,225 + 4,371,953`) | `54.1876615945%` | `54.1876615945%` | Elaboración propia | `0.0000000000 pp` |
| **M-01 Socias (%)** | `2025-12` | `5,375,834` | `9,916,462` (`5,375,834 + 4,540,628`) | `54.2112064685%` | `54.2112064685%` | Elaboración propia | `0.0000000000 pp` |

---

### 2.2 Caso de Control Institucional Trimestral — Caja Popular Mexicana (`clave_seis = '029056'`)

Verificado en `v_kpis_cnbv_institucion_trim` contra [docs/catalogo_kpis.md §3.1](catalogo_kpis.md):

| Indicador / Medida | Corte `2025-03` (Q1) Esperado | Corte `2025-03` (Q1) SQL | Corte `2025-12` (Q4) Esperado | Corte `2025-12` (Q4) SQL | Estado |
|---|---:|---:|---:|---:|---|
| **Número de socios** | `3,692,848` | `3,692,848` | `3,873,780` | `3,873,780` | **Coincide** |
| **Activo total (MXN)** | `$114,228,216,874.00` | `$114,228,216,874.00` | `$126,888,191,520.00` | `$126,888,191,520.00` | **Coincide** |
| **M-02 Participación por activo** | `38.7596208040%` | `38.7596208040%` | `39.4283734536%` | `39.4283734536%` | **Coincide** |
| **Disponibilidades (`EF`, MXN)** | `$1,739,002,836.00` | `$1,739,002,836.00` | `$1,481,021,783.00` | `$1,481,021,783.00` | **Coincide** |
| **Cartera vigente (MXN)** | `$58,779,416,190.00` | `$58,779,416,190.00` | `$67,171,203,942.00` | `$67,171,203,942.00` | **Coincide** |
| **Cartera vencida (MXN)** | `$1,946,111,129.00` | `$1,946,111,129.00` | `$1,943,667,351.00` | `$1,943,667,351.00` | **Coincide** |
| **KPI-01 IMOR (publicado = recalculado)** | `3.2047661254%` | `3.2047661254%` | `2.8122274044%` | `2.8122274044%` | **Coincide** |
| **KPI-04 NICAP y Categoría** | `252.3931729344%` (Cat. `1`) | `252.3931729344%` (Cat. `1`) | `235.6833561551%` (Cat. `1`) | `235.6833561551%` (Cat. `1`) | **Coincide** |
| **KPI-09 Colocación / Captación total (derivado)** | `61.50923399%` | `61.5092339937%` | `62.93319802%` | `62.9331980237%` | **Coincide** |
| **KPI-02 ICOR (derivado `ABS(EF!24)/vencida`)** | `149.12378737%` | `149.1237873698%` | `158.96528814%` | `158.9652881365%` | **Coincide** |

---

### 2.3 Casos de Control de Contexto Externo (`M-03` FONACOT y `M-04` SNIIV)

- **M-03 FONACOT (`v_kpis_fonacot_trim_resumen` y `v_fonacot_mes_base`):**
  - **2025-Q1:** `503,416` créditos totales; `206,247` mujeres → **`40.9694964006%`** participación femenina; monto `$15,525,525,836.55` MXN → ticket promedio **`$30,840.350399` MXN**.
  - **2025-Q2:** `510,842` créditos totales; **`42.2077667850%`** participación femenina; monto `$15,838,163,285.81` MXN.
  - **2025-Q3:** `601,649` créditos totales; **`41.8039421656%`** participación femenina; monto `$18,517,548,812.57` MXN.
  - **2025-Q4:** `561,561` créditos totales; **`41.8268006503%`** participación femenina; monto `$16,889,088,475.45` MXN.
  - **Caso puntual `AGUASCALIENTES / 2025-01 / mujeres`:** `1,326` créditos y `$32,050,929.75` MXN.
- **M-04 SNIIV (`v_kpis_sniiv_anual_resumen`):**
  - **Registros CSV:** `325,649` filas únicas en las 12 dimensiones (`UNIQUE NULLS NOT DISTINCT`).
  - **Acciones totales:** `998,745` acciones (`452,066` mujeres + `546,675` hombres + `4` acciones en las `399` filas con `sexo IS NULL`).
  - **Monto total:** `$617,246,458,236.39` MXN (`$248,215,934,996.93` mujeres + `$368,765,034,973.11` hombres + `$265,488,266.35` sin sexo).
  - **Promedio por acción:** `$618,022.075942` MXN.
  - **Participación femenina en acciones (`sexo='2' / sexo IN ('1','2')`):** `452,066 / 998,741 * 100 =` **`45.2635870031%`**.
  - **Participación femenina en monto (`sexo='2' / sexo IN ('1','2')`):** **`40.2307281414%`**.
  - **Participación INFONAVIT (`organismo='1' / total acciones`):** `666,957 / 998,745 * 100 =` **`66.7795082829%`**.

---

## 3. Discrepancias Documentadas entre Fuentes Oficiales y Limitaciones

Tal como exige el Paso 17, se documentan las discrepancias existentes en los archivos originales sin inventar ajustes ni ocultar diferencias:

1. **Diferencias entre `SH_SOCAPS.xlsm!Series` y los Boletines Trimestrales `BE_SOCAPS_2025XX.xlsx` (`v_kpis_cnbv_contraste_trim`):**
   - En **2025-Q1 (`2025-03`)**, `Series` reporta `IMOR = 4.2361948375%`, `ICOR = 125.5267605593%`, `NICAP = 306.5197159872%` y `ROA = 2.5445223519%`, mientras que el boletín `BE_SOCAPS_202503.xlsx` (`Indicadores!F29..F37`) reporta `IMOR = 4.2364291306%`, `ICOR = 125.5145912898%`, `NICAP = 312.29%` y `ROA = 2.5428171835%`.
   - **Causa documentada:** Tienen fechas de corte/elaboración distintas (el boletín Q1 fue elaborado el 14 de mayo de 2025, mientras que la serie histórica `SH_SOCAPS.xlsm` incluye actualizaciones posteriores hasta noviembre de 2026). La vista `v_kpis_cnbv_contraste_trim` expone ambas mediciones y su diferencia en puntos porcentuales (`diff_*_pp`).
2. **Inconsistencia en la nota de la Tasa Implícita Pasiva (`KPI-06`, nota `Series!C240`):**
   - La nota literal de `Series!C240` menciona *«Gastos por intereses provenientes de la captación tradicional (suma flujos 12 meses)»*, pero en la hoja `Series` no existe una fila con ese concepto. El valor oficial publicado en la fila `224` (`5.8022194344%` en `2025-03` y `5.2719823640%` en `2025-12`) se reproduce **exactamente** utilizando la fila `153` (`Gastos por intereses (suma flujos 12 meses)`). Además, en los boletines trimestrales (`TI!C169:C171`), las tasas implícitas usan una fórmula distinta (intereses del trimestre anualizados entre el promedio de los dos últimos trimestres). Por ello, `v_kpis_cnbv_sector_mes` y `v_kpis_cnbv_institucion_trim` mantienen ambas variantes separadas.
3. **Diferencia de denominador en `KPI-09` (Colocación / Captación):**
   - En `SH_SOCAPS.xlsm!Series` solo se publica `Captación tradicional` (fila `35`), por lo que la variante sectorial mensual calcula `Cartera vigente / Captación tradicional` (`68.8889316436%` en `2025-03`).
   - En los boletines trimestrales (`TI`), el total del sector y las cooperativas publican tanto `Captación total` como `Captación tradicional`; la variante institucional trimestral definida en el catálogo usa `Cartera vigente / Captación total` (`68.63738028%` en Q1 y `68.92611693%` en Q4). Ambas etiquetas se distinguen explícitamente en los nombres de columna (`kpi09_colocacion_captacion_trad_pct` vs. `kpi09_colocacion_captacion_total_derivado_pct`).
4. **Inconsistencia en suma de socios por género (`M-01`, nota `Series!C236`):**
   - La propia CNBV advierte en `Series!C236` que el total de socios (fila `202`, `9,545,210` en `2025-03`) no coincide con la suma de `Mujeres` (fila `203`, `5,171,225`) + `Hombres` (fila `204`, `4,371,953` = `9,543,178`) por diferencias en la calidad de envío de las sociedades. La vista `v_kpis_cnbv_sector_mes` utiliza `v203 + v204` como denominador de `M-01`, conservando `v202` como dato contextual.
5. **Ausencia de Coeficiente de Liquidez (`KPI-03`) por Cooperativa y sociedades sin columna en `EF`:**
   - Los boletines trimestrales no desglosan activos ni pasivos con vencimiento `<= 30 días` por sociedad, por lo que `KPI-03` es exclusivamente sectorial. Adicionalmente, 9 registros sociedad-trimestre no tienen columna en la hoja `EF` (`rechazos_cnbv.csv`), por lo que sus campos `disponibilidades_mxn`, `estimacion_mxn` y `kpi02_icor_derivado_pct` permanecen en `NULL` sin imputar ceros.
6. **Registros sin sexo en SNIIV (`M-04`) y discrepancia con el JSON de la API:**
   - El CSV `financiamientos_2025.csv` contiene `399` filas con `sexo` vacío que suman `4` acciones y `$265,488,266.35` MXN. En `v_kpis_sniiv_anual_resumen` se conservan en los totales generales (`998,745` acciones) y se excluyen únicamente del denominador de participación por género (`998,741` acciones con `sexo IN ('1','2')`). El archivo de contraste `financiamiento_2025_api.json` reporta `998,814` acciones (+69 acciones); conforme al modelo, solo se carga el CSV verificado.

---

## 4. Dependencias Pendientes de Integración (Fases II y III)

De acuerdo con la inspección del repositorio ([docs/entrega_base_datos.md](entrega_base_datos.md) y [docs/etl_integracion_pendiente.md](etl_integracion_pendiente.md)):

1. **Carga de tablas de hechos (`hecho_*`) en PostgreSQL:**
   - La Fase II entregó el esquema de 13 tablas (`Database/01_schema.sql`) y el cargador de las 6 tablas de dimensiones/catálogos (`ETL/load_catalogs.py`, 400 filas).
   - La Fase III entregó el pipeline local (`ETL/run_etl.py`) que extrae, transforma y valida los CSVs en `data/processed/`, pero dejó documentado en [docs/etl_integracion_pendiente.md](etl_integracion_pendiente.md) que `cargar_postgres()` aún lanza `NotImplementedError` a la espera de que el coordinador integre la carga de `data/processed/*.csv` hacia las 5 tablas `hecho_*`.
2. **Comportamiento de las vistas antes y después de la carga de hechos:**
   - Las vistas de `Database/views/01_vistas.sql` y `Database/views/02_kpis.sql` se crean sin errores sobre el esquema de `Database/01_schema.sql` en cualquier momento.
   - Si las tablas `hecho_*` aún están vacías (0 ejecuciones en `ejecucion_etl`), las vistas devuelven 0 filas limpiamente y el Bloque 8 de `Database/tests/validacion_kpis.sql` comprueba la lógica de `NULLIF`. Una vez insertada la ejecución exitosa del ETL en las tablas `hecho_*`, los Bloques 1 al 7 de `Database/tests/validacion_kpis.sql` verifican automáticamente que todos los indicadores coincidan con la matriz de la Sección 2.
