# Catálogo definitivo de KPIs — Paso 05

**Fecha:** 2026-11-25  
**Objetivo:** seleccionar indicadores calculables con datos abiertos reales para el dashboard de liquidez, morosidad y toma de decisiones.  
**Alcance:** solo lectura, cálculo y documentación. No se modificaron originales, no se implementó PostgreSQL, ETL de carga, backend ni frontend, no se generaron datos sintéticos y no se realizaron commits.

Fuentes consultadas: `docs/perfil_datos.md`, `docs/auditoria.md`, `data/raw/manifest.json`, `data/raw/cnbv/SH_SOCAPS.xlsm`, los cuatro boletines `BE_SOCAPS_202503.xlsx`, `BE_SOCAPS_202506.xlsx`, `BE_SOCAPS_202509.xlsx` y `BE_SOCAPS_202512.xlsx`, los 8 CSV de `data/raw/fonacot/` y `data/raw/sniiv/financiamientos_2025.csv` con su diccionario.

---

## 1. Decisiones de modelo

| Decisión | Detalle |
|---|---|
| Dos universos separados | **Sectorial mensual**: `SH_SOCAPS.xlsm`, hoja `Series`, fila 3 `SISTEMA SOCAPS` (`Series!C3`), sin dimensión institución. **Institucional trimestral**: boletines `BE_SOCAPS_20XX.xlsx`, con clave y nombre de sociedad. No se mezclan en una sola serie. |
| Unidades | `Series` expresa saldos en **millones de pesos, inferido** del multiplicador `1,000,000` en `Series!B3`; boletines indican **miles de pesos** en sus encabezados; FONACOT y SNIIV ya están en **pesos**. Todo se normaliza a pesos al presentar importes; los ratios son escala-invariant. |
| Saldos vs. flujos | Los saldos se toman **al cierre del periodo**; nunca se suman saldos históricos. Los flujos de 12 meses se usan solo donde la nota oficial lo exige (ROA y tasas implícitas). |
| Ventanas móviles | Para un corte `YYYY-MM`, la ventana de 12 meses incluye ese mes y los 11 anteriores. En `Series`, 2025-03 usa `2024-04 … 2025-03`. Se promedian **saldos**, nunca tasas ya calculadas. |
| Contraste oficial | Los valores publicados en `Series` (filas 177, 185, 193, 196, 198, 210, 217, 224) se reproducen exactamente al recomputarlos. Los boletines tienen **fechas de elaboración y cortes distintos** (p. ej., Q1 del 14 de mayo de 2025 frente a `SH_SOCAPS` del 04 de noviembre de 2026); sus diferencias se reportan, no se atribuyen a reprocesos sin evidencia. |
| Umbrales | Solo NICAP tiene umbral normativo documentado en el propio archivo. Para el resto se usa el **rango observado en 2025** como banda de monitoreo, explícitamente **no regulatoria**. No se traslada la meta sintética del mock (`80%`). |
| Invención de fórmulas | Ninguna. La tasa pasiva es el único caso con inconsistencia literal entre nota y campo; se documenta y se usa el campo que reproduce el valor publicado. |
| Columnas institucionales | La posición de las columnas **no es fija entre boletines**: Q1/Q3/Q4 comparten un diseño, Q2 tiene una columna vacía adicional al inicio de `TI` y Q3 tiene una columna menos al inicio de `Instituciones (1)`, `Instituciones (2)`, `Capitalización` y `EF`. La lectura debe hacerse por **texto de encabezado**, nunca por letra fija. |
| Cobertura institucional | IMOR, NICAP/categoría, número de socios, saldos y tasas implícitas están publicados por sociedad. ICOR y colocación/captación son **derivables** de campos oficiales. La liquidez del KPI-03 **no es reproducible por cooperativa** porque los boletines no publican activos/pasivos de corto plazo con el corte ≤30 días de la nota `Series!C233`. |

### Regla de presentación de umbrales

- **`regulatorio`**: únicamente NICAP. El texto de la nota está en `Capitalización!C171` en Q1 y en `C172` en Q2–Q4 (el marcador `1/` está en la columna B); las categorías en `C173:C176` (Q1) y `C174:C177` (Q2–Q4). Texto verificado en los cuatro boletines: el índice «debe ser superior a 100% para considerar que el capital cubre adecuadamente los riesgos»; categoría 1 `≥150%`, categoría 2 `≥100% y <150%`, categoría 3 `≥50% y <100%`, categoría 4 `<50%`.
- **`observado_2025`**: mínimo, mediana y máximo calculados con los 12 cortes mensuales de 2025. Se dibuja como banda de contexto, no como línea de cumplimiento.
- **`sin_umbral`**: métricas de FONACOT/SNIIV y participación femenina: solo se describe su evolución.

---

## 2. KPIs financieros del sector (mensuales, `Series`)

Convención: `v(fila)` = valor de la fila en la columna del corte; `prom12(fila)` = promedio de los 12 saldos mensuales que terminan en ese corte. Todas las filas son 1-based.

### KPI-01 · Índice de Morosidad (IMOR)

- **Objetivo:** monitorear la fracción de la cartera total que está vencida.
- **Fórmula:** `v(17) / v(9) × 100`. Nota oficial en `Series!C230`.
- **Fuente:** `SH_SOCAPS.xlsm!Series`. `Cartera de crédito vencida` fila 17, código `135000000000`; `Cartera de crédito total` fila 9, sin código en la columna A.
- **Unidad:** `%`. Saldos en millones MXN (inferido).
- **Granularidad / periodicidad:** sector consolidado, mensual. Columnas 2025: índices 147–158 (filas 4 = fechas reales).
- **Filtros:** `SISTEMA SOCAPS` (`Series!C3`); sin filtro por institución, sucursal ni tipo de crédito.
- **Interpretación:** mayor valor implica mayor presión de morosidad sobre la cartera; debe leerse junto con ICOR (KPI-02).
- **Nulos:** ninguno en 2025. Si `v(9)=0`, no se calcula y se reporta como no disponible; no se imputa.
- **Umbral:** `observado_2025`: mín 4.054970%, mediana 4.207192%, máx 4.252230%. No existe umbral regulatorio en los archivos.
- **Ejemplo (2025-03):** `7,097.165133 / 167,536.324586 × 100 = 4.2361948375%`, igual al valor publicado en la fila 177 de la columna del corte. Boletín Q1 `Indicadores!F29 = 4.2364291306%` (corte distinto). Diciembre: `4.0549697085%`, igual al publicado.

### KPI-02 · Índice de Cobertura (ICOR)

- **Objetivo:** evaluar provisiones frente a cartera vencida.
- **Fórmula:** `ABS(v(21)) / v(17) × 100`. Nota en `Series!C232`.
- **Fuente:** `Series` fila 21 `Estimación preventiva para riesgos crediticios`, código `139000000000` (valor negativo en el archivo, se usa valor absoluto); fila 17 como denominador.
- **Unidad:** `%`; millones MXN (inferido).
- **Granularidad / periodicidad / filtros:** igual a KPI-01.
- **Interpretación:** 100% significa provisiones equivalentes a la cartera vencida (lectura de la fórmula, no umbral normativo). Valores mayores indican mayor colchón contable.
- **Nulos:** ninguno en 2025. Si `v(17)=0`, no se calcula.
- **Umbral:** `observado_2025`: mín 123.837477%, mediana 126.418277%, máx 128.320023%.
- **Ejemplo (2025-03):** `8,908.841483 / 7,097.165133 × 100 = 125.5267605593%`, idéntico a la fila 185. Boletín Q1 `Indicadores!F31 = 125.5145912898%`. Diciembre: `127.5907268062%` en `Series` vs `127.5903866022%` en boletín.

