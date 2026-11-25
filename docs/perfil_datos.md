# Perfil de datos — Paso 04

**Fecha:** 2026-11-25  
**Objetivo:** caracterizar los 19 archivos oficiales para definir KPIs y el modelo de PostgreSQL en pasos posteriores.  
**Alcance:** solo lectura y perfilado. No se ejecutaron macros, no se generaron datos sintéticos, no se aplicaron transformaciones permanentes, no se creó base de datos y no se definieron KPIs definitivos.
Fuentes consultadas: `data/raw/manifest.json` y `docs/fuentes.md`.

## 1. Resultado de integridad

- Antes del perfilado: **19/19** archivos con tamaño y SHA-256 idénticos al manifiesto.
- Después del perfilado: **19/19** archivos con tamaño y SHA-256 idénticos al manifiesto.
- Ningún archivo de `data/raw/` fue modificado; el documento generado está fuera de ese directorio.

## 2. Inventario y granularidad

| Fuente | Archivos | Granularidad observada | Clave candidata | Uso recomendado en ETL |
|---|---:|---|---|---|
| CNBV | 5 | Boletines: una fila por institución y trimestre; `Series`: una fila por concepto y mes, **sector consolidado** (sin institución) | Boletín: `(trimestre, clave_institucion)`; serie: `(concepto, mes)`, solo sector | Serie mensual `SH_SOCAPS.xlsm` para tendencias del sector; boletines para cortes institucionales |
| FONACOT | 10 | Una fila por entidad/canal, mes y género; columnas separadas por mes | `(anio, mes, entidad_canonica, genero)` | 8 CSV para hechos; PDF e inventario solo como metadatos |
| SNIIV | 4 | CSV/XLSX: una fila por año-mes-entidad-municipio-organismo-modalidad-destino-tipo-sexo-edad-ingresos-valor; JSON: agregado por mes-entidad-organismo-sexo | CSV: las 12 dimensiones listadas abajo; JSON: `(mes, estado, organismo, sexo)` | CSV + diccionario; XLSX y JSON solo para validación, nunca sumados al CSV |

## 3. CNBV — SOCAPS

### 3.1 Boletines trimestrales 2025

Encabezados reales detectados (no están en la primera fila):

- `Universo`: fila 4 (`Consecutivo`, `Clave de la Sociedad`, `Nombre de la Sociedad`, `Fecha Autorización`, `Nivel de Operación`, `Nivel de Regulación Prudencial`, `Estatus`, `Inicio de Operación`); datos desde la fila 8.
- `Instituciones (1)`: `Consecutivo`, `Clave de la Sociedad`, `Nombre de la Sociedad`, `Número de Socios`, `Número de Sucursales`, `Activo Total (miles de pesos)`, `Participación %`; tres columnas por fecha (anterior, cierre anterior, cierre actual).
- `Instituciones (2)`: `Cartera Vigente (miles de pesos)`, `Cartera Vencida (miles de pesos)`, `IMOR (%)`; tres fechas más columnas de participación.
- `TI`: saldos de `Cartera Vigente`, `Captación total` y `Captación tradicional` al cierre; flujos del trimestre de `Ingresos por intereses` y `Gastos por Intereses`; `Tasa implícita (%)`.
- `Capitalización`: `Nivel de Capitalización (NICAP) (%)` y `Categoría del Nivel de Capitalización`.
- `Indicadores`: filas de concepto con columnas `Total`, `Nivel de operación IV`, `III`, `II` e `I` para tres fechas.
- `EF`: matriz concepto × institución, encabezado `Cifras en miles de pesos`; `Clave de la Sociedad` y `Nombre de la Sociedad`; `Total del Sector` en la primera columna de datos.
- **Desplazamiento de columnas:** en 2025-Q3 las columnas `Consecutivo`/`Clave de la Sociedad`/`Nombre de la Sociedad` aparecen un lugar a la izquierda que en Q1/Q2/Q4. Los índices deben derivarse del encabezado real, no fijarse por trimestre.

