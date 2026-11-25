# Diccionario de datos propuesto — PostgreSQL 15+

Diseño, no esquema ejecutado. `PK` clave primaria, `FK` foránea, `NN` NOT NULL, `U` única. Los campos no marcados NN admiten NULL. Todo identificador `bigint` es sustituto; no codifica significado. `numeric(30,6)` es MXN salvo indicación; porcentajes `numeric(20,10)` son puntos porcentuales. Las restricciones compuestas descritas aquí son parte del diseño, aunque Mermaid solo muestra enlaces. Todas las tablas tienen PK; no se propone relación entre fuentes externas y cooperativas.

## Trazabilidad

### `archivo_fuente`

| Campo | Tipo | Restricción y significado |
|---|---|---|
| archivo_id | bigint | PK |
| fuente | text | NN; CNBV, FONACOT o SNIIV |
| ruta | text | NN; ruta relativa original |
| url | text | URL de adquisición cuando esté disponible |
| sha256 | char(64) | NN; hexadecimal SHA-256 de bytes, validar formato |
| tamano_bytes | bigint | NN, ≥0 |
| descargado_en | timestamptz | Fecha conocida de descarga |
| periodo_desde, periodo_hasta | date | Cobertura declarada, si conocida |
| rol | text | NN; hechos, diccionario o validación |

U(`ruta`, `sha256`): permite revisiones en la misma ruta y bytes iguales en rutas distintas. Inmutabilidad de registros publicados.

### `ejecucion_etl`

| Campo | Tipo | Restricción y significado |
|---|---|---|
| ejecucion_id | bigint | PK |
| iniciada_en | timestamptz | NN |
| terminada_en | timestamptz | NULL mientras corre; ≥ inicio |
| estado | text | NN; `iniciada`, `exitosa`, `fallida` |
| version_proceso | text | NN; versión identificable de reglas/código |
| observaciones | text | Errores o advertencias, sin secretos |

### `ejecucion_archivo`

| Campo | Tipo | Restricción y significado |
|---|---|---|
| ejecucion_id | bigint | PK, FK → `ejecucion_etl` |
| archivo_id | bigint | PK, FK → `archivo_fuente` |
| funcion | text | NN; entrada de hechos, metadato o contraste |
| hash_verificado | boolean | NN; comprobación contra bytes y manifiesto |

Relación muchos a muchos; los hechos referencian `(ejecucion_id, archivo_id)` en esta tabla. Solo publicar ejecuciones completas y exitosas con hashes verificados. Para dos archivos FONACOT se aplican dos FKs compuestas independientes; con archivo NULL la FK opcional no exige coincidencia.

## Dimensiones

### `dim_mes`

| Campo | Tipo | Restricción y significado |
|---|---|---|
| mes_id | date | PK; primer día del mes, representa año y mes |

### `dim_institucion`

| Campo | Tipo | Restricción y significado |
|---|---|---|
| institucion_id | bigint | PK |
| clave_seis | char(6) | NN, U; clave CNBV normalizada de seis dígitos, no numérica |
| clave_boletin | text | NN; representación original del boletín |
| clave_catalogo | text | Forma `29-xxx` cuando esté disponible |
| nombre | text | NN; nombre publicado |

La normalización debe verificarse contra `Nombres`/`Catálogo`. Para cambios históricos de nombre o clave se requiere versionado futuro; no asumir que un nombre actual describe todos los cortes.

### `dim_concepto_cnbv`

| Campo | Tipo | Restricción y significado |
|---|---|---|
| concepto_id | bigint | PK |
| archivo_id | bigint | NN, FK → `archivo_fuente`; versión del libro |
| hoja | text | NN; `Series` |
| fila_series | integer | NN, >0; fila original 1-based |
| codigo_original | text | Código fuente, NULL cuando no existe |
| nombre | text | NN; etiqueta fuente |
| naturaleza | text | NN; saldo, flujo_mensual, acumulado_ejercicio, flujo_12m, conteo o porcentaje |
| unidad_origen | text | NN; millones_mxn_inferidos, conteo o porcentaje |
| unidad_normalizada | text | NN; mxn, conteo o porcentaje; coherente con naturaleza |