### KPI-03 · Coeficiente de liquidez

- **Objetivo:** medir la capacidad de atender pasivos de corto plazo con activos líquidos de corto plazo.
- **Fórmula:** `v(194) / v(195) × 100`. Nota en `Series!C233`: activos líquidos = disponibilidades + inversiones en valores ≤30 días + deudores por reporto ≤30 días; pasivos = depósitos de corto plazo + préstamos bancarios y de otros organismos + otros pasivos.
- **Fuente:** `Series` filas 194 `Activos líquidos de corto plazo` y 195 `Pasivos de corto plazo` (ambas sin código en columna A). La fila 6 `Disponibilidades` (código `110000000000`) es un componente, no el KPI.
- **Unidad:** `%`; millones MXN (inferido).
- **Granularidad / periodicidad / filtros:** sector consolidado, mensual; mismo corte que KPI-01.
- **Interpretación:** el cociente cae si crecen los pasivos de corto plazo más rápido que los activos líquidos; se complementa con KPI-01 y KPI-09.
- **Nulos:** ninguno en 2025. Si `v(195)=0`, no se calcula.
- **Umbral:** `observado_2025`: mín 35.626180%, mediana 37.515435%, máx 38.727424%. El `80%` del mock no tiene respaldo en las fuentes y se descarta.
- **Ejemplo (2025-03):** `53,501.729460 / 141,940.825729 × 100 = 37.6929816952%`, idéntico a la fila 193. Diciembre: `35.6261802328%`, también idéntico al publicado.

### KPI-04 · Nivel de Capitalización (NICAP)

- **Objetivo:** verificar la cobertura de riesgos con capital neto.
- **Fórmula:** `v(212) / v(213) × 100`. Nota en `Series!C237` y en boletines `Capitalización!C171` (Q1) / `C172` (Q2–Q4).
- **Fuente:** `Series` fila 212 `Capital neto` y 213 `Requerimiento total de capital por riesgos`; publicado en fila 210. Contraste institucional: `Capitalización`, columna de la fecha actual en la fila `Total general` o de la sociedad, y columna `Categoría del Nivel de Capitalización` (posiciones por trimestre en 3.1).
- **Unidad:** `%`; millones MXN (inferido) en `Series`, miles en boletín.
- **Granularidad / periodicidad:** sectorial mensual en `Series`; institucional trimestral en `Capitalización`.
- **Filtros:** `SISTEMA SOCAPS` en `Series`; en boletín, `Total general` para el agregado o `Clave de la Sociedad` para una institución.
- **Interpretación:** mide capital neto por cada peso de requerimiento por riesgos.
- **Nulos:** ninguno en 2025. Si `v(213)=0`, no se calcula. Las instituciones que no enviaron información se excluyen del ranking, pero no del `Total general`.
- **Umbral — `regulatorio` (texto literal de `Capitalización!C171` y `C173:C176` en Q1; `C172` y `C174:C177` en Q2–Q4):** el índice **debe ser superior a 100%** para considerar que el capital cubre adecuadamente los riesgos; **categoría 1 ≥150%**, categoría 2 ≥100% y <150%, categoría 3 ≥50% y <100%, categoría 4 <50%.
- **Ejemplo (2025-03):** `51,548.202787 / 16,817.255171 × 100 = 306.5197159872%`, idéntico a la fila 210. Boletín Q1 `Capitalización!F12 = 312.29%`; Q4 `F13 = 300.2517395283%`. Rango observado 2025 en `Series`: 296.465581%–312.468669%, mediana 299.734894% (todos por encima del umbral normativo).

### KPI-05 · Tasa implícita activa de cartera vigente

- **Objetivo:** expresar en tasa anualizada el rendimiento de la cartera vigente.
- **Fórmula:** `v(145) / prom12(13) × 100`. Nota en `Series!C239`. No se promedia la tasa publicada en la fila 217.
- **Fuente:** fila 145 `Intereses cobrados por cartera vigente (suma flujos 12 meses)`; fila 13 `Cartera de crédito vigente`, código `130000000000` (saldo mensual).
- **Unidad:** `%` anualizado; numerador y saldos en millones MXN (inferido).
- **Granularidad / periodicidad:** sectorial, mensual con ventana móvil de 12 saldos.
- **Filtros:** `SISTEMA SOCAPS`; sin segmento de crédito.
- **Interpretación:** tasa implícita cobrada sobre saldos vigentes; se compara con KPI-06 para obtener el spread (KPI-05 − KPI-06).
- **Nulos:** ninguno en 2025. La ventana requiere 12 observaciones; antes de completarse, no se calcula. Si `prom12(13)=0`, no se calcula.
- **Umbral:** `observado_2025`: mín 18.142606%, mediana 18.218037%, máx 18.248535%. Sin umbral regulatorio.
- **Ejemplo (2025-03):** `prom12(13) = 154,141.5972051667`; `28,005.701105 / 154,141.5972051667 × 100 = 18.1688146566%`, idéntico a la fila 217. El spread mensual resultante es `12.3665952222 pp`; rango observado del spread: 12.329113–12.958497 pp, mediana 12.538766 pp.
- **Ejemplo (2025-12):** `prom12(13) = 167,139.47947308333333` millones (`167,139,479,473.08333333 MXN`); `30,455.650910 / 167,139.47947308333333 × 100 = 18.2304798424%`, idéntico al publicado. El valor anterior `167,058.966574750000` millones era incorrecto.

### KPI-06 · Tasa implícita pasiva