| Trimestre | Fecha de consulta | Instituciones con datos | Socios (TOTAL) | Activo total (miles) | Cartera vigente (miles) | IMOR (%) | NICAP (%) |
|---|---|---:|---:|---:|---:|---:|---:|
| 2025-Q1 | Fecha de consulta de la información: 14 de mayo de 2025. | 155 | 9,525,365 | 294,709,325.08 | 160,349,703.59 | 4.2364 | 312.29 |
| 2025-Q2 | Fecha de consulta de la información: 31 de julio de 2025. | 155 | 9,637,828 | 304,894,415.05 | 165,811,788.98 | 4.2085 | 299.39 |
| 2025-Q3 | Fecha de consulta de la información: 3 de noviembre 2025. | 155 | 9,776,567 | 314,052,004.24 | 172,004,216.03 | 4.2326 | 297.76 |
| 2025-Q4 | Fecha de consulta de la información: 09 de febrero 2026. | 155 | 9,881,567 | 321,819,492.93 | 176,510,274.04 | 4.0550 | 300.25 |

Ejemplo real (2025-Q1): `29056 | Caja Popular Mexicana | socios 3,692,848 | sucursales 495 | activo 114,228,216.874 miles de pesos | participación 38.7596%`.
El total del sector en el mismo corte es `9,525,365 socios` y `294,709,325.077 miles de pesos`. Las filas `TOTAL`, `Total del Sector`, `Total general` y las columnas por nivel de operación son agregados: en una tabla de hechos por institución deben excluirse para no duplicar.

### 3.2 Series históricas `SH_SOCAPS.xlsm`

- Hojas: `Portada, Catálogo, Nombres, TD, Series, Notas`.
- `Series`: 1107x204; 165 columnas de fecha, de 2013-01 a 2026-09. 2025 tiene 12 columnas (índices 147–158).
- **Unidad:** `Series` y `TD` **no declaran unidad en ningún encabezado, catálogo o nota** (búsqueda de `miles`, `millones`, `pesos`, `cifras en` en las seis hojas: 0 coincidencias). La unidad se infiere por equivalencia numérica con los boletines, que sí etiquetan `miles de pesos`: `Series` está en **millones de pesos** y `TD` en **pesos**.
- La fila 1 de `Series` muestra `190001` en las columnas de 2025: no es un período válido; la fecha real está en la fila 4 (`datetime`).
- `Catálogo`: 169 claves CASFIM únicas; 151 `En operación` y el resto son bajas/fusiones con fecha. `Nombres`: 223 registros con `cve_institucion` de 6 dígitos, `clave_catalogo` tipo `29-004`, razón social y nombre de publicación.
- Codificación de instituciones: el boletín usa `29005` (numérico), `Nombres` usa `029005` y `Catálogo` usa `29-005`. La correspondencia existe, pero requiere normalización (`29005` → `029005` → `29-005`).
- **Granularidad: sector consolidado, no institución individual.** Evidencia: fila 2 de `Series` = `SISTEMA SOCAPS`; `Notas` 1 «1.    El cálculo del Sector es la suma de cada uno de los conceptos de las entidades»; `TD` con filtro `cve_institucion = (All)`; la columna 0 de `Series` contiene códigos de **concepto** (`100000000000 = ACTIVO`), no claves de institución. El detalle por institución existe solo en los boletines (`Instituciones (1)/(2)`, `TI`, `EF`, `Capitalización`); `Catálogo`/`Nombres` son el universo de sociedades, no series financieras por sociedad.

| Concepto (2025-03) | Valor en `Series` (millones de pesos, inferido) | Naturaleza |
|---|---:|---|
| ACTIVO | 294,888.150735 | saldo al cierre |
| PASIVO | 241,724.241567 | saldo al cierre |
| CAPITAL CONTABLE | 53,163.909164 | saldo al cierre |
| Cartera de crédito total | 167,536.324586 | saldo al cierre |
| Cartera de crédito vigente | 160,439.159453 | saldo al cierre |
| Cartera de crédito vencida | 7,097.165133 | saldo al cierre |
| Resultado neto | 1,782.953539 | acumulado del ejercicio (flujo) |
| Ingresos por intereses | 10,054.283862 | acumulado del ejercicio (flujo) |
| Gastos por intereses | 3,214.631743 | acumulado del ejercicio (flujo) |
| Resultado neto (flujo mensual) | 632.812902 | flujo mensual (derivado) |
| Ingresos por intereses (flujo mensual) | 3,484.682249 | flujo mensual (derivado) |
| Gastos por intereses (flujo mensual) | 1,111.914029 | flujo mensual (derivado) |

