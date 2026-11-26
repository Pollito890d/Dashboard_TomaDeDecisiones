# Validación de KPIs en SQL — Fase IV (Paso 17)

**Rama:** `feature/fase-4-vistas-kpis`  
**Fecha:** 2026-11-25  
**Estado:** integración completada y validada con datos reales; sin commits ni merges.

## Archivos de la validación

- [`Database/04_validation.sql`](../Database/04_validation.sql): validación atómica de la carga y los KPIs (10 bloques).
- [`Database/tests/validacion_kpis.sql`](../Database/tests/validacion_kpis.sql): suite detallada y **asertiva** de KPIs (8 bloques).
- [`Database/views/01_vistas.sql`](../Database/views/01_vistas.sql) y [`Database/views/02_kpis.sql`](../Database/views/02_kpis.sql): 14 vistas creadas y verificadas.
- [`scripts/run_sql_docker.py`](../scripts/run_sql_docker.py): ejecutor SQL en Windows, donde no hay `psql` local. Valida `Backend/.env` contra el destino local y pasa la contraseña al contenedor Docker `dashboard-postgres` sin imprimirla.

Comandos reproducibles desde la raíz del repositorio:

```powershell
.\.venv\Scripts\python.exe scripts\run_sql_docker.py Database/04_validation.sql
.\.venv\Scripts\python.exe scripts\run_sql_docker.py Database/tests/validacion_kpis.sql
.\.venv\Scripts\python.exe -m pytest ETL/tests -q -s
```

No se ejecutó `ETL/load_catalogs.py` ni se modificaron `data/raw/`, `Frontend/` ni `Database/01_schema.sql`.

---

## 1. Estado real de la instantánea

La carga con `ETL/run_etl.py --cargar` terminó con:

- `ejecucion_etl = 1` fila, `ejecucion_id = 6`, estado `exitosa`.
- `ejecucion_archivo = 19` filas: `14 hechos`, `3 metadato`, `2 contraste`.
- `pg_views = 14`.
- Trazabilidad con `integracion = 'etl-postgres-fase4-1.0'` y los SHA-256 de las cinco salidas en `ejecucion_etl.observaciones`.

| Tabla de hechos | Filas cargadas |
|---|---:|
| `hecho_cnbv_sector_mes` | 598 |
| `hecho_cnbv_institucion_trim` | 620 |
| `hecho_cnbv_total_trim` | 4 |
| `hecho_fonacot_mes` | 792 |
| `hecho_sniiv_mes` | 325649 |

`Database/04_validation.sql` devolvió `VALIDACION_FASE_IV_OK`, ejecución activa `6`, con los 10 bloques en `OK`.  
`Database/tests/validacion_kpis.sql` devolvió `VALIDACION_KPIS_ASERTIVA_OK`, ejecución activa `6`, con los 8 bloques en `OK`.  
La suite Python completa devolvió `28 passed in 85.05s`.

La reejecución de `ETL/run_etl.py --cargar` con los mismos hashes devolvió `omitida_idempotente`, ejecución `6`, y no insertó filas. El rollback con fallo inducido dejó `ejecucion_etl = 1` y los cinco recuentos sin cambios.

---

## 2. Tolerancias aplicadas

| Comparación | Tolerancia | Motivo |
|---|---:|---|
| KPI calculado vs. catálogo (`docs/catalogo_kpis.md`) | `1e-9 pp` | Precisión del cálculo y del valor esperado a 10 decimales. |
| KPI calculado vs. fila publicada en `Series` | `5e-7 pp` | `Series` almacena el indicador publicado con `numeric(20,6)`. |
| Derivados institucionales CPM (colocación/captación e ICOR) | `1e-8 pp` | Redondeo de los saldos publicados en miles de pesos. |
| Saldos y denominadores `prom12` | `1e-6 MXN` | Escala `numeric(30,6)` de la base. |
| Porcentajes y participaciones FONACOT/SNIIV | `1e-10 pp` | Escala `numeric(20,10)`. |
| Boletín vs. Σ activo de sociedades | `1 MXN` | Diferencia de redondeo en el total publicado. |

Las diferencias entre `Series` y los boletines **no se fuerzan a cero**: sus fechas de corte/elaboración son distintas. Se exige que ambas mediciones estén presentes y se documenta su diferencia.