- **Objetivo:** expresar en tasa anualizada el costo de la captación.
- **Fórmula usada:** `v(153) / prom12(35) × 100`. Valor publicado en fila 224.
- **Fuente:** fila 153 `Gastos por intereses (suma flujos 12 meses)`; fila 35 `Captación tradicional`, código `210000000000` (saldo mensual).
- **Inconsistencia documentada:** la nota `Series!C240` dice «Gastos por intereses provenientes de la captación tradicional (suma flujos 12 meses)», pero no existe un concepto con ese nombre. El valor publicado se reproduce **exactamente** con la fila 153 (total de gastos por intereses). Si se usaran solo los conceptos de depósitos, filas 155 + 157 (`12,591.568217` en 2025-03), el resultado sería `5.7485698157%`, distinto del `5.8022194344%` publicado. No se inventa una tercera fórmula: se usa la que replica el indicador oficial y se conserva esta nota como limitación.
- **Unidad / granularidad / periodicidad:** `%` anualizado; sectorial, mensual con ventana de 12 saldos.
- **Filtros:** `SISTEMA SOCAPS`; sin segmento de depósitos en el numerador.
- **Interpretación:** costo implícito de los recursos captados; junto con KPI-05 forma el margen de intermediación.
- **Nulos:** misma regla que KPI-05. Sin valores faltantes en 2025.
- **Umbral:** `observado_2025`: mín 5.271982%, mediana 5.679272%, máx 5.845541%. Sin umbral regulatorio.
- **Ejemplo (2025-03):** `prom12(35) = 219,038.2759669167`; `12,709.081417 / 219,038.2759669167 × 100 = 5.8022194344%`, idéntico a la fila 224.
- **Ejemplo (2025-12):** `prom12(35) = 241,771.56585250000000` millones (`241,771,565,852.50000000 MXN`); `12,802.380479 / 241,771.56585250000000 × 100 = 5.2719823640%`, idéntico al publicado. El valor anterior `242,838.125926166667` millones era incorrecto.
- **Variante institucional (no mezclar):** en `TI!C169:C171` la nota define las tasas como «intereses del trimestre actual anualizados / promedio de los dos últimos trimestres». Q1: `TI!G9 = 17.9895392192%` (activa), `TI!K9 = 5.5825586747%` (captación total) y `TI!O9 = 5.5608803563%` (captación tradicional). Q4: `18.5386640823%`, `4.8817553140%` y `4.8677370319%`.

### KPI-07 · Capital contable / Activo total

- **Objetivo:** medir la participación del capital contable en el activo (apalancamiento contable inverso).
- **Fórmula:** `v(46) / v(5) × 100`. Publicado en fila 198.
- **Fuente:** fila 46 `CAPITAL CONTABLE`, código `29100036`; fila 5 `ACTIVO`, código `100000000000`.
- **Unidad:** `%`; millones MXN (inferido).
- **Granularidad / periodicidad / filtros:** sectorial, mensual, `SISTEMA SOCAPS`.
- **Interpretación:** mayor cociente implica menor dependencia de pasivos; se complementa con NICAP, que usa requerimientos de riesgo en lugar de activo total.
- **Nulos:** ninguno en 2025. Si `v(5)=0`, no se calcula.
- **Umbral:** `observado_2025`: mín 17.684638%, mediana 17.743387%, máx 18.426879%. Sin umbral regulatorio en el archivo.
- **Ejemplo (2025-03):** `53,163.909164 / 294,888.150735 × 100 = 18.0284996299%`, idéntico a la fila 198. Diciembre: `17.8527845893%`, idéntico al publicado.

### KPI-08 · Rendimiento sobre el activo (ROA)

- **Objetivo:** evaluar la generación de resultado neto respecto al activo productivo.
- **Fórmula:** `v(141) / prom12(5) × 100`. Nota en `Series!C234`.
- **Fuente:** fila 141 `Resultado neto (suma flujos 12 meses)`; fila 5 `ACTIVO` (saldo mensual). Publicado en fila 196.
- **Unidad:** `%` anualizado; millones MXN (inferido).
- **Granularidad / periodicidad:** sectorial, mensual con ventana de 12 saldos.
- **Filtros:** `SISTEMA SOCAPS`.
- **Interpretación:** eficiencia del activo en la generación de resultado; caídas sostenidas se leen junto con IMOR y tasa activa.
- **Nulos:** misma regla de ventana que KPI-05; sin faltantes en 2025.
- **Umbral:** `observado_2025`: mín 2.153658%, mediana 2.333860%, máx 2.566138%. Sin umbral regulatorio.
- **Ejemplo (2025-03):** `7,095.199091 / 278,842.0815295833 × 100 = 2.5445223519%`, idéntico a la fila 196. Boletín Q1 `Indicadores!F33 = 2.5428171835%`.
- **Ejemplo (2025-12):** `prom12(5) = 305,801.65766500000000` millones (`305,801,657,665.00000000 MXN`); `6,646.831648 / 305,801.65766500000000 × 100 = 2.1536581163%` en `Series` vs `2.1540614102%` en boletín. El valor anterior `308,629.837937000000` millones era incorrecto.

### KPI-09 · Índice colocación / captación

- **Objetivo:** mostrar qué parte de la captación se transforma en cartera vigente.
- **Fórmulas:**
  - Sectorial mensual: `v(13) / v(35) × 100` (cartera vigente / captación tradicional, ambos saldos de cierre).
  - Institucional trimestral: `cartera vigente / captación total × 100` en la fila `Total del Sector` o de la sociedad (columnas 4 y 8 en base 0 en Q1/Q3/Q4; 5 y 9 en Q2, según el encabezado).
- **Fuente:** `Series` filas 13 y 35; boletines `TI`, columnas `Cartera Vigente (miles de pesos)` y `Captación total (miles de pesos)`, localizadas por encabezado en la fila de la sociedad o `Total del Sector`.
- **Unidad:** `%`. Los importes subyacentes se normalizan a pesos (`Series ×1,000,000`; boletín ×1,000).
- **Granularidad / periodicidad:** dos vistas: sectorial mensual e institucional trimestral. La denominación del denominador cambia entre ambas y debe mostrarse en la etiqueta.
- **Filtros:** sectorial: `SISTEMA SOCAPS`; institucional: fila `Total del Sector` o una clave de sociedad.
- **Interpretación:** indicador de monitoreo propio para seguir el uso de los recursos captados; no es un ratio regulatorio. No debe leerse sin KPI-03 (liquidez) ni KPI-01 (morosidad).
- **Nulos:** ninguno en 2025. Si la captación es cero, no se calcula. No se promedian saldos de periodos distintos.
- **Umbral:** `observado_2025` para la variante sectorial: mín 68.540369%, mediana 69.138577%, máx 69.734382%. La meta `80%` del mock se descarta por carecer de fuente.
- **Ejemplos:**
  - Sectorial 2025-03: `160,439.159453 / 232,895.409502 × 100 = 68.8889316436%`.
  - Sectorial 2025-12: `69.2030772470%` (cálculo SQL verificado en `v_kpis_cnbv_sector_mes`; el valor anterior `69.2030772471%` estaba desactualizado).
  - Institucional Q1: `160,349,703.595 / 233,618,624.338 × 100 = 68.63738028%` (miles cancelados en el cociente).
  - Institucional Q4: `176,510,274.039 / 256,086,200.564 × 100 = 68.92611693%`.

---

## 3. Métricas complementarias y cobertura institucional

### M-01 · Participación femenina en el sector (socios reportados)

- **Fórmula:** `v(203) / (v(203) + v(204)) × 100`.
- **Fuente:** `Series` filas 203 `Mujeres` y 204 `Hombres`. No existe una fila publicada con el cociente.
- **Unidad / granularidad:** `%`; sectorial mensual.
- **Tratamiento especial:** la nota `Series!C236` advierte que el total de socios puede no coincidir con la suma de componentes por calidad de envío. En 2025-03, `v(202)=9,545,210` mientras que `v(203)+v(204)=9,543,178`; el denominador de esta métrica es la suma de componentes, no `v(202)`.
- **Nulos:** ninguno en 2025. Si la suma es cero, no se calcula.
- **Umbral:** `sin_umbral`; rango observado 2025: 54.144377%–54.288636%, mediana 54.199434%.
- **Ejemplo (2025-03):** `5,171,225 / (5,171,225 + 4,371,953) × 100 = 54.1876615945%`.
- **Ejemplo (2025-12):** `5,371,242 / (5,371,242 + 4,536,750) × 100 = 54.2112064685%` (verificado en PostgreSQL; el valor anterior `5,375,834 / 4,540,628` era incorrecto).