`Series` contiene saldos en el bloque `BALANCE GENERAL`, conceptos acumulados del ejercicio en `ESTADO DE RESULTADOS` y filas derivadas explícitas `(flujo mensual)` y `(suma flujos 12 meses)`. No deben mezclarse saldos, flujos mensuales y acumulados sin una columna que distinga la naturaleza.
- `TD` (128x166) es una tabla dinámica de `Suma de dat_importe` por `cve_concepto`/`cve_periodo`, con filtro `cve_institucion = (All)`. Para `ACTIVO` 2013-01: `TD = 62,786,170,555` frente a `Series = 62,786.170555`; razón exacta de `1,000,000:1`. Esto confirma la escala: `TD` en pesos y `Series` en millones de pesos (inferido).
- Evidencia documental de posibles revisiones: `Notas` 3 «3.   Las cifras presentadas pueden cambiar en el tiempo, debido a renvíos de información.»; portada «Información disponible al 04 de noviembre de 2026». El boletín 2025-Q1 registra «Fecha de consulta de la información: 14 de mayo de 2025.». Las fuentes corresponden a fechas de información distintas.
- **Comparación de marzo de 2025 en una sola unidad (millones de pesos):** boletín Q1 `294,709,325.08 miles = 294,709.325077 millones`; `Series = 294,888.150735 millones = 294,888,150.735 miles`. Diferencia `Series − boletín = +178.825658 millones` (`+178,825.658 miles`, `178,825,658 pesos`, 0.0607%).
- **Solo escala, no revisión:** `294,709,325.08` y `294,709.325077` son el **mismo total del boletín**: el primero está en miles y el segundo en millones (factor 1,000; la diferencia residual de unos pesos es únicamente el redondeo a 2 decimales del primero). La diferencia de `Series` contra el boletín es de **cifras**, no de escala. `Notas` 3 documenta que las cifras pueden cambiar por renvíos de información, pero **ningún archivo documenta la causa específica** de esos +178.825658 millones: no atribuirlos a un reproceso concreto sin evidencia.

## 4. FONACOT

Cambios de encabezado y calidad observados:

- Q1 usa `ENTIDAD FEDERATIVA`; Q2–Q4 usan `ENTIDAD_FEDERATIVA`.
- Q1 conserva separadores de miles y espacios (`' 32,050,929.75 '`, `'1,326 '`); Q2–Q4 traen números sin separadores.
- Q1/Q2 tienen columnas traseras vacías; Q3/Q4 de importes tienen filas vacías al final. El conteo de entidades reales es 33 por trimestre (32 entidades + `APP MOVIL`).
- `APP MOVIL` es un canal especial, no una entidad federativa: debe conservarse como categoría separada para no inflar el conteo de entidades.
- Q3 de trabajadores usa `VERACRUZ`; Q3 de importes usa `VERACRUZ DE IGNACIO DE LA LLAVE`. Q4 ya usa el nombre completo en ambos. Sin canonización, la correspondencia trabajador-importe falla en Q3.
- El PDF `Diccionario Conjunto de Datos.pdf` tiene 5 páginas y define `XX_mujeres`/`XX_hombres` de la serie 'Trabajadores' como **número de créditos otorgados**, y los de la serie 'Importe' como **monto ejercido**. El nombre del archivo dice 'trabajadores', pero el metadato describe créditos: documentar la ambigüedad.
- El inventario XLSX enumera 7 conjuntos; solo los dos de entidad/género están descargados.

