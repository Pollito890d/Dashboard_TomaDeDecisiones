# Calidad del ETL local y contrato de salidas (paso 15)

**Alcance:** validaciones en Python sobre los archivos transformados y pruebas automatizadas locales. Las FK, restricciones, inserción idempotente, rollback y conciliación desde PostgreSQL **no se ejecutaron**: quedan pendientes del merge ([etl_integracion_pendiente.md](etl_integracion_pendiente.md)).

## 1. Validaciones automáticas (`ETL/validations.py`)

Se ejecutan en cada `run_etl.py` antes de publicar. Una `falla` impide reemplazar las salidas; una `advertencia` se registra en el manifiesto y en el log.

| Fuente | Pruebas | ok | Advertencias | Fallas |
|---|---:|---:|---:|---:|
| CNBV | 59 | 56 | 3 | 0 |
| FONACOT | 22 | 22 | 0 | 0 |
| SNIIV | 13 | 13 | 0 | 0 |

Cobertura:

- **Contrato, por salida:** el archivo existe, sus columnas son las del contrato, las filas coinciden con lo declarado y el grano es único (cero duplicados).
- **Claves naturales y mapeos:** `clave_seis` de 6 dígitos = `0` + `clave_boletin`, 155 sociedades por corte; 33 ámbitos FONACOT por mes con `APP MOVIL` solo como canal y Veracruz canonizado; las 12 dimensiones SNIIV únicas y `cve_ent` con dos caracteres.
- **Tipos y dominios:** conteos enteros ≥0; `estado_reporte` y `categoria_nicap` dentro de su dominio; códigos SNIIV dentro del diccionario (al extraer).
- **Nulos:** ninguno en la ventana de `Series`; toda sociedad no `publicado` tiene `marcas_origen`; FONACOT sin celdas vacías; nulos SNIIV iguales a los del perfilado.
- **Periodos:** ventana CNBV completa y consecutiva; cortes 03/06/09/12; FONACOT 12 meses de 2025; SNIIV 2025-01…12.
- **Unidades:** escalado millones→MXN exacto; conteos y porcentajes sin escalar; número de decimales frente al esquema.
- **Totales y conciliación:** KPI-01…09 y M-01 recomputados = publicados o catálogo; sumas trimestrales FONACOT; totales SNIIV; activo Σ sociedades ≈ TOTAL publicado; casos de control de Caja Popular Mexicana.
- **Integridad:** 19/19 originales con el mismo tamaño y SHA-256 antes y después de cada ejecución.

### Excepciones legítimas y tolerancias

| Caso | Tratamiento | Justificación |
|---|---|---|
| 186 valores de `cnbv_sector_mes.valor` y 1 de `cnbv_institucion_trim` con más de 6 decimales | Advertencia; se exportan completos | Son artefactos binarios de Excel (p. ej. `6461.4061839999995` millones). Al cargar en `numeric(30,6)` PostgreSQL redondea a 1e-6 MXN, una diferencia despreciable que se documenta en vez de ocultarse |
| 3,655 porcentajes con más de 10 decimales | Advertencia | Ruido de punto flotante en porcentajes publicados; `numeric(20,10)` redondea a 1e-10 pp |
| Recomputo de ratios vs. publicado | Tolerancia 1e-9 pp | Diferencias por aritmética decimal vs. flotante del libro; la máxima observada está por debajo |
| Σ activo de sociedades vs. TOTAL | ±1 MXN (advertencia si se excede) | Redondeo del boletín en miles |
| EF vs. otras hojas | Diferencia máxima 1 MXN | Ídem |
| Sociedades con `n.d.`/`n.a.`/`n.c.` o sin columna en `EF` | NULL + `marcas_origen`; 9 rechazos documentados | No se imputan ceros ni se descartan filas |
| SNIIV `acciones = 0` con monto > 0 | Se conservan | Así se publicaron; el plan prohíbe rechazar acciones cero |
| FONACOT Q2–Q4 con ≤10 dígitos significativos | Se conservan | Precisión de la publicación oficial |

## 2. Pruebas automatizadas (`ETL/tests/`)

```powershell
.\.venv\Scripts\python.exe -m pytest ETL\tests -q
```

Resultado: **19 passed** (≈26 s). Las pruebas ejecutan el pipeline real dos veces en directorios temporales:

| Archivo | Qué comprueba |
|---|---|
| `test_config_common.py` | Importación de librerías; modo local con entorno vacío (sin `DATABASE_URL`); configuración inválida; 19/19 originales conforme al manifiesto; decimales sin pérdida; escritura atómica que conserva el archivo previo ante un fallo |
| `test_pipeline.py` | Sin fallas de validación; **dos ejecuciones con SHA-256 idénticos** en las 8 salidas y el manifiesto; originales intactos; manifiesto coherente con los archivos; casos reales CNBV (ACTIVO 2025-03, IMOR, CPM Q1/Q3, NICAP total), FONACOT (Aguascalientes, Veracruz Q3) y SNIIV (ceros iniciales, NULL); el validador detecta un crédito alterado; **un original faltante no reemplaza una salida válida** ni deja temporales; un hash alterado se detecta; `--cargar` está deshabilitado; un encabezado ambiguo detiene la lectura |

No se generaron datos sintéticos de producción. Las pruebas de fallo trabajan sobre copias temporales de los originales reales o de las salidas.

## 3. Contrato de salidas

Común a todos: CSV UTF-8, coma, LF, punto decimal, sin separador de miles; **campo vacío = NULL**; fechas `YYYY-MM-01` (primer día del mes, como `dim_mes.mes_id`); códigos como texto. `data/processed/etl_manifest.json` repite, por salida: columnas, grano, unidades, filas, tabla destino y SHA-256, junto con el SHA-256 de cada entrada.

### `cnbv_sector_mes.csv` — grano (`mes`, `fila_series`)

| Campo | Tipo | Descripción / procedencia |
|---|---|---|
| mes | fecha | Fila 4 de `Series` |
| fila_series | entero | Fila 1-based (= `dim_concepto_cnbv.fila_series`) |
| codigo_original | texto / NULL | Columna A |
| concepto | texto | Columna C |
| naturaleza | texto | saldo, flujo_12m, conteo, porcentaje |
| unidad_origen, unidad_normalizada | texto | millones_mxn_inferidos→mxn, conteo, porcentaje |
| valor_origen | decimal / NULL | Valor del libro sin escalar |
| valor | decimal / NULL | MXN (× 1,000,000) o conteo/% sin escalar |
| archivo, hoja, celda | texto | Procedencia exacta (`Series!EG5`) |

### `cnbv_institucion_trim.csv` — grano (`mes`, `clave_seis`)

`mes` (cierre trimestral), `clave_seis`, `clave_boletin`, `nombre_boletin`, `estado_reporte`; conteos `socios`, `sucursales`; MXN `activo_mxn`, `disponibilidades_mxn` (EF), `cartera_vigente_mxn`, `cartera_vencida_mxn`, `estimacion_mxn` (EF, con signo), `captacion_total_mxn`, `captacion_tradicional_mxn`, `ingresos_intereses_trim_mxn`, `gastos_intereses_trim_mxn` (flujos del trimestre, TI); puntos porcentuales publicados `imor_pct`, `nicap_pct`, `participacion_activo_pct`, `tasa_activa_pct`, `tasa_pasiva_total_pct`, `tasa_pasiva_tradicional_pct`; `categoria_nicap` (texto); `marcas_origen` (`campo=marca;…`); `archivo`.

### `cnbv_total_trim.csv` — grano (`mes`)

`activo_mxn` (`Instituciones (1)` TOTAL), `cartera_vigente_mxn` y `captacion_total_mxn` (`TI` Total del Sector), `imor_pct`, `icor_pct`, `nicap_pct`, `roa_pct` (`Indicadores`, columna Total), `archivo`.

### `fonacot.csv` — grano (`mes`, `tipo_ambito`, `ambito_canonico`, `genero`)

`trimestre`; `tipo_ambito` (entidad/canal); `ambito_canonico`; `genero` (mujeres/hombres); `creditos` (entero, créditos ejercidos); `monto_mxn` (decimal); `etiqueta_creditos_original`, `etiqueta_monto_original`, `columna_original`; `archivo_creditos`, `archivo_monto`.

### `sniiv.csv` — grano (`mes`, `cve_ent`, `cve_mun`, `organismo`, `modalidad`, `destino`, `tipo`, `sexo`, `edad_rango`, `ingresos_rango`, `vivienda_valor`), NULL = NULL

Códigos y etiquetas (`entidad`, `municipio`) como texto exacto del CSV; `acciones` (entero); `monto_mxn` (decimal exacto); `fila_origen` (línea del CSV).

### `rechazos_<fuente>.csv`

`archivo, hoja, fila, columna, valor_original, motivo`. Ninguna fila se descarta en silencio: todo NULL atípico, clave sin pareja o columna ausente queda aquí o en `marcas_origen`.

## 4. Ajustes necesarios para integrar con el esquema

Ver [etl_integracion_pendiente.md](etl_integracion_pendiente.md): mapeo columna→tabla, resolución de FKs, política de redondeo y pruebas SQL pendientes (`Database/04_validation.sql`).