### M-02 · Participación por activo de cada institución

- **Fórmula:** `Activo de la sociedad / Activo TOTAL × 100`; el boletín también publica el resultado en la columna `Participación %`.
- **Fuente:** boletines, hoja `Instituciones (1)`, fila de encabezados de fechas, `Activo Total (miles de pesos)` y `Participación % ...` en la columna de fecha actual (posiciones por trimestre en 3.1). Fila `TOTAL` y fila de la institución (p. ej., `Caja Popular Mexicana`).
- **Unidad / granularidad:** `%`; institucional trimestral. Importes en miles MXN; el cociente es independiente de la escala.
- **Nulos:** instituciones que no enviaron información se excluyen del ranking; el `TOTAL` publicado se conserva.
- **Umbral:** `sin_umbral`; solo comparación entre cortes.
- **Ejemplos:** Q1 `114,228,216.874 / 294,709,325.077 × 100 = 38.7596208040%` (= `Instituciones (1)!N15`). Q4 `126,888,191.520 / 321,819,492.933 × 100 = 39.4283734536%` (= `Instituciones (1)!N16`).

### M-03 · FONACOT: créditos, monto y participación femenina

- **Fuentes (8 CSV reales):**
  - Q1: `Trabajadores por género y entidad federativa.csv` e `Importe de créditos ejercidos por género y entidad federativa.csv`.
  - Q2: `trabajadores_genero_entidad_federativa.csv` e `importe_creditos_genero_entidad_federativa.csv`.
  - Q3 y Q4: `datos_abiertos_trabajadores_con_credito_genero_y_entidad_federativa_3er_TRIM_2025.csv` / `_4to_TRIM_2025.csv` y sus homólogos `datos_abiertos_importe_credito_...`.
- **Campos exactos:** `ENTIDAD_FEDERATIVA` y columnas de mes y género (`Ene_mujeres`, `Ene_hombres`, …, `Dic_mujeres`, `Dic_hombres`). El archivo de trabajadores contiene **número de créditos**; el de importe contiene **pesos**.
- **Fórmulas:**
  - `créditos_totales = Σ(*_mujeres) + Σ(*_hombres)` en el archivo de trabajadores.
  - `participación_femenina = Σ(*_mujeres) / créditos_totales × 100`.
  - `monto_total_pesos = Σ(*_mujeres) + Σ(*_hombres)` en el archivo de importe.
  - `ticket_promedio = monto_total_pesos / créditos_totales`.
- **Granularidad / periodicidad:** entidad (o canal) × mes × género; publicación trimestral, datos mensuales dentro del trimestre.
- **Filtros y limpieza:** `VERACRUZ` se canoniza como `VERACRUZ DE IGNACIO DE LA LLAVE`. `APP MOVIL` se conserva en el total nacional porque aparece como fila del archivo; para comparativas entre entidades debe excluirse y recalcularse.
- **Nulos:** las cuatro parejas de archivos de 2025 tienen 33 filas y **0 celdas vacías** en las columnas de género. Si apareciera un vacío, se reporta como faltante y se documenta; no se imputa automáticamente como cero.
- **Umbral:** `sin_umbral`. Participación femenina observada por trimestre: 40.969496% (Q1), 42.207767% (Q2), 41.803942% (Q3), 41.826801% (Q4). Ticket observado: 30,075.251799–31,004.035075 pesos.
- **Ejemplo reproducible Q1:** `503,416` créditos, `206,247` mujeres → `40.969496%`; monto `15,525,525,836.55` pesos → ticket `30,840.350399` pesos. Fila `AGUASCALIENTES`, columna `Ene_mujeres`: `1,326` créditos y `32,050,929.75` pesos (misma columna en ambos archivos, con distinta unidad).

### M-04 · SNIIV: financiamientos para vivienda

- **Fuentes:** `financiamientos_2025.csv` (hechos) y `diccionario_financiamiento.xlsx`, hoja `Financiamientos` (catálogos).
- **Campos exactos:** `acciones`, `monto` (pesos), `sexo` (1=Hombre, 2=Mujer; en el CSV aparece vacío en 399 filas y el diccionario incluye `No disponible`), `organismo` (1=Instituto del Fondo Nacional de la Vivienda para los Trabajadores, INFONAVIT), además de año, mes, entidad, municipio y rangos.
- **Fórmulas:**
  - `acciones_totales = Σ acciones`; `monto_total_pesos = Σ monto`.
  - `participación_mujeres_acciones = Σ acciones[sexo=2] / Σ acciones[sexo∈{1,2}] × 100`.
  - `participación_mujeres_monto = Σ monto[sexo=2] / Σ monto[sexo∈{1,2}] × 100`.
  - `participación_infonavit = Σ acciones[organismo=1] / acciones_totales × 100`.
  - `promedio_por_accion = monto_total_pesos / acciones_totales`.
- **Granularidad / periodicidad:** año–mes–entidad–municipio–sexo–rangos–organismo; archivo anual 2025.
- **Filtros:** ninguno para el total nacional; los cortes por entidad, sexo u organismo son dimensiones del propio archivo.
- **Nulos y aclaración frente al perfilado:** `docs/perfil_datos.md` reporta **399 registros (filas) con `sexo` nulo**; al agregar medidas, esas 399 filas suman **4 acciones y 265,488,266.35 pesos**. No hay contradicción: una cifra cuenta **filas** y la otra **acciones**. Se conservan en los totales generales (`998,745` acciones, `617,246,458,236.39` pesos) y se excluyen solo del denominador de género (`sexo ∈ {1,2}`). No se imputan a hombre o mujer.
- **Umbral:** `sin_umbral`.
- **Ejemplo reproducible:** 325,649 filas; 998,745 acciones; 617,246,458,236.39 pesos; promedio 618,022.075942 pesos por acción. Mujeres: 452,066 acciones (`452,066 / 998,741 × 100 = 45.2635868559%`) y 248,215,934,996.93 pesos (`40.2307278633%`). Hombres: 546,675 acciones y 368,765,034,973.11 pesos. INFONAVIT: 666,957 acciones (66.7795082829%). Los valores anteriores `45.263587%` y `40.230728%` se conservan solo como redondeo a seis decimales; la validación SQL usa los valores completos.

### 3.1 Cobertura institucional por cooperativa (boletines 2025)

Se verificaron los cuatro boletines (`202503`, `202506`, `202509`, `202512`). El ejemplo es **Caja Popular Mexicana**, clave `29056`, en el corte Q1 (marzo 2025) y Q4 (diciembre 2025). Todos los importes de los boletines están en **miles de pesos**; entre paréntesis se da el equivalente en pesos.