| Trimestre | Archivos | Filas útiles por archivo | Entidades + canal | Suma trabajadores/créditos | Suma importes (pesos) |
|---|---|---:|---:|---:|---:|
| 2025-Q1 | 2 CSV | 33 / 33 | 33 | 503,416 | 15,525,525,836.55 |
| 2025-Q2 | 2 CSV | 33 / 33 | 33 | 510,842 | 15,838,163,285.81 |
| 2025-Q3 | 2 CSV | 33 / 33 | 33 | 601,649 | 18,517,548,812.57 |
| 2025-Q4 | 2 CSV | 33 / 33 | 33 | 561,561 | 16,889,088,475.45 |

Ejemplo real (2025-Q1): trabajadores `AGUASCALIENTES | Ene_mujeres = 1,326`; importes `AGUASCALIENTES | Ene_mujeres = 32,050,929.75` pesos. La correspondencia es por `(trimestre, mes, entidad, género)`, no por suma global.
Unidades: trabajadores/créditos son conteos; importes son pesos mexicanos con dos decimales. No hay columna de fecha tipo `date`: el mes está codificado en el encabezado (`Ene_mujeres`, `Feb_hombres`, ...).
Subtotales y totales: los CSV no incluyen filas `TOTAL`; la suma debe calcularse en el ETL. Las celdas vacías son ausencia de dato publicado, no cero automático.

## 5. SNIIV — Financiamientos 2025

- **CSV:** cp1252, 325,649 filas × 16 columnas; 0 duplicados completos. Columnas: `año, mes, cve_ent, entidad, cve_mun, municipio, organismo, modalidad, destino, tipo, sexo, edad_rango, ingresos_rango, vivienda_valor, acciones, monto`.
- **XLSX:** hoja `Sheet1`, 325,650×16 celdas, 325,649 filas de datos; mismos encabezados. Sumas: acciones 998,745, monto 617,246,458,236.39 pesos.
- **JSON API:** 3,989 objetos con claves `año, mes, estado, organismo, sexo, clave_estado, acciones, monto`; acciones 998,814, monto 617,373,196,605.69 pesos.
- El CSV y el XLSX son la misma tabla en dos formatos (el XLSX conserva `cve_ent='01'` y `destino='3'` como texto donde el CSV los infiere numéricos). No son fuentes aditivas.
- El JSON está agregado a `(mes, estado, organismo, sexo)` y tiene las mismas 3,989 claves que el CSV agregado, **pero no coincide en valores**: 723 de 3,989 grupos difieren; delta de 69 acciones y 126,738,369.30 pesos. Usar una sola fuente; se recomienda el CSV por su detalle municipal.
- No existe clave mínima de 5 dimensiones: `(año, mes, entidad, organismo, sexo)` produce 321,660 duplicados. La granularidad real son las 12 dimensiones `año, mes, cve_ent, cve_mun, organismo, modalidad, destino, tipo, sexo, edad_rango, ingresos_rango, vivienda_valor`, con 0 duplicados.

Ejemplo real (CSV, primera fila): `año=2025, mes=3, cve_ent=01, entidad=Aguascalientes, cve_mun=1, municipio=Aguascalientes, organismo=1 (INFONAVIT), modalidad=2, destino=3, tipo=2, sexo=1 (Hombre), edad_rango=2, ingresos_rango=6, vivienda_valor=6, acciones=1, monto=1,475,418.03`.
Ejemplo real (JSON): `{'año': 2025, 'mes': 'enero', 'estado': 'Aguascalientes', 'organismo': 'INFONAVIT', 'sexo': 'Hombre', 'clave_estado': '01', 'acciones': 19, 'monto': 17098440.65}`.

Nulos relevantes: `cve_ent`=11, `cve_mun`=395, `municipio`=10, `tipo`=14, `sexo`=399, `edad_rango`=6,552, `ingresos_rango`=6,299, `vivienda_valor`=71,623. No se imputaron.
Los códigos de `organismo`, `modalidad`, `destino`, `tipo`, `sexo`, `edad_rango`, `ingresos_rango` y `vivienda_valor` son categóricos según `diccionario_financiamiento.xlsx`; `acciones` es número de financiamientos y `monto` es pesos con 2 decimales.
Subtotales/totales: ni el CSV ni el JSON traen filas de total; los agregados deben construirse en el ETL. El JSON **ya está agregado**: sumarlo al CSV duplicaría el fenómeno.

## 6. Diccionario preliminar y campos candidatos para KPIs

