# Transformación y conciliación por fuente (pasos 11–13)

Resultados observados con `ETL/run_etl.py` el 2026-11-25 sobre los 19 originales verificados (SHA-256 = manifiesto, antes y después). Cifras completas y hashes de salida en `data/processed/etl_manifest.json`. No se cargó nada a PostgreSQL.

## Paso 11 — CNBV (`ETL/cnbv_etl.py`)

Entradas: `SH_SOCAPS.xlsm` (hoja `Series`) y los cuatro boletines `BE_SOCAPS_2025{03,06,09,12}.xlsx` (hojas `Instituciones (1)`, `Instituciones (2)`, `Capitalización`, `TI`, `EF`, `Indicadores`). Lectura con openpyxl en solo lectura, sin ejecutar macros.

### Salidas (un archivo por grano)

| Archivo | Grano | Filas | Notas |
|---|---|---:|---|
| `cnbv_sector_mes.csv` | mes × `fila_series` | 598 = 26 conceptos × 23 meses (2024-02…2025-12) | Sector consolidado `SISTEMA SOCAPS` (`Series!C3`), sin institución |
| `cnbv_institucion_trim.csv` | mes de cierre × `clave_seis` | 620 = 155 × 4 cortes | Detalle por sociedad, sin filas de total |
| `cnbv_total_trim.csv` | mes de cierre | 4 | Totales publicados del boletín, no suma de sociedades |

### Reglas aplicadas

- **Fechas reales.** `Series`: la columna de cada mes sale de la fila 4 (`datetime`), no del código `190001` de la fila 1; cada valor guarda su `celda` de origen (p. ej. `EG5` = ACTIVO 2024-02). Boletines: el corte sale del nombre del archivo (`202503` → 2025-03-01) y la columna de «fecha actual» se localiza por el subencabezado `Marzo 2025`, `Junio 2025`, etc.
- **Lectura por encabezado.** Cada campo se ubica por el texto del encabezado del grupo y su subencabezado, sin acentos ni mayúsculas. Si un encabezado no aparece o aparece más de una vez, la fuente se detiene. Así se absorben los desplazamientos documentados de Q2 (`TI`) y Q3 (todas las hojas). La hoja `EF` se lee como matriz concepto × sociedad, localizando la columna por clave.
- **Escalas a MXN.** `Series` × 1,000,000 (escala inferida, `unidad_origen = millones_mxn_inferidos`); boletines × 1,000 (miles declarados). Conteos y porcentajes no se escalan. Decimales con `Decimal(repr(float))`: sin redondeo adicional. `valor_origen` conserva el número sin escalar.
- **Naturaleza.** Las 26 filas son las mismas de `dim_concepto_cnbv` (paso 09): 12 saldos, 3 flujos de 12 meses, 3 conteos y 8 porcentajes publicados. No se suman saldos entre meses.
- **Subtotales excluidos del detalle.** Filas `TOTAL` / `Total del Sector` / `Total general` de cada hoja, y la columna `29 – Total del Sector` de `EF`. El total publicado va solo a `cnbv_total_trim.csv`.
- **Nulos sin imputar.** `n.d.` (no envió información), `n.a.` (no operaba o ya no opera) y `n.c.` (sin definición en el archivo) se convierten en NULL y quedan en `marcas_origen` (`campo=n.d.;…`). También se marcan `vacío`, `sin_fila` (la sociedad no aparece en esa hoja) y `sin_columna_ef`. `estado_reporte`: `publicado` (18 medidas presentes), `parcial` o `no_reportado` (ninguna).
- **Claves.** `clave_boletin` = número publicado (`29056`); `clave_seis` = misma clave con cero a la izquierda (`029056`), como `dim_institucion.clave_seis`.
- **Campos por fuente.** `ingresos_intereses_trim_mxn` y `gastos_intereses_trim_mxn` son flujos del trimestre de `TI`. Para gastos se usa la columna de **captación total**, coherente con `tasa_pasiva_total_pct`. `estimacion_mxn` conserva el signo negativo publicado.

### Conciliación

| Prueba | Resultado |
|---|---|
| KPI-01, 02, 03, 04, 07, 08, 05 y 06 recomputados con `valor_origen` vs. filas publicadas 177/185/193/210/198/196/217/224, en los 12 meses de 2025 | Diferencia máxima ≤ 1e-9 pp en todos |
| Los 10 indicadores de 2025-03 vs. `docs/catalogo_kpis.md` (incluidos colocación/captación y participación femenina) | Coinciden a 10 decimales |
| Ventanas de 12 meses (ROA, tasas implícitas) | 2025-01 usa 2024-02…2025-01; sin huecos ni nulos en la ventana |
| Sociedades por corte | 155 / 155 / 155 / 155; 155 claves distintas en la unión |
| Estado de reporte | Q1 151 publicadas + 4 parciales; Q2 152 + 3; Q3 152 + 1 parcial + 2 no reportadas; Q4 151 + 4 |
| Caja Popular Mexicana (029056), Q1 y Q4 | Socios 3,692,848 / 3,873,780; IMOR 3.2047661254% / 2.8122274044%; ICOR derivado 149.12378737% / 158.96528814% |
| `EF` vs. `Instituciones (1)/(2)` y `TI` (activo, cartera vigente/vencida, captación tradicional) | 2,440 comparaciones; diferencia máxima 1 MXN (redondeo del boletín en miles) |
| Σ activo de sociedades vs. `TOTAL` publicado, por corte | Dentro de ±1 MXN en los cuatro cortes |
| Colocación/captación institucional con el total (`TI`) | Q1 68.63738028%, Q4 68.92611693% (= catálogo) |