| Indicador / campo | Situación | Hoja y campo exacto | Ejemplo Q1 (marzo 2025) | Ejemplo Q4 (diciembre 2025) |
|---|---|---|---|---|
| Número de socios | **Publicado** | `Instituciones (1)`, `Número de Socios`, tercera columna del grupo de tres fechas | `G15` = 3,692,848 | `G16` = 3,873,780 |
| Activo total | **Publicado** | `Instituciones (1)`, `Activo Total (miles de pesos)`, fecha actual; también `EF!ACTIVO` | `M15` = 114,228,216.874 ($114,228,216,874) | `M16` = 126,888,191.520 ($126,888,191,520) |
| Participación por activo | **Publicado** | `Instituciones (1)`, `Participación % ...` | `N15` = 38.7596208040% | `N16` = 39.4283734536% |
| Disponibilidades | **Publicado** | `EF`, fila 13 `Disponibilidades`, columna de la sociedad | `E13` = 1,739,002.836 ($1,739,002,836) | `E13` = 1,481,021.783 ($1,481,021,783) |
| Cartera vigente | **Publicado** | `Instituciones (2)`, `Cartera Vigente`, fecha actual; también `EF` fila 16 | `G9` = 58,779,416.190 ($58,779,416,190) | `G10` = 67,171,203.942 ($67,171,203,942) |
| Cartera vencida | **Publicado** | `Instituciones (2)`, `Cartera Vencida`, fecha actual; también `EF` fila 20 | `K9` = 1,946,111.129 ($1,946,111,129) | `K10` = 1,943,667.351 ($1,943,667,351) |
| IMOR | **Publicado** | `Instituciones (2)`, `IMOR 1/(%)`, fecha actual | `O9` = 3.2047661254% | `O10` = 2.8122274044% |
| NICAP y categoría | **Publicado** | `Capitalización`, `Nivel de Capitalización (NICAP)` y `Categoría del Nivel de Capitalización` | `G13` = 252.3931729344%, `I13` = categoría 1 | `G14` = 235.6833561551%, `I14` = categoría 1 |
| Captación total | **Publicado** | `TI`, `Captación total`, fecha actual | `I10` = 95,561,938.234 ($95,561,938,234) | `I11` = 106,734,134.065 ($106,734,134,065) |
| Captación tradicional | **Publicado** | `TI`, `Captación tradicional`, fecha actual; también `EF` fila 37 | `M10` = 95,561,481.334 ($95,561,481,334) | `M11` = 106,733,734.542 ($106,733,734,542) |
| Tasas implícitas | **Publicadas** | `TI`, columnas `Tasa implícita de cartera vigente`, `de captación total` y `de captación tradicional` | `G10`=17.62499647%, `K10`=6.57831861%, `O10`=6.57834283% | `G11`=18.22275839%, `K11`=5.50654845%, `O11`=5.50657738% |
| Colocación / captación | **Derivado, no publicado** | `TI`: cartera vigente ÷ captación total | `E10/I10` = 61.50923399% (SQL: `61.5092339861%`) | `E11/I11` = 62.93319802% (SQL: `62.9331980162%`) |
| ICOR | **Derivado, no publicado** | `EF` fila 24 `Estimación preventiva para riesgos crediticios` ÷ cartera vencida (`Instituciones (2)` o `EF` fila 20) | `abs(E24)/K9` = `2,902,114.622/1,946,111.129×100` = 149.12378737% (SQL: `149.1237873703%`) | `abs(E24)/K10` = `3,089,756.405/1,943,667.351×100` = 158.96528814% (SQL: `158.9652881400%`) |
| Liquidez del KPI-03 | **No reproducible por cooperativa** | `EF` tiene componentes (filas 13–15 y 37–43), pero no los conceptos `Activos líquidos de corto plazo` / `Pasivos de corto plazo` ni el corte ≤30 días de `Series!C233` | — | — |

Los cuatro derivados institucionales se validan contra los valores redondeados del catálogo con tolerancia `1e-8 pp`; la diferencia máxima observada en PostgreSQL fue `0.0000000076 pp`.

Verificaciones del ejemplo Q1:

- IMOR publicado coincide con el cálculo con saldos de cierre: `1,946,111.129 / (58,779,416.190 + 1,946,111.129) × 100 = 3.2047661254%`.
- Activo total es idéntico en `Instituciones (1)!M15` y en `EF!E12`: 114,228,216.874 miles.
- Cartera vigente/vencida y captación tradicional coinciden entre `Instituciones (2)`, `TI` y `EF`.
- La tasa pasiva `TI!K10` usa **captación total**; `TI!O10` usa **captación tradicional**. No deben intercambiarse.

**Mecánica de columnas por boletín (índices 0-based; la letra Excel es el índice + 1):**

| Hoja | Campo | Q1 / Q4 | Q2 | Q3 |
|---|---|---|---|---|
| `Instituciones (1)` | Socios / Activo / Participación | 6 / 12 / 13 (`G/M/N`) | 6 / 12 / 13 (`G/M/N`) | 5 / 11 / 12 (`F/L/M`) |
| `Instituciones (2)` | Vigente / Vencida / IMOR | 6 / 10 / 14 (`G/K/O`) | 6 / 10 / 14 (`G/K/O`) | 5 / 9 / 13 (`F/J/N`) |
| `Capitalización` | NICAP / Categoría | 6 / 8 (`G/I`) | 6 / 8 (`G/I`) | 5 / 7 (`F/H`) |
| `TI` | Vigente / Cap. total / Cap. tradicional | 4 / 8 / 12 (`E/I/M`) | 5 / 9 / 13 (`F/J/N`) | 4 / 8 / 12 (`E/I/M`) |
| `TI` | Tasas activa / total / tradicional | 6 / 10 / 14 (`G/K/O`) | 7 / 11 / 15 (`H/L/P`) | 6 / 10 / 14 (`G/K/O`) |
| `EF` | Columna de etiqueta / columna de CPM | 1 / 4 (`B/E`) | 1 / 4 (`B/E`) | 0 / 3 (`A/D`) |

Las filas de `EF` son estables en los cuatro boletines: 12 `ACTIVO`, 13 `Disponibilidades`, 16 `Cartera de crédito vigente`, 20 `Cartera de crédito vencida`, 24 `Estimación preventiva para riesgos crediticios`, 37 `Captación tradicional`. La fila de CPM cambia (Q1 15/9/13/10; Q2 16/11/14/11; Q3 15/10/14/11; Q4 16/10/14/11 en `Instituciones (1)` / `Instituciones (2)` / `Capitalización` / `TI`), por lo que la clave `29056` es la referencia estable.

**Datos faltantes institucionales:** las celdas `n.d.` significan «la sociedad no envió información en tiempo y forma». En Q1 hay 1 `n.d.` en activo de `Instituciones (1)` y 2 en cartera/`TI`; en Q4 hay 1 en cada columna principal; Q2 y Q3 no presentan `n.d.` en esas columnas. No se imputan: se excluyen de rankings y el `TOTAL` publicado se mantiene solo para agregados.

### 3.2 Modos de visualización