| Campo | Fuente | Tipo / unidad | Descripción y limitación |
|---|---|---|---|
| `clave_institucion` | CNBV boletines / `Nombres` | texto, 6 dígitos | Boletín `29005` → `029005` → `29-005`. Requiere normalización; no usar el número del boletín como llave definitiva. |
| `activo_total_miles` | CNBV `Instituciones (1)` | miles de pesos, saldo | Unidad etiquetada `(miles de pesos)`. Diferencia de cifras contra `Series` (millones) sin causa documentada en los archivos. |
| `cartera_vigente_miles`, `cartera_vencida_miles` | CNBV `Instituciones (2)` | miles de pesos, saldo | Unidad etiquetada. Excluir filas `TOTAL` en hechos por institución. |
| `conceptos_series_millones` | CNBV `Series` | millones de pesos (inferido), saldo/flujo | Sin etiqueta de unidad; escala confirmada por `TD` (1:1,000,000) y por el boletín. Solo sector consolidado; clave `(concepto, mes)`. |
| `dat_importe_td` | CNBV `TD` | pesos (inferido) | `Suma de dat_importe` con `cve_institucion=(All)`; 1,000,000 veces `Series`. No declarado en el archivo. |
| `imor_pct`, `nicap_pct`, `tasa_implicita_pct`, `participacion_pct` | CNBV | porcentaje | Ratios; nunca promediar como si fueran montos sin ponderación. |
| `resultado_neto` | CNBV `Indicadores` (miles) / `Series` (millones) | flujo / acumulado | En `Series` hay versión acumulada, `(flujo mensual)` y `(suma flujos 12 meses)`; elegir una naturaleza y una unidad. |
| `ingresos_intereses_trimestre_miles`, `gastos_intereses_trimestre_miles` | CNBV `TI` | miles de pesos, flujo trimestral | Flujo del trimestre, no saldo. No comparar contra columnas de saldo ni contra `Series` (millones). |
| `socios`, `sucursales` | CNBV `Instituciones (1)` | conteo, saldo | Corte de fecha; no confundir con número de créditos. |
| `anio`, `mes`, `entidad`, `genero` | FONACOT CSV | entero / texto | Mes viene en el encabezado; género en el sufijo `_mujeres`/`_hombres`. Canonizar `VERACRUZ`. |
| `creditos_ejercidos` | FONACOT trabajadores | conteo, flujo mensual | El PDF lo define como créditos otorgados, no trabajadores distintos. |
| `monto_ejercido_pesos` | FONACOT importes | pesos, flujo mensual | Q1 requiere limpiar comas y espacios solo en memoria durante el ETL. |
| `acciones`, `monto` | SNIIV CSV | conteo / pesos | Medidas; la clave incluye 12 dimensiones. `monto` con 2 decimales. |
| `organismo`, `modalidad`, `destino`, `tipo`, `sexo`, `edad_rango`, `ingresos_rango`, `vivienda_valor` | SNIIV CSV + diccionario | código entero → etiqueta | Requiere catálogos del XLSX; existen nulos (`No disponible`/`No especificado`). |

Campos candidatos (no KPIs definitivos): montos y conteos de CNBV por institución/mes, créditos y monto ejercido de FONACOT por entidad/género/mes, acciones y monto de SNIIV por organismo/entidad/sexo/mes, y ratios derivados calculados en el ETL a partir de estos campos. La definición formal de KPIs queda para el siguiente paso.

## 7. Recomendación de archivos para el ETL

