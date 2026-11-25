# Fuentes abiertas oficiales — Paso 03

**Fecha de descarga:** 2026-11-24 (UTC-06:00)  
**Objetivo:** obtener datos reales de 2025 para el dashboard de cajas de ahorro, sin transformarlos.  
**Alcance:** solo descarga, validación y trazabilidad. No se implementó ETL, base de datos, backend ni frontend; no se generaron datos sintéticos; no se realizaron commits.

## Resumen

| Fuente | Estado | Archivos válidos | Períodos cubiertos | Tamaño total |
|---|---|---:|---|---:|
| CNBV SOCAP | **Validado** | 5 | Boletines 2025-Q1 a 2025-Q4 + series mensuales 2013-01 a 2026-09 | 35,658,043 B |
| FONACOT | **Validado** | 10 | CSV 2025-Q1 a 2025-Q4 (trabajadores e importes) + diccionario/inventario | 205,125 B |
| SNIIV | **Validado** | 4 | API 2025 + financiamientos mensuales 2025 + diccionario | 46,910,229 B |
| **Total** | **19/19 validados** | **19** | — | **82,773,397 B** |

Los 19 archivos se conservan byte por byte en `data/raw/<fuente>/`. Los hashes SHA-256 de esta tabla y del `manifest.json` se recalcularon sobre los archivos finales y coinciden.

## Validación aplicada

- Se rechazaron respuestas vacías, páginas HTML de error y archivos con tamaño sospechoso.
- XLSX/XLSM: firma `PK-03-04`, `zipfile.testzip()` correcto, lectura con `openpyxl`, revisión de hojas y dimensiones.
- CSV: cabecera presente, filas y columnas contables, sin `<html>`; se registró la codificación detectada.
- JSON: parseo correcto y número de objetos.
- PDF: cabecera `%PDF-1.5`.
- Cada archivo descargado se copió sin modificación desde un directorio temporal a `data/raw/`; Posteriormente se verificaron tamaño y SHA-256 contra el manifest.

## CNBV — Sociedades Cooperativas de Ahorro y Préstamo

