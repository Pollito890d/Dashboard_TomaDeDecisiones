# Carga de dimensiones y metadatos — paso 09

## Resultado real

En `feature/database`, sobre PostgreSQL 17.4 y `dashboard_caja_ahorro`, se ejecutó `ETL/load_catalogs.py` en una transacción. El script comprobó tamaño y SHA-256 de **19/19** archivos oficiales frente a `data/raw/manifest.json` antes de escribir; las ejecuciones posteriores repitieron esa comprobación con 19/19 correctos. No se escribieron archivos originales. La carga se repitió sin registros adicionales y se volvió a repetir tras mejorar la comprobación previa de claves existentes.

| Tabla | Primera carga | Total tras repetición | Nuevos en repetición |
|---|---:|---:|---:|
| `archivo_fuente` | 19 | 19 | 0 |
| `dim_mes` | 165 | 165 | 0 |
| `dim_institucion` | 155 | 155 | 0 |
| `dim_concepto_cnbv` | 26 | 26 | 0 |
| `dim_ambito_fonacot` | 33 | 33 | 0 |
| `dim_genero_fonacot` | 2 | 2 | 0 |
| `ejecucion_etl`, `ejecucion_archivo` | 0 cada una | 0 cada una | 0 |
| Las cinco tablas `hecho_*` | 0 cada una | 0 cada una | 0 |

No se registra una ejecución de hechos: las dimensiones cargadas no constituyen una instantánea de hechos exitosa. El proceso verifica que las cinco tablas de hechos estén vacías antes y al final; ante error revierte la transacción. Las claves existentes se comparan campo por campo; si difieren se cancela, no se actualizan ni silencian divergencias. Un bloqueo consultivo serializa ejecuciones cooperantes. La verificación de hashes ocurre antes de abrir la transacción; para evitar cambios concurrentes entre verificación y lectura se requiere coordinación externa de archivos.

## Fuentes y correspondencias

### Archivos y períodos

`archivo_fuente` registra ruta, URL, hash, tamaño, fuente y rol. Hay 5 CNBV de hechos, 8 FONACOT de hechos y 2 de diccionario/inventario, 1 CSV SNIIV de hechos, 1 diccionario SNIIV y 2 archivos SNIIV de contraste. La fecha en el manifiesto solo tiene día, no hora: `descargado_en` queda NULL en vez de inventar un instante; la fecha original consta en el manifiesto. Períodos reconocibles se guardan con límites inclusivos; los metadatos sin período temporal verificable quedan NULL.

`dim_mes` procede de las fechas de la fila 4 de `SH_SOCAPS.xlsm!Series`, no del código ficticio de la fila 1: 165 meses distintos, **2013-01 a 2026-09**. Los 23 meses de 2024-02 a 2025-12 existen, suficientes como dimensión temporal para las ventanas de 12 meses de todos los cortes 2025. Esto no implica que ya existan valores de hechos para calcularlos.

### CNBV instituciones

Se lee `Instituciones (1)` de cada boletín 2025 localizando encabezados por nombre. Hay 155 claves por boletín y 155 distintas en la unión; todas coinciden con `Nombres` y `Catálogo` de `SH_SOCAPS.xlsm`. La forma numérica publicada en boletín se guarda en `clave_boletin`, la clave de seis dígitos de `Nombres` en `clave_seis` y la forma con guion verificada en `clave_catalogo`: `29005` → `029005` → `29-005` corresponde a **Coopdesarrollo**. El nombre de cada clave se toma del boletín más reciente disponible, Q4; el original de cada corte permanece en su archivo. No se crea una historia de nombres que el esquema no soporta.

`Nombres` contiene 223 registros y `Catálogo` 169 claves; no se insertaron automáticamente todos ellos: `clave_boletin` es obligatoria y no se debe inventar una representación de boletín ni incorporar instituciones que no pertenezcan a los cortes verificados. Las instituciones no implican series mensuales individuales.

### CNBV conceptos

Se cargan exclusivamente 26 filas verificadas de `Series`: saldo **5, 6, 9, 13, 17, 21, 35, 46, 194, 195, 212, 213**; flujo de 12 meses **141, 145, 153**; conteo **202, 203, 204**; porcentajes publicados **177, 185, 193, 196, 198, 210, 217, 224**. Cubren todos los componentes sectoriales del catálogo de KPIs y sus contrastes publicados. Se preservan las etiquetas de la columna C y, cuando existe, el código de la columna A; **19/26** no tienen código en esa columna y quedan NULL. La clave de concepto es archivo/hoja/fila, no el código.