| Archivo | Rol |
|---|---|
| `data/raw/cnbv/SH_SOCAPS.xlsm` | Serie mensual principal (2013-01 a 2026-09; usar 2025) en **millones de pesos (inferido)**, sector consolidado (`SISTEMA SOCAPS`); `TD` en pesos y `Notas`/`Catálogo` como documentación de escala y granularidad. Códigos de institución solo en `Nombres`/`Catálogo`, sin series individuales. |
| `data/raw/cnbv/BE_SOCAPS_202503.xlsx` … `BE_SOCAPS_202512.xlsx` | Cortes trimestrales de 2025 para indicadores por institución; 202512 como corte más reciente. |
| 8 CSV de `data/raw/fonacot/` | Hechos de créditos/monto por entidad, mes y género. |
| `data/raw/fonacot/Diccionario Conjunto de Datos.pdf` | Metadato: definición de columnas y advertencia 'créditos' vs 'trabajadores'. |
| `data/raw/fonacot/Inventario de Datos Abiertos.xlsx` | Metadato: universo de conjuntos publicados; solo 2 descargados. |
| `data/raw/sniiv/financiamientos_2025.csv` | Detalle municipal de financiamientos 2025; fuente única de hechos SNIIV. |
| `data/raw/sniiv/diccionario_financiamiento.xlsx` | Catálogos de códigos y unidades del CSV. |
| `data/raw/sniiv/financiamientos_2025.xlsx` | Validación: misma tabla que el CSV; no cargar como fuente adicional. |
| `data/raw/sniiv/financiamiento_2025_api.json` | Validación/agregado alternativo; no sumar al CSV. |
| `data/raw/manifest.json`, `docs/fuentes.md` | Trazabilidad de URL, período, tamaño y SHA-256. |

## 8. Limitaciones registradas

1. CNBV: **miles de pesos** etiquetados en boletines; `Series` en **millones de pesos** e `TD` en **pesos** (ambos inferidos, sin etiqueta declarada; equivalencia exacta 1,000,000:1); fechas de consulta distintas (portada de `SH_SOCAPS`: información al 04 de noviembre de 2026; boletín Q1: 14 de mayo de 2025); códigos de institución con tres formatos; `Series` incluye meses posteriores a 2025 (hasta 2026-09), por lo que el ETL debe filtrar el año. `Notas` 3 admite posibles cambios por renvíos, pero no documenta la causa específica de la diferencia de cifras de 2025-03.
2. CNBV: `Series` tiene filas de saldo, acumulados y flujos derivados en una sola columna de conceptos; requiere una columna de naturaleza para evitar sumas inválidas.
3. FONACOT: encabezados y formatos cambian por trimestre; `APP MOVIL` no es entidad; `VERACRUZ`/`VERACRUZ DE IGNACIO DE LA LLAVE` requiere canonización; el diccionario de 2022/2023 describe créditos donde el archivo dice trabajadores.
4. SNIIV: CSV y XLSX son duplicados; JSON agregado no concilia con el CSV (723 grupos con diferencia); códigos categóricos y nulos; la clave de 5 dimensiones no es única.
5. No se imputaron nulos, no se normalizaron archivos originales y no se calcularon KPIs definitivos.

## 9. Pruebas ejecutadas

| Prueba | Resultado |
|---|---|
| SHA-256 y tamaño de 19 originales contra `manifest.json` | **19/19 antes y 19/19 después** |
| Lectura OpenXML de 4 boletines + `SH_SOCAPS.xlsm` + 2 XLSX de metadatos/diccionario | Correcta, sin ejecución de macros |
| Conteo de instituciones CNBV 2025-Q1..Q4 | 155, 155, 155, 155 filas por corte |
| Series 2025 | 12 columnas mensuales; ACTIVO 2025-03 = 294,888.150735 **millones** (294,888,150.735 miles), sector consolidado |
| Escala CNBV confirmada | ACTIVO 2013-01: `TD = 62,786,170,555` pesos / `Series = 62,786.170555` millones; razón 1,000,000:1 |
| Activo 2025-03 en una sola unidad | Boletín `294,709,325.08` miles = `294,709.325077` millones; `Series = 294,888.150735` millones; delta `+178.825658` millones (diferencia de cifras, causa no documentada) |
| FONACOT trabajadores vs importes | 33 vs 33 entidades en Q3 por variante de Veracruz |
| SNIIV CSV vs XLSX | 325,649 vs 325,649 filas; acciones 998,745 vs 998,745 |
| SNIIV CSV agregado vs JSON | 723/3,989 grupos con diferencia de monto |
| Muestras contrastadas | CNBV, FONACOT y SNIIV mostradas arriba con valores reales de los archivos |

**Estado:** paso 04 completado. No se realizaron commits ni se avanzó al paso 05.