**Rechazos (`rechazos_cnbv.csv`, 9 filas):** sociedades que no tienen columna en `EF` (Q1: 29152, 29211, 29207; Q2/Q3: 29152, 29207; Q4: 29043, 29207). Sus disponibilidades y estimaciones quedan NULL con marca `sin_columna_ef`; el resto de sus campos se conserva. No hay celdas no numéricas fuera de las marcas documentadas.

## Paso 12 — FONACOT (`ETL/fonacot_etl.py`)

Entradas: los 8 CSV (dos por trimestre). El PDF y el inventario quedan como metadatos.

- Ancho → largo: cada columna `Mes_genero` (`Ene_mujeres`…) se convierte en una fila `(mes, ámbito, género)`. El trimestre se toma de `periodo` en el manifiesto y se comprueba que los meses de las columnas pertenecen a él.
- Encabezado `ENTIDAD FEDERATIVA` (Q1) o `ENTIDAD_FEDERATIVA` (Q2–Q4). Las columnas traseras sin nombre y las filas vacías finales se descartan solo si están completamente vacías; si tuvieran datos, se rechazan.
- Números: se quitan espacios y separadores de miles de Q1 (`" 32,050,929.75 "`). Un formato no reconocido detiene la fuente. Celda vacía = NULL (no se observó ninguna).
- `VERACRUZ` → `VERACRUZ DE IGNACIO DE LA LLAVE`, conservando la etiqueta original de **cada** CSV (`etiqueta_creditos_original`, `etiqueta_monto_original`). `APP MOVIL` → `tipo_ambito = canal`.
- Emparejamiento por `(mes, tipo, ámbito canónico, género)` entre «trabajadores» (créditos) e «importe» (MXN). Cualquier clave sin pareja se registra como rechazo.

| Trimestre | Filas | Ámbitos | Σ créditos | Σ monto (MXN) | Sin pareja |
|---|---:|---:|---:|---:|---:|
| 2025-Q1 | 198 | 33 | 503,416 | 15,525,525,836.55 | 0 |
| 2025-Q2 | 198 | 33 | 510,842 | 15,838,163,285.81 | 0 |
| 2025-Q3 | 198 | 33 | 601,649 | 18,517,548,812.57 | 0 |
| 2025-Q4 | 198 | 33 | 561,561 | 16,889,088,475.45 | 0 |

Las sumas coinciden exactamente con `docs/perfil_datos.md` §4. La participación femenina de créditos en Q1 es 40.969496% (= catálogo M-03). El ejemplo `AGUASCALIENTES / Ene_mujeres` da 1,326 créditos y $32,050,929.75. En Q3, Veracruz empareja aunque sus etiquetas difieren (`VERACRUZ` / `VERACRUZ DE IGNACIO DE LA LLAVE`). `rechazos_fonacot.csv`: 0 filas.

**Limitación de precisión publicada:** en Q2–Q4 ningún importe tiene más de 10 dígitos significativos (p. ej. `278386109`, `367139885.8`), mientras que Q1 llega a 11. Eso es compatible con un redondeo al exportar el CSV oficial, con un error ≤ media unidad del décimo dígito (≤ $0.50 por celda). Se conservan los valores tal como se publicaron. Los créditos son conteos de créditos ejercidos, **no personas únicas**, y no se asignan a cooperativas.

## Paso 13 — SNIIV (`ETL/sniiv_etl.py`)

Entradas: `financiamientos_2025.csv` (cp1252), único origen de hechos, y `diccionario_financiamiento.xlsx`. `financiamiento_2025_api.json` solo se lee para reportar sus totales; no se suma. El XLSX no se lee porque el perfilado ya confirmó que es la misma tabla.

- Lectura con todas las columnas como texto: se conservan `cve_ent` con ceros (`01`) y `cve_mun` tal como viene (`1`, `16`, `570`), sin rellenar ni recortar. Celdas vacías → NULL.
- `acciones` viene como `1.0`: se acepta solo si la parte decimal es cero y se exporta como entero. `monto` se conserva como texto decimal exacto (sin pasar por float).
- Se valida formato numérico de año, mes, acciones, monto y claves geográficas, y que los 8 códigos categóricos existan en el diccionario. Todo se cumplió; cualquier excepción detendría la fuente.
- Grano: `mes` (año-mes) + `cve_ent, cve_mun, organismo, modalidad, destino, tipo, sexo, edad_rango, ingresos_rango, vivienda_valor`, con NULL igual a NULL, como `UNIQUE NULLS NOT DISTINCT` en el esquema. `fila_origen` permite volver a la línea del CSV.

| Prueba | Esperado (perfil) | Observado |
|---|---:|---:|
| Registros | 325,649 | 325,649 |
| Acciones | 998,745 | 998,745 |
| Monto (MXN) | 617,246,458,236.39 | 617,246,458,236.39 |
| Filas sin sexo / sus acciones | 399 / 4 | 399 / 4 (monto 265,488,266.35) |
| Claves de 12 dimensiones distintas | 325,649 | 325,649 (0 duplicados) |
| Nulos `cve_ent`, `cve_mun`, `municipio`, `tipo` | 11, 395, 10, 14 | 11, 395, 10, 14 |
| Nulos `edad_rango`, `ingresos_rango`, `vivienda_valor` | 6,552, 6,299, 71,623 | 6,552, 6,299, 71,623 |
| JSON API (contraste, no cargado) | 3,989 objetos; 998,814 acciones | 3,989 objetos; 998,814 acciones |

Hay filas con `acciones = 0` y monto positivo; se conservan como se publicaron, sin restricciones que las rechacen. `rechazos_sniiv.csv`: 0 filas. Ningún financiamiento se atribuye a una SOCAP.