| Modo | Indicadores que se muestran | Reglas |
|---|---|---|
| **Sectorial mensual** | KPI-01 a KPI-09 (variante `Series`), M-01 participación femenina | 12 cortes 2025; bandas `observado_2025` no regulatorias, excepto NICAP con línea normativa en 100%/150%. Sin saldos por cooperativa. |
| **Institucional trimestral** | IMOR publicado; NICAP + categoría; número de socios; participación por activo; saldos de activo, disponibilidades, cartera vigente/vencida, captación total/tradicional; colocación/captación derivada; ICOR derivado; tasas implícitas de `TI` | Cuatro trimestres de 2025; identificar siempre la clave de sociedad. Etiquetar `ICOR` y `colocación/captación` como **derivados**, no publicados. **No mostrar un coeficiente de liquidez por cooperativa**: solo sus componentes de `EF`, con nota de que el corte ≤30 días no está disponible. |
| **Contexto externo** | M-03 FONACOT y M-04 SNIIV | FONACOT por entidad/mes/género; SNIIV por organismo/entidad/sexo. `sin_umbral`. En SNIIV, nota sobre 399 filas sin sexo que suman 4 acciones. |

### 3.3 Promedios móviles de 12 meses, faltantes y denominadores

Regla general: para un corte `p`, se toman los 12 meses `all_periodos[índice(p)-11 : índice(p)+1]` de la fila 4 de `Series`. Se promedian **saldos mensuales**; el numerador es un flujo de 12 meses ya publicado.

| Indicador | Numerador (flujo 12m) | Denominador promediado | Ventana para 2025-01 | Ventana para 2025-03 | Ventana para 2025-12 | Faltantes detectados |
|---|---|---|---|---|---|---|
| ROA (KPI-08) | fila 141 `Resultado neto (suma flujos 12 meses)` | fila 5 `ACTIVO` | 2024-02…2025-01 | 2024-04…2025-03 | 2025-01…2025-12 | 0 |
| Tasa implícita activa (KPI-05) | fila 145 `Intereses cobrados por cartera vigente (suma flujos 12 meses)` | fila 13 `Cartera de crédito vigente` | 2024-02…2025-01 | 2024-04…2025-03 | 2025-01…2025-12 | 0 |
| Tasa implícita pasiva (KPI-06) | fila 153 `Gastos por intereses (suma flujos 12 meses)` | fila 35 `Captación tradicional` | 2024-02…2025-01 | 2024-04…2025-03 | 2025-01…2025-12 | 0 |

Las seis filas involucradas (5, 13, 35, 141, 145 y 153) tienen valores en todos los meses de las ventanas 2025; no hubo que imputar ni acortar ninguna ventana. Si en una carga futura faltara un saldo, el indicador se marca `no disponible` en ese corte en lugar de promediarse con menos de 12 observaciones. Las tasas trimestrales de `TI` usan otro denominador — promedio de los dos últimos trimestres, según `TI!C169:C171`— y no deben mezclarse con estas ventanas mensuales.

---

## 4. Matriz fuente – campo – KPI

| Archivo | Hoja / archivo | Campo, fila o columna exacta | KPI / métrica | Normalización |
|---|---|---|---|---|
| `SH_SOCAPS.xlsm` | `Series` | Fila 17 (`135000000000`) / fila 9 | KPI-01 IMOR | Millones → pesos solo si se muestra saldo |
| `SH_SOCAPS.xlsm` | `Series` | Fila 21 (`139000000000`, abs) / fila 17 | KPI-02 ICOR | Igual |
| `SH_SOCAPS.xlsm` | `Series` | Filas 194 / 195; componente fila 6 (`110000000000`) | KPI-03 liquidez | Igual |
| `SH_SOCAPS.xlsm` | `Series` | Filas 212 / 213; publicado 210; nota `C237` | KPI-04 NICAP | Igual |
| `SH_SOCAPS.xlsm` | `Series` | Fila 145 / `prom12(13)`; publicado 217; nota `C239` | KPI-05 tasa activa | Saldo mensual, nunca promediar tasa |
| `SH_SOCAPS.xlsm` | `Series` | Fila 153 / `prom12(35)`; publicado 224; nota `C240` | KPI-06 tasa pasiva | Igual; inconsistencia documentada |
| `SH_SOCAPS.xlsm` | `Series` | Fila 46 (`29100036`) / fila 5 (`100000000000`); publicado 198 | KPI-07 Capital/Activo | Igual |
| `SH_SOCAPS.xlsm` | `Series` | Fila 141 / `prom12(5)`; publicado 196; nota `C234` | KPI-08 ROA | Igual |
| `SH_SOCAPS.xlsm` | `Series` | Filas 13 (`130000000000`) / 35 (`210000000000`) | KPI-09 variante sectorial | Saldos de cierre |
| `SH_SOCAPS.xlsm` | `Series` | Filas 203 / 204; nota `C236` | M-01 participación femenina | Denominador = 203+204 |
| `BE_SOCAPS_20XX.xlsx` (4 boletines) | `Indicadores` | Fila 29 IMOR, 31 ICOR, 33 ROA, 37 NICAP, columna 5 en base 0 (`F`), fila `Total del Sector` | Contraste sectorial de KPI-01, -02, -04, -08 | Miles → pesos |
| `BE_SOCAPS_20XX.xlsx` (4 boletines) | `Capitalización` | `Nivel de Capitalización (NICAP)` y `Categoría del Nivel de Capitalización`, columna de fecha actual y de categoría; notas `C171`/`C173:C176` (Q1) y `C172`/`C174:C177` (Q2–Q4) | KPI-04: umbral regulatorio y valores por sociedad | Miles → pesos |
| `BE_SOCAPS_20XX.xlsx` (4 boletines) | `Instituciones (1)` | `Clave de la Sociedad`, `Nombre de la Sociedad`, `Número de Socios`, `Activo Total (miles de pesos)`, `Participación % ...`, siempre en la columna de fecha actual | Socios, activo y M-02 | Miles → pesos |
| `BE_SOCAPS_20XX.xlsx` (4 boletines) | `Instituciones (2)` | `Cartera Vigente`, `Cartera Vencida`, `IMOR 1/(%)`, columna de fecha actual; nota `IMOR = saldo...` al final de la hoja | KPI-01 institucional y saldos | Miles → pesos |
| `BE_SOCAPS_20XX.xlsx` (4 boletines) | `TI` | `Cartera Vigente`, `Captación total`, `Captación tradicional`, `Tasa implícita de cartera vigente`, `de captación total` y `de captación tradicional`; marcadores `B169:B171`, texto `C169:C171` | KPI-05/-06 variante trimestral, KPI-09 variante institucional, saldos | Miles → pesos; captación total ≠ tradicional |
| `BE_SOCAPS_20XX.xlsx` (4 boletines) | `EF` | Filas estables 12 `ACTIVO`, 13 `Disponibilidades`, 16 `Cartera de crédito vigente`, 20 `Cartera de crédito vencida`, 24 `Estimación preventiva...`, 37 `Captación tradicional`; columna de la sociedad | Saldos absolutos por cooperativa e ICOR derivado | Miles → pesos; sin coeficiente de liquidez por sociedad |
| FONACOT CSV (8) | — | `ENTIDAD_FEDERATIVA`, `*_mujeres`, `*_hombres` | M-03 | Importe ya en pesos |
| `financiamientos_2025.csv` | — | `acciones`, `monto`, `sexo`, `organismo` | M-04 | Monto ya en pesos |
| `diccionario_financiamiento.xlsx` | `Financiamientos` | Códigos de `sexo` y `organismo` | M-04 (catálogo) | Sin normalización |