---

## 3. Resultados de los casos de control

### 3.1 Sectorial mensual (`v_kpis_cnbv_sector_mes`)

20 casos: KPI-01…KPI-09 y M-01 en `2025-03` y `2025-12`.

| KPI | 2025-03 | 2025-12 |
|---|---:|---:|
| KPI-01 IMOR | 4.2361948375% | 4.0549697085% |
| KPI-02 ICOR | 125.5267605593% | 127.5907268062% |
| KPI-03 Liquidez | 37.6929816952% | 35.6261802328% |
| KPI-04 NICAP | 306.5197159872% | 300.2533349855% |
| KPI-05 Tasa activa | 18.1688146566% | 18.2304798424% |
| KPI-06 Tasa pasiva | 5.8022194344% | 5.2719823640% |
| KPI-07 Capital/Activo | 18.0284996299% | 17.8527845893% |
| KPI-08 ROA | 2.5445223519% | 2.1536581163% |
| KPI-09 Colocación/Captación tradicional | 68.8889316436% | 69.2030772470% |
| M-01 Participación femenina | 54.1876615945% | 54.2112064685% |

Evidencia de la suite: `max diff catálogo 0.0000000000 pp`, `max diff Series 0.0000004407 pp`.  
M-01 en 2025-12 usa `5,371,242 / (5,371,242 + 4,536,750)`; el par anterior `5,375,834 / 4,540,628` era incorrecto.

Denominadores móviles de 12 saldos consecutivos:

| Corte | `prom12(13)` MXN | `prom12(35)` MXN | `prom12(5)` MXN |
|---|---:|---:|---:|
| 2025-03 | 154141597205.16666667 | 219038275966.91666667 | 278842081529.58333333 |
| 2025-12 | 167139479473.08333333 | 241771565852.50000000 | 305801657665.00000000 |

Los 12 cortes de 2025 tienen ventana completa. Diferencia máxima observada: `0.00000033 MXN`.

### 3.2 Caja Popular Mexicana (`clave_seis = '029056'`)

| Valor | 2025-Q1 | 2025-Q4 |
|---|---:|---:|
| Socios | 3,692,848 | 3,873,780 |
| Activo total | 114,228,216,874 MXN | 126,888,191,520 MXN |
| KPI-01 IMOR publicado | 3.2047661254% | 2.8122274044% |
| KPI-04 NICAP / categoría | 252.3931729344% / 1 | 235.6833561551% / 1 |
| M-02 Participación por activo | 38.7596208040% | 39.4283734536% |
| KPI-09 derivado (colocación/captación total) | 61.5092339861% | 62.9331980162% |
| KPI-02 derivado (ICOR) | 149.1237873703% | 158.9652881400% |

Los valores redondeados del catálogo son `61.5092339937`, `62.9331980237`, `149.1237873698` y `158.9652881365`; la diferencia máxima observada es `0.0000000076 pp`, dentro de `1e-8 pp`. Las etiquetas trimestrales se construyen con año (`2025-Q1`…`2025-Q4`).

### 3.3 Contexto externo

**M-03 FONACOT**

| Trimestre | Créditos | Monto MXN | Participación femenina | Ticket promedio |
|---|---:|---:|---:|---:|
| 2025-Q1 | 503,416 | 15,525,525,836.55 | 40.9694964006% | 30,840.350399 |
| 2025-Q2 | 510,842 | 15,838,163,285.81 | 42.2077667850% | 31,004.035075 |
| 2025-Q3 | 601,649 | 18,517,548,812.57 | 41.8039421656% | 30,777.993170 |
| 2025-Q4 | 561,561 | 16,889,088,475.45 | 41.8268006503% | 30,075.251799 |

Caso puntual: `AGUASCALIENTES / 2025-01 / mujeres` = 1,326 créditos y 32,050,929.75 MXN. `APP MOVIL` se separa del total por entidad.

**M-04 SNIIV**

- 325,649 filas; 998,745 acciones; 617,246,458,236.39 MXN; promedio 618,022.075942 MXN por acción.
- Mujeres: 452,066 acciones de 998,741 con sexo definido → **45.2635868559%**; monto 248,215,934,996.93 MXN → **40.2307278633%**.
- Hombres: 546,675 acciones y 368,765,034,973.11 MXN.
- Sin sexo: 399 filas, 4 acciones, 265,488,266.35 MXN; se conservan en los totales y se excluyen solo del denominador por género.
- INFONAVIT: 666,957 acciones → **66.7795082829%**.