Los saldos y flujos se clasifican con unidad de origen `millones_mxn_inferidos` y unidad normalizada `mxn`; los conteos y porcentajes no se multiplican. La escala es inferida, no declarada por el archivo. No se cargaron valores financieros ni todos los conceptos de la hoja; ampliar la selección exige validar naturaleza, unidad y semántica. Para 194, 195, 202–204 y 212–213 hay identificadores en columna B, pero el campo `codigo_original` corresponde aquí a columna A, como describe el catálogo de KPI; el libro original conserva los demás identificadores.

### FONACOT

Se leen los ocho CSV originales, sin guardar medidas. Resultado: **32 entidades y 1 canal**; `APP MOVIL` se guarda como `canal`, no como entidad. `VERACRUZ` se canoniza como `VERACRUZ DE IGNACIO DE LA LLAVE`; se detecta una sola dimensión canónica. Los dos géneros `mujeres` y `hombres` se obtienen de los sufijos de encabezados. Las etiquetas específicas de cada CSV se conservan en los archivos originales y deberán cargarse en los campos de etiqueta del hecho en la fase correspondiente; este paso no crea hechos. El diccionario FONACOT describe la serie llamada trabajadores como créditos, no necesariamente personas distintas.

### SNIIV: validación sin tablas de catálogo nuevas

Se contrastaron los ocho campos categóricos del CSV cp1252 contra las columnas `Códigos`/`Nemónico del campo` de `diccionario_financiamiento.xlsx!Financiamientos`. **Ningún código no nulo observado quedó fuera del diccionario**. Los códigos del diccionario son:

| Campo | Códigos documentados | Nulos en CSV |
|---|---|---:|
| `organismo` | 1–26 | 0 |
| `modalidad` | 1–4 | 0 |
| `destino` | 1–18 | 0 |
| `tipo` | 1–2 | 14 |
| `sexo` | 1 hombre, 2 mujer | 399 |
| `edad_rango` | 1–3 | 6.552 |
| `ingresos_rango` | 1–6 | 6.299 |
| `vivienda_valor` | 1–6 | 71.623 |

Los rangos en la tabla describen los códigos presentes en el diccionario, no garantizan que todos aparezcan en el CSV. Sus descripciones completas se consultan en el XLSX oficial registrado; no se asignó un código artificial a `No disponible` o `No especificado`.

El diccionario declara `cve_ent` como texto `01–32` y `cve_mun` como texto `000–570`, con referencia al catálogo INEGI. Los valores no vacíos del CSV son numéricos y están en esos rangos; hay **11** entidades y **395** municipios nulos. Las entidades no vacías tienen dos caracteres; los municipios no vacíos aparecen con 1, 2 o 3 caracteres, por lo que no se inventaron ceros en el original. No se detectaron nombres distintos para una misma clave de entidad ni para una pareja entidad/municipio en las filas donde ambas claves están presentes. El diccionario no aporta aquí el catálogo INEGI municipal completo: comprobar pertenencia real y vigencia de cada pareja queda pendiente, no equivale a validar únicamente rangos. Se respetará la forma textual del CSV y sus nulos al cargar los hechos; las etiquetas SNIIV son dimensiones degeneradas, sin relación con cooperativas.

## Dependencias y reproducción

Desde la raíz en PowerShell, con `Backend/.env` privado ya configurado y el esquema del paso 08 instalado:

```powershell
.\.venv\Scripts\python.exe -m pip install -r ETL\requirements-catalogs.txt
.\.venv\Scripts\python.exe ETL\load_catalogs.py
.\.venv\Scripts\python.exe ETL\load_catalogs.py
```

El primer comando instala las dependencias fijadas del backend y `openpyxl==3.1.5`/`et-xmlfile==2.0.0`. Durante este paso se ejecutó `pip install openpyxl==3.1.5` y el script tres veces; las dos repeticiones reportaron cero nuevos. La lectura XLSM se hace con `openpyxl` en modo de solo lectura, sin ejecutar macros. El script no muestra la URL ni detalles de excepciones de conexión; al fallar devuelve código distinto de cero.

## Pendientes y límites

- No se cargaron hechos, ni ejecuciones de hechos, ni respaldo; la fase III queda para el otro integrante. No se alteró el esquema.
- Para futuras fuentes o revisiones, actualizar y revisar el manifiesto y los mapeos; el script comprueba explícitamente los 19 archivos actuales. Una revisión de libro con filas desplazadas requiere nueva verificación de conceptos y naturaleza.
- Completar la comprobación geográfica con un catálogo INEGI oficial adecuado, y decidir una estrategia de historia institucional antes de incorporar nombres o claves que cambien.
- La selección transaccional de instantáneas completas, conciliación de archivos y comprobación de precisión previa al `INSERT` de medidas corresponden a la futura carga de hechos. Con `numeric(p,s)`, PostgreSQL puede redondear antes de los CHECK; no se debe depender de ellos para detectar pérdida de precisión.