Las filas de boletines se leen **por encabezado, no por letra fija**; las posiciones verificadas en cada trimestre están en la sección 3.1. Los importes se muestran como saldos al cierre y nunca se suman entre cortes.

---

## 5. Ejemplos reproducibles

Los cálculos se ejecutaron solo en memoria con `openpyxl`/`csv`; el script temporal quedó fuera del repositorio (`%TEMP%/opencode/paso05/calc_kpis.py`). Esqueleto mínimo para `Series`:

```python
from datetime import datetime
from openpyxl import load_workbook

wb = load_workbook("data/raw/cnbv/SH_SOCAPS.xlsm", read_only=True, data_only=True)
rows = list(wb["Series"].iter_rows(values_only=True))
cols = {v.strftime("%Y-%m"): i for i, v in enumerate(rows[3]) if isinstance(v, datetime)}
c = cols["2025-03"]
v = lambda fila: rows[fila - 1][c]

imor = v(17) / v(9) * 100                     # 4.2361948375 ; publicado fila 177
icor = abs(v(21)) / v(17) * 100               # 125.5267605593 ; publicado fila 185
liq  = v(194) / v(195) * 100                  # 37.6929816952 ; publicado fila 193
nicap = v(212) / v(213) * 100                 # 306.5197159872 ; publicado fila 210
cap_act = v(46) / v(5) * 100                  # 18.0284996299 ; publicado fila 198
coloc = v(13) / v(35) * 100                   # 68.8889316436 ; elaboración propia
muj = v(203) / (v(203) + v(204)) * 100        # 54.1876615945 ; elaboración propia

todos = sorted(cols)                       # fechas reales de la fila 4
i = todos.index("2025-03")
ventana = todos[i - 11:i + 1]              # 2024-04 … 2025-03
prom = lambda fila: sum(rows[fila - 1][cols[m]] for m in ventana) / 12

roa  = v(141) / prom(5) * 100              # 2.5445223519 ; publicado fila 196
act  = v(145) / prom(13) * 100             # 18.1688146566 ; publicado fila 217
pas  = v(153) / prom(35) * 100             # 5.8022194344 ; publicado fila 224
```

Para 2025-03 resulta `prom(13)=154,141.5972051667`, `prom(35)=219,038.2759669167` y `prom(5)=278,842.0815295833`. Para 2025-12, cargados y validados en PostgreSQL: `prom(13)=167,139.47947308333333`, `prom(35)=241,771.56585250000000` y `prom(5)=305,801.65766500000000` millones de pesos.

Resumen de verificación, 2025-03 y 2025-12 (todos los valores publicados se reproducen al recomputarlos):

| KPI | 2025-03 calculado = publicado | 2025-12 calculado = publicado | Boletín Q1 / Q4 |
|---|---:|---:|---:|
| IMOR | 4.2361948375% | 4.0549697085% | 4.2364291306% / 4.0549697085% |
| ICOR | 125.5267605593% | 127.5907268062% | 125.5145912898% / 127.5903866022% |
| Liquidez | 37.6929816952% | 35.6261802328% | no publicado en `Indicadores` |
| NICAP | 306.5197159872% | 300.2533349855% | 312.29% / 300.2517395283% |
| Tasa activa | 18.1688146566% | 18.2304798424% | 17.9895392192% / 18.5386640823% |
| Tasa pasiva | 5.8022194344% | 5.2719823640% | 5.5825586747% / 4.8817553140% |
| Capital/Activo | 18.0284996299% | 17.8527845893% | no publicado en `Indicadores` |
| ROA | 2.5445223519% | 2.1536581163% | 2.5428171835% / 2.1540614102% |
| Colocación/captación | 68.8889316436% | 69.2030772470% | 68.63738028% / 68.92611693% |

---

## 6. Indicadores descartados o sustituidos

| Indicador del mock / candidato | Motivo | Sustituto |
|---|---|---|
| **Liquidez disponible** `$1,250,000` y **obligaciones financieras** semanales | Valores sintéticos; el repositorio no contiene saldos propios de la caja ni serie semanal oficial | KPI-03 con `Series!194/195`; `Disponibilidades` (fila 6) queda como componente contextual |
| **Tasa de morosidad 8.2%** | Valor sintético; no proviene de `Series` ni de boletines | KPI-01 IMOR real |
| **Colocación vs. ahorro 73.4% con meta 80%** | Numerador, denominador y meta son del wireframe; la meta no aparece en fuentes oficiales | KPI-09 con captación tradicional (mensual) o total (trimestral), sin meta inventada |
| **Recuperación de cartera 67.5%** | No existe flujo de recuperación, saldo inicial de cartera ni fecha de corte que permitan construirlo sin supuestos | KPI-02 ICOR + evolución de IMOR; se reporta como indicador no calculable |
| **Préstamos por estado: Vigentes / Vencidos / Liquidados** | `Series` no tiene estado de crédito individual ni categoría «liquidado»; los boletines publican solo saldos agregados | Componentes de KPI-01 (vigente/vencida) y desglose FONACOT por entidad (M-03) |
| **Cartera vencida por tipo (Personal / Negocio / Emergencia)** | No hay campo de tipo de crédito en las fuentes agregadas disponibles | IMOR comercial/consumo/vivienda de `Series!178:180` como desglose oficial alternativo, si se decide ampliar |
| **Tabla de socios con cuotas vencidas y días de atraso** | Datos personales inexistentes en fuentes abiertas; riesgo de privacidad | Ranking institucional por IMOR / NICAP usando boletines, sin nombres de personas |
| **Sucursales y filtros por sucursal** | `Series` es consolidado; los boletines dan número de sucursales por sociedad, no KPI financiero ni serie propia | Dimensión `alcance = sectorial/institucional`, no `sucursal` |
| **Series por institución dentro de `Series`** | La columna 0 de `Series` es código de concepto; la fila 3 es `SISTEMA SOCAPS` (`Series!C3`). No hay institución | Hojas `Instituciones (1)`, `Instituciones (2)`, `Capitalización`, `TI` y `EF` de los boletines |
| **Saldos aislados de disponibilidades, cartera o captación como KPI** | Son componentes; mostrarlos solos invita a sumar saldos históricos | Componentes dentro de KPI-01, -03 y -09; en el modo institucional se exhiben como importes al cierre, nunca como serie sumable |
| **Coeficiente de liquidez por cooperativa** | Los boletines no publican `Activos líquidos de corto plazo` / `Pasivos de corto plazo` ni el corte ≤30 días de `Series!C233`; `EF` solo da componentes contables generales | Mostrar únicamente los componentes disponibles de `EF` en la ficha institucional y el KPI-03 completo solo en el modo sectorial |
| **IMORA** | Sí es computable (`Series!181`, nota `C231`), pero requiere quitas y castigos de 12 meses y no es el indicador base del dashboard | No se descarta por falta de datos: queda como extensión futura, fuera del catálogo mínimo |
| **Tasas de depósitos a plazo y préstamos bancarios** (`Series!226`, `227`) | Publicadas pero traslapan parcialmente KPI-06 y no son comparables con captación tradicional | Se conservan como contexto, no como KPI seleccionado |
| **Hoja `TD` de `SH_SOCAPS.xlsm`** | Escala en pesos **inferida** y razón exacta `1,000,000:1` frente a `Series`; no aporta un indicador nuevo | No se usa en las fichas finales salvo evidencia documental de escala |