Los valores anteriores `45.2635870031%` y `40.2307281414%` eran incorrectos.

---

## 4. Discrepancias documentadas entre fuentes

1. `Series` y los boletines tienen fechas de elaboración distintas. En Q1, por ejemplo, `Series` publica IMOR `4.2361948375%`, ICOR `125.5267605593%`, NICAP `306.5197159872%` y ROA `2.5445223519%`, mientras el boletín publica `4.2364291306%`, `125.5145912898%`, `312.29%` y `2.5428171835%`. La vista `v_kpis_cnbv_contraste_trim` conserva ambas mediciones y sus diferencias.
2. El activo de `Series` difiere del boletín (hasta `178,825,658.0002 MXN` en Q1), pero el boletín concilia con la suma de las 155 sociedades dentro de `±1 MXN`.
3. KPI-06: la nota `Series!C240` menciona gastos de captación tradicional, pero el valor publicado solo se reproduce con la fila 153 (`Gastos por intereses`, 12 meses). Se documenta la inconsistencia sin inventar otra fórmula.
4. KPI-09 usa captación tradicional en la variante sectorial mensual y captación total en la derivada institucional trimestral; los nombres de columna distinguen ambas.
5. M-01: la fila 202 (`Total de socios`) no coincide con `203 + 204` por calidad de envío; el denominador es la suma de componentes.
6. KPI-03 no es reproducible por cooperativa: los boletines no publican activos/pasivos líquidos con corte ≤30 días.
7. SNIIV: el JSON de contraste de la API reporta 998,814 acciones (69 más que el CSV); conforme al modelo se carga solo el CSV verificado.

---

## 5. Carácter asertivo de la suite

La suite ya no devuelve `REVISAR_DIFERENCIA` ni `SIN_DATOS_EN_BD` como resultado aceptable:

- Si no hay ejecución exitosa activa, falla con `RAISE EXCEPTION`.
- Si falta una fila, una vista, un saldo, una fila publicada o un derivado, falla con `RAISE EXCEPTION`.
- Si una diferencia supera la tolerancia correspondiente, falla con `RAISE EXCEPTION`.
- Todo el archivo corre en una transacción con `pg_advisory_xact_lock(81370611)`: un fallo no deja cambios.

Control negativo ejecutado sobre una copia temporal de la suite, con KPI-09 2025-12 cambiado de `69.2030772470` a `69.2030772490` (diferencia inducida de `2e-9 pp`):

```text
ERROR:  2025-12/KPI-09 catálogo 69.2030772490 vs SQL 69.2030772470 (diff 0.0000000020 pp)
CONTEXT:  PL/pgSQL function inline_code_block line 54 at RAISE
Fallo al ejecutar ...validacion_kpis_fallo_control.sql (psql devolvió 3)
EXIT_CODE=3
```

Una desviación de `1e-10 pp` sí pasa, porque está dentro de la tolerancia de `1e-9 pp`; el control se ajustó a `2e-9 pp` para verificar el fallo. El archivo modificado quedó solo en `%TEMP%/opencode`, nunca en el repositorio.

`Database/04_validation.sql` incluye además un bloque de rollback con savepoint: inserta una fila inducida en una tabla temporal, la revierte y comprueba que no persistió. El cargador usa el mismo mecanismo en sus pruebas unitarias.

---

## 6. Cobertura completada

La sección anterior del documento dejaba la integración como pendiente. Esa condición ya no aplica:

- Carga de las cinco tablas de hechos: completada (`ETL/load_facts.py`).
- Idempotencia por SHA-256: verificada.
- Rollback atómico: verificado.
- FK, nulos, grano y precisión: verificados en la carga y en SQL.
- Vistas y KPIs: creadas, corregidas y validadas.
- Etiquetas trimestrales con año: corregidas y validadas.
- Pruebas Python y SQL: ejecutadas con éxito.

No quedan dependencias de Fases II–IV para este punto de control. La API FastAPI y el consumo desde `Frontend/` permanecen fuera de este paso.