U(`archivo_id`, `hoja`, `fila_series`); validar el concepto y su unidad para cada versión. Los conceptos de saldo y flujo monetarios se normalizan a MXN; conteos y porcentajes no. Para cada hecho sectorial el archivo debe ser igual a `dim_concepto_cnbv.archivo_id`, mediante FK compuesta al par único `(concepto_id, archivo_id)`.

### `dim_ambito_fonacot`

| Campo | Tipo | Restricción y significado |
|---|---|---|
| ambito_id | bigint | PK |
| tipo | text | NN; `entidad` o `canal` |
| nombre_canonico | text | NN; canonización documentada |

U(`tipo`, `nombre_canonico`); `APP MOVIL` es canal. No asignar códigos geográficos no publicados sin verificar.

### `dim_genero_fonacot`

| Campo | Tipo | Restricción y significado |
|---|---|---|
| genero_id | bigint | PK |
| etiqueta | text | NN, U; `mujeres` o `hombres` según encabezado |

## Hechos CNBV

### `hecho_cnbv_sector_mes`

| Campo | Tipo | Restricción y significado |
|---|---|---|
| sector_mes_id | bigint | PK |
| ejecucion_id | bigint | NN; FK compuesta con archivo_id → `ejecucion_archivo` |
| archivo_id | bigint | NN; archivo `SH_SOCAPS` de la ejecución |
| mes_id | date | NN, FK → `dim_mes` |
| concepto_id | bigint | NN; FK compuesta con archivo_id → `dim_concepto_cnbv` |
| valor | numeric(30,6) | Valor normalizado según concepto; NULL si ausente; signo original preservado |

U(`ejecucion_id`, `mes_id`, `concepto_id`). La columna del libro se localiza por fecha de fila 4; la fila por concepto. No hay institución. Asegurar precisión suficiente antes de convertir; se rechaza pérdida de precisión.

### `hecho_cnbv_institucion_trim`

| Campo | Tipo | Restricción y significado |
|---|---|---|
| institucion_trim_id | bigint | PK |
| ejecucion_id | bigint | NN; FK compuesta con archivo_id → `ejecucion_archivo` |
| archivo_id | bigint | NN; boletín del corte |
| mes_id | date | NN, FK → `dim_mes`; mes de cierre trimestral |
| institucion_id | bigint | NN, FK → `dim_institucion` |
| estado_reporte | text | NN; `publicado`, `parcial`, `no_reportado`; conservar `n.d.` como no reportado por campo NULL |
| socios, sucursales | bigint | Conteos de cierre |
| activo_mxn, disponibilidades_mxn | numeric(30,6) | Saldos de cierre |
| cartera_vigente_mxn, cartera_vencida_mxn | numeric(30,6) | Saldos de cierre |
| estimacion_mxn | numeric(30,6) | Estimación preventiva con signo fuente |
| captacion_total_mxn, captacion_tradicional_mxn | numeric(30,6) | Saldos distintos de TI |
| ingresos_intereses_trim_mxn, gastos_intereses_trim_mxn | numeric(30,6) | Flujos trimestrales TI |
| imor_pct, nicap_pct, participacion_activo_pct | numeric(20,10) | Valores publicados |
| categoria_nicap | text | Categoría publicada; preservar representación |
| tasa_activa_pct, tasa_pasiva_total_pct, tasa_pasiva_tradicional_pct | numeric(20,10) | Tasas TI publicadas, anualizadas trimestrales |

U(`ejecucion_id`, `mes_id`, `institucion_id`). Cada medida puede faltar independientemente; estado agregado no reemplaza los NULL individuales. Los importes se extraen por encabezado, hoja y corte, sin añadir filas de total.