---

## 7. Propuesta de adaptación del frontend existente

Situación actual (`docs/auditoria.md`, `Frontend/src/App.jsx`, `Frontend/src/data/mockDashboardData.js`): ocho KPIs sintéticos, filtros `SUCURSALES` y `PERIODOS` hardcodeados, gráfica semanal, tabla de socios y paleta semántica accesible.

| Elemento actual | Cambio propuesto (solo diseño; no implementado) |
|---|---|
| Tarjetas de KPI | Sustituir por KPI-01 a KPI-09. Cuando un KPI tenga dos versiones (tasa activa/pasiva, colocación/captación, NICAP, ROA, IMOR, ICOR), la tarjeta muestra la versión **sectorial mensual** y un enlace a la pestaña institucional trimestral. |
| Selector de sucursal / periodo | Reemplazar por tres modos explícitos —**sectorial mensual**, **institucional trimestral** y **contexto externo**— y por `corte` (meses 2025-01…12, trimestres con boletín disponible o año 2025 para FONACOT/SNIIV). Quitar cualquier lista de sucursales. |
| Lectura de boletines | Resolver las columnas de `Instituciones (1)`, `Instituciones (2)`, `Capitalización`, `TI` y `EF` buscando el texto del encabezado y la fecha de corte, no por posición fija (Q2 y Q3 tienen desplazamientos documentados en 3.1). La clave `29056` identifica a Caja Popular Mexicana en los cuatro trimestres. |
| Eje temporal semanal | Eje mensual real con 12 cortes de 2025 para las series de `Series`. La gráfica de liquidez muestra `Activos líquidos de corto plazo` y `Pasivos de corto plazo` como componentes y el coeficiente como línea derecha, con etiqueta clara de doble eje. |
| Bandas de alerta | Para KPI-01, -02, -03, -05, -06, -07, -08 y -09, sombrear el rango observado 2025 con etiqueta «referencia observada, no umbral regulatorio». Para NICAP, líneas en 100% y 150% con etiqueta «umbral y categoría 1 según nota oficial». |
| Tabla de préstamos por socio | Eliminarla. Sustituir por tabla institucional con `Clave`, `Nombre`, socios, activo, disponibilidades, cartera vigente/vencida, captación total/tradicional, IMOR, ICOR derivado, colocación/captación derivada, NICAP y categoría; sin datos personales ni coeficiente de liquidez por sociedad. |
| Desglose por tipo de crédito | Reemplazar por las filas oficiales `IMOR comercial`, `IMOR consumo`, `IMOR vivienda` (`Series!178:180`) o por el desglose por entidad de FONACOT (M-03). |
| Contexto externo / equidad | Añadir dos tarjetas reales: FONACOT (créditos, participación femenina, monto y ticket) y SNIIV (acciones, monto, participación femenina y participación INFONAVIT). Gráfico de barras apiladas por género con nota: **399 registros/filas sin sexo suman 4 acciones**; se conservan en los totales y se excluyen del denominador de género. |
| Contrato de datos sugerido | `{ modo, alcance, periodo, unidad_importes, indicadores: [{id, nombre, valor, unidad, derivado, tipo_umbral, referencia, serie}], componentes: {...}, fuentes: [{archivo, hoja, celdas}] }`. Un solo productor de KPIs evita duplicar fórmulas en la UI. |
| Estilos | Conservar la paleta accesible existente; usar naranja para morosidad, teal para liquidez/colocación, ámbar para métricas en seguimiento (participación y contexto externo). |

---

## 8. Verificación, integridad y limitaciones

- Integridad de `data/raw/` antes y después de este paso: **19/19 archivos** con tamaño y SHA-256 idénticos al manifiesto. No se escribió dentro de `data/raw/`.
- Estado Git: sin commits; este documento es el único archivo nuevo del paso 05 además de los artefactos ya generados en pasos anteriores (`ETL/profile_data.py`, `docs/perfil_datos.md`).
- **Unidades inferidas**: la escala de `Series` (millones) se infiere del multiplicador en `Series!B3`; `TD` está en pesos también por inferencia. Los boletines traen la escala en el encabezado. No se afirma una escala regulatoria donde el archivo no la declara.
- **Cortes distintos**: `Series` y los boletines no coinciden en todos los decimales (p. ej., NICAP 306.52% vs 312.29% en Q1). Se preservan como dos mediciones oficiales con fechas de elaboración diferentes; no se promedian ni se corrigen.
- **Umbrales**: solo NICAP tiene umbral normativo, verificado en los cuatro boletines (nota de `>100%` y cuatro categorías). El resto de las bandas son descriptivas de 2025 (`observado_2025`) o `sin_umbral`, y se rotulan como tales en la interfaz.
- **Verificación institucional puntual**: en los cuatro boletines se comprobó la publicación por sociedad de socios, activo, participación, disponibilidades, cartera vigente/vencida, IMOR, NICAP/categoría, captación total/tradicional y tasas implícitas. ICOR y colocación/captación se derivan de esos campos; la liquidez por cooperativa no es reproducible. La lectura por encabezado evita los desplazamientos de columnas de Q2 y Q3. Los códigos `n.d.` (Q1 y Q4) no se imputan.
- **Ejemplo verificado**: Caja Popular Mexicana (`29056`) pasa de 3,692,848 socios, IMOR 3.2047661254%, NICAP 252.3931729344% (categoría 1) e ICOR derivado 149.12378737% en Q1, a 3,873,780 socios, IMOR 2.8122274044%, NICAP 235.6833561551% (categoría 1) e ICOR derivado 158.96528814% en Q4. Los campos y celdas están en 3.1.
- **Promedios móviles**: las ventanas de 12 meses terminadas en cada corte de 2025 se construyen con los 12 saldos mensuales reales de `Series`; las filas 5, 13, 35, 141, 145 y 153 no tienen celdas vacías en esas ventanas. No se promedian tasas publicadas ni se acortan ventanas.
- **SNIIV**: las 399 filas sin `sexo` del perfilado y las 4 acciones sin sexo del catálogo son dos unidades distintas de la misma observación; los importes se conservan en el total general y se excluyen del denominador por género.
- **Cobertura faltante**: no hay variables para recuperación de cartera, días de atraso, estados de crédito individuales, cartera por tipo de crédito equivalente al mock, serie institucional mensual ni activos/pasivos de corto plazo por cooperativa.
- **No implementado**: este documento no crea modelos PostgreSQL, ETL de carga, API ni cambios en `Frontend/`; es la entrada de diseño para el paso siguiente.