Páginas: [Boletines SOCAPS](https://portafolioinfo.cnbv.gob.mx/PUBLICACIONES/Boletines/Paginas/SOCAPS.aspx) y [Portafolio de Información](https://portafolioinfo.cnbv.gob.mx/portafolioinformacion/forms/allitems.aspx).

| Archivo | URL | Período | Tamaño (B) | SHA-256 | Estado |
|---|---|---|---:|---|---|
| `data/raw/cnbv/BE_SOCAPS_202503.xlsx` | https://portafolioinfo.cnbv.gob.mx/PortafolioInformacion/BE_SOCAPS_202503.xlsx | 2025-Q1 (marzo) | 838,766 | `935b657d7ded42de228dcbd22e6986759032747db7a275d9725f1dcce76703cc` | Validado |
| `data/raw/cnbv/BE_SOCAPS_202506.xlsx` | https://portafolioinfo.cnbv.gob.mx/PortafolioInformacion/BE_SOCAPS_202506.xlsx | 2025-Q2 (junio) | 1,500,417 | `f797f4a110128bc7d2c6478e7cbf698a659f2c2950e2896fe6564306e10a640d` | Validado |
| `data/raw/cnbv/BE_SOCAPS_202509.xlsx` | https://portafolioinfo.cnbv.gob.mx/PortafolioInformacion/BE_SOCAPS_202509.xlsx | 2025-Q3 (septiembre) | 839,474 | `207c7b769f3334c1974d8170fe58e3c79743d1d90e0233f89f2de6461a3e0a39` | Validado |
| `data/raw/cnbv/BE_SOCAPS_202512.xlsx` | https://portafolioinfo.cnbv.gob.mx/PortafolioInformacion/BE_SOCAPS_202512.xlsx | 2025-Q4 (diciembre) | 1,509,189 | `d607d217963782ddb1dd6bac0a14ccdb30832e80e5ee34bba04e6a23873eccd9` | Validado |
| `data/raw/cnbv/SH_SOCAPS.xlsm` | https://portafolioinfo.cnbv.gob.mx/PortafolioInformacion/SH_SOCAPS.xlsm | 2013-01 a 2026-09; incluye 12 meses de 2025 | 30,970,197 | `c776388a8201863a53c1da6af2824b6c9b1498bf3727da52d3da99479bb1acee` | Validado |

`SH_SOCAPS.xlsm` contiene las hojas `Portada`, `Catálogo`, `Nombres`, `TD`, `Series` y `Notas`; la hoja `Series` tiene 1,107 filas × 204 columnas y columnas fechadas para cada mes de 2025. El catálogo interno indica corte al cierre de septiembre de 2026.

Las rutas históricas citadas en documentación externa (`.../Paginas/PIExcel/sc_infosituacion.aspx` y `.../eacp1/Paginas/sc_infosituacion.aspx`) responden 404; se localizó el archivo vigente `SH_SOCAPS.xlsm` en el listado oficial de documentos.

## FONACOT

Datasets: [trabajadores con crédito ejercido](https://www.datos.gob.mx/dataset/trabajadores_credito_ejercido_genero_entidad_federativa) e [importe de créditos ejercidos](https://www.datos.gob.mx/dataset/importe_creditos_ejercidos_genero_entidad-federativa). Alternativa oficial usada: [Datos Abiertos FONACOT](https://www.fonacot.gob.mx/TransparenciaRendicionCuentas/Paginas/Datos-Abiertos.aspx).

| Archivo | URL | Período | Tamaño (B) | SHA-256 | Estado |
|---|---|---|---:|---|---|
| `data/raw/fonacot/Trabajadores por género y entidad federativa.csv` | https://www.fonacot.gob.mx/TransparenciaRendicionCuentas/Documents/Datos%20Abiertos/2025/1erTrimestre/Trabajadores%20por%20g%C3%A9nero%20y%20entidad%20federativa.csv | 2025-Q1 (ene-mar) | 2,343 | `e379ea2f4e01bd679b9310466affb119017203bdeea861ec6dd7bbf40de033db` | Validado |
| `data/raw/fonacot/trabajadores_genero_entidad_federativa.csv` | https://www.fonacot.gob.mx/TransparenciaRendicionCuentas/Documents/Datos%20Abiertos/2025/2doTrimestre/trabajadores_genero_entidad_federativa.csv | 2025-Q2 (abr-jun) | 1,448 | `088c5db71f772df07abcbb548de4e77af232783aaabfd1a667a6d894df19f96a` | Validado |
| `data/raw/fonacot/datos_abiertos_trabajadores_con_credito_genero_y_entidad_federativa_3er_TRIM_2025.csv` | https://www.fonacot.gob.mx/TransparenciaRendicionCuentas/Documents/Datos%20Abiertos/2025/3erTrimestre/datos_abiertos_trabajadores_con_credito_genero_y_entidad_federativa_3er_TRIM_2025.csv | 2025-Q3 (jul-sep) | 1,436 | `ca182f93d07d20e3fe66e3bac6042f657086b6f79a34ad85a890d2ac12ea75c9` | Validado |
| `data/raw/fonacot/datos_abiertos_trabajadores_con_credito_genero_y_entidad_federativa_4to_TRIM_2025.csv` | https://www.fonacot.gob.mx/TransparenciaRendicionCuentas/Documents/Datos%20Abiertos/2025/4toTrimestre/datos_abiertos_trabajadores_con_credito_genero_y_entidad_federativa_4to_TRIM_2025.csv | 2025-Q4 (oct-dic) | 1,449 | `6f7d850f39100e0139d17a2feddd58a24bb784677900439f8e3ed5b7c9ff2141` | Validado |
| `data/raw/fonacot/Importe de créditos ejercidos por género y entidad federativa.csv` | https://www.fonacot.gob.mx/TransparenciaRendicionCuentas/Documents/Datos%20Abiertos/2025/1erTrimestre/Importe%20de%20cr%C3%A9ditos%20ejercidos%20por%20g%C3%A9nero%20y%20entidad%20federativa.csv | 2025-Q1 (ene-mar) | 4,472 | `e0b7b4f10d24df84d1381eab3ef80e37a250e4d8d6cfff9617e4b711933d2efb` | Validado |
| `data/raw/fonacot/importe_creditos_genero_entidad_federativa.csv` | https://www.fonacot.gob.mx/TransparenciaRendicionCuentas/Documents/Datos%20Abiertos/2025/2doTrimestre/importe_creditos_genero_entidad_federativa.csv | 2025-Q2 (abr-jun) | 3,052 | `7c42cda53a6f8cbc3efae50438a6ba6c99602195720ed5b57bd9af87a61fc750` | Validado |
| `data/raw/fonacot/datos_abiertos_importe_credito_genero_y_entidad_federativa_3er_TRIM_2025.csv` | https://www.fonacot.gob.mx/TransparenciaRendicionCuentas/Documents/Datos%20Abiertos/2025/3erTrimestre/datos_abiertos_importe_credito_genero_y_entidad_federativa_3er_TRIM_2025.csv | 2025-Q3 (jul-sep) | 2,859 | `8a254fee58c924dc28928f51c59b8868fb7e113e9325341d309d517cf82d9df1` | Validado |
| `data/raw/fonacot/datos_abiertos_importe_credito_genero_y_entidad_federativa_4to_TRIM_2025.csv` | https://www.fonacot.gob.mx/TransparenciaRendicionCuentas/Documents/Datos%20Abiertos/2025/4toTrimestre/datos_abiertos_importe_credito_genero_y_entidad_federativa_4to_TRIM_2025.csv | 2025-Q4 (oct-dic) | 3,452 | `0387cb5dd73069f6b071d99c63cc0972fc547e10df45ea250e6b50a2c981e21f` | Validado |
| `data/raw/fonacot/Diccionario Conjunto de Datos.pdf` | https://www.fonacot.gob.mx/TransparenciaRendicionCuentas/Documents/Datos%20Abiertos/2023/Diccionario%20Conjunto%20de%20Datos.pdf | Metadato vigente en la fuente (2023) | 163,070 | `f46988ac9a9aa036915242f220131f146171412b898077b254f526c95b34e3c3` | Validado |
| `data/raw/fonacot/Inventario de Datos Abiertos.xlsx` | https://www.fonacot.gob.mx/TransparenciaRendicionCuentas/Documents/Inventario%20de%20Datos%20Abiertos.xlsx | Metadato | 21,544 | `117ce9ab61e0d325e79bf55d5b12bfb082e54b0d570972ac943fb461b73e042e` | Validado |

Notas de contenido: los CSV de trabajadores e importes están desagregados por entidad federativa, mes y género. Los archivos de 2025-Q1 y 2025-Q2 conservan celdas vacías y separadores de miles entre comillas, tal como los publica la fuente; no se normalizaron.

## SNIIV — SEDATU

Página: [Datos abiertos SNIIV](https://sniiv.sedatu.gob.mx/Reporte/Datos_abiertos).

| Archivo | URL | Período | Tamaño (B) | SHA-256 | Estado |
|---|---|---|---:|---|---|
| `data/raw/sniiv/financiamiento_2025_api.json` | https://sniiv.sedatu.gob.mx/api/CuboAPI/GetFinanciamiento/2025,2025/00/000/anio,mes,estado,genero,organismo | 2025; respuesta cruda de la API propuesta | 582,560 | `783d2c3f48ebd78bb0dfe50719b1d4d679855db2c05ec9dd472628f2ec453e14` | Validado |
| `data/raw/sniiv/financiamientos_2025.csv` | https://sistemas.sedatu.gob.mx/repositorio/proxy/alfresco-noauth/api/internal/shared/node/BOZvuxwVRmy62_qG966obQ/content/financiamientos_2025.csv?a=true | 2025, meses 1-12 | 21,871,842 | `eee02be265b6d14ab72532b6640ce10b0c7526287a402689d0603075749451f3` | Validado |
| `data/raw/sniiv/financiamientos_2025.xlsx` | https://sistemas.sedatu.gob.mx/repositorio/proxy/alfresco-noauth/api/internal/shared/node/1F6G2Hv5QZeewiI0NRX8bA/content/financiamientos_2025.xlsx?a=true | 2025, meses 1-12 | 24,377,044 | `6043a7174ddcd141f7c433bb29e7e8c14729dd39ced2e07e9012a1a161ec3e94` | Validado |
| `data/raw/sniiv/diccionario_financiamiento.xlsx` | https://sistemas.sedatu.gob.mx/repositorio/proxy/alfresco-noauth/api/internal/shared/node/NGC6R5CLQ6SCexmbnOq4ZA/content/diccionario_financiamiento.xlsx?&a=true | Diccionario de la serie Financiamientos | 78,783 | `6ab7b55a9ad90e65b3f76e97268922cd33839dc27bf0e35ff24f8845b832a9ac` | Validado |

La API propuesta devolvió 3,989 objetos. Los archivos anuales se obtuvieron de los resolvedores oficiales `https://sniiv.sedatu.gob.mx/api/ReporteAPI/GetDocumentoAnio/2/2025/1` (CSV) y `/2` (XLSX). El CSV tiene 325,649 registros, 16 columnas y codificación cp1252/Latin-1; la cabecera incluye `año`, `mes`, `entidad`, `organismo`, `sexo`, `acciones` y `monto`.

## Incidencias y alternativas

| Fuente | Incidencia | Acción | Resultado |
|---|---|---|---|
| FONACOT | Las páginas `datos.gob.mx/dataset/...` devolvieron 403 al cliente HTTP; la API CKAN `package_show` sí permitió identificar los recursos. Los 8 CSV de `repodatos.atdt.gob.mx` devolvieron 403 incluso con cabeceras de navegador. | Se usó la alternativa oficial `fonacot.gob.mx/TransparenciaRendicionCuentas/Documents/Datos%20Abiertos/2025/...`. | 8 CSV 2025 descargados y validados. |
| CNBV | Las rutas históricas `sc_infosituacion.aspx` responden 404. | Se localizó `SH_SOCAPS.xlsm` en el listado oficial `portafolioinformacion/forms/allitems.aspx`. | Series históricas descargadas y validadas. |
| SNIIV | El endpoint `ReporteAPI/GetDocumentoAnio` solo responde bajo `/api/`; la ruta sin `/api/` devuelve 404. | Se usó `https://sniiv.sedatu.gob.mx/api/ReporteAPI/GetDocumentoAnio/...`. | CSV, XLSX y diccionario descargados. |

## Descarga manual pendiente

**Ninguna.** Todos los archivos aprobados se descargaron y validaron por medios automáticos. Los recursos de `repodatos.atdt.gob.mx` quedan registrados como **no usados (403)** en el manifest; no son necesarios para este paso porque FONACOT publica los mismos cortes en su sitio oficial.

## Criterios de aceptación

| Criterio | Resultado |
|---|---|
| Archivos oficiales válidos, accesibles y trazables | **Aprobado** — 19/19 con URL, período, tamaño y SHA-256 en `data/raw/manifest.json` |
| Datos 2025 priorizados | **Aprobado** — CNBV 2025 completo, FONACOT 2025 completo, SNIIV 2025 completo |
| Sin HTML de error ni respuestas vacías | **Aprobado** — se verificó firma, contenido y número de registros |
| Originales sin modificar | **Aprobado** — copia byte por byte; hash recalculado sobre el destino final |
| Fuentes no descargadas aprobadas | **Ninguna** — solo se aprobaron archivos validados |
| Sin ETL, base de datos, frontend ni commits | **Aprobado** |

Siguiente paso: usar este inventario como entrada del ETL (paso 04), respetando que los formatos y codificaciones aquí documentados aún no se transforman.