### `hecho_cnbv_total_trim`

| Campo | Tipo | Restricción y significado |
|---|---|---|
| total_trim_id | bigint | PK |
| ejecucion_id | bigint | NN; FK compuesta con archivo_id → `ejecucion_archivo` |
| archivo_id | bigint | NN; boletín del corte |
| mes_id | date | NN, FK → `dim_mes`; cierre trimestral |
| activo_mxn | numeric(30,6) | TOTAL publicado de Instituciones (1) |
| cartera_vigente_mxn, captacion_total_mxn | numeric(30,6) | Total del sector publicado en TI |
| imor_pct, icor_pct, nicap_pct, roa_pct | numeric(20,10) | Indicadores sectoriales publicados en boletín |

U(`ejecucion_id`, `mes_id`). Las medidas provienen de los totales de sus respectivas hojas, no de una suma de sociedades; no mezclar con `Series` ni sumar al detalle institucional.

## Hechos de contexto externo

### `hecho_fonacot_mes`

| Campo | Tipo | Restricción y significado |
|---|---|---|
| fonacot_mes_id | bigint | PK |
| ejecucion_id | bigint | NN, FK → `ejecucion_etl` |
| archivo_creditos_id, archivo_monto_id | bigint | FKs compuestas con ejecucion_id → `ejecucion_archivo`; cada una puede faltar |
| mes_id | date | NN, FK → `dim_mes` |
| ambito_id | bigint | NN, FK → `dim_ambito_fonacot` |
| genero_id | bigint | NN, FK → `dim_genero_fonacot` |
| etiqueta_creditos_original, etiqueta_monto_original | text | Texto de entidad/canal de cada CSV, NULL si no existe fuente correspondiente |
| creditos | bigint | Conteo mensual; PDF lo describe como créditos, no trabajadores únicos |
| monto_mxn | numeric(30,6) | Importe mensual ejercido en MXN |

U(`ejecucion_id`, `mes_id`, `ambito_id`, `genero_id`). Al menos un archivo presente; una medida no nula exige su archivo y etiqueta, y un archivo presente exige etiqueta; una celda vacía puede tener archivo y etiqueta pero medida NULL. Las columnas originales de mes y género se reconstruyen por mes/género y el encabezado del archivo correspondiente. No imputar ausencias; validar correspondencia de archivos y cobertura.

### `hecho_sniiv_mes`

| Campo | Tipo | Restricción y significado |
|---|---|---|
| sniiv_mes_id | bigint | PK |
| ejecucion_id | bigint | NN; FK compuesta con archivo_id → `ejecucion_archivo` |
| archivo_id | bigint | NN; CSV detallado |
| mes_id | date | NN, FK → `dim_mes`; representa año y mes originales |
| cve_ent, cve_mun | text | Códigos geográficos originales normalizados como texto; NULL preservado |
| entidad, municipio | text | Etiquetas originales; no integran la clave |
| organismo, modalidad, destino, tipo, sexo | text | Códigos originales categóricos; NULL preservado |
| edad_rango, ingresos_rango, vivienda_valor | text | Códigos originales categóricos; NULL preservado |
| acciones | bigint | Conteo de financiamientos |
| monto_mxn | numeric(30,6) | Importe en MXN |

U **NULLS NOT DISTINCT** (`ejecucion_id`, `mes_id`, `cve_ent`, `cve_mun`, `organismo`, `modalidad`, `destino`, `tipo`, `sexo`, `edad_rango`, `ingresos_rango`, `vivienda_valor`). Son 12 dimensiones originales: año y mes representados por `mes_id` más diez códigos. Conservar ceros a la izquierda y distinguir valores explícitos del diccionario de NULL; validar códigos contra el diccionario SNIIV sin convertir ausencias en categorías. No crear entidad/municipio sintéticos ni usar solo el nombre como clave. Etiquetas no coincidentes para la misma clave se reportan como incidencia, no generan una segunda observación.
