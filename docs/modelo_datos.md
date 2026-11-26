# Modelo analítico — paso 06

Diseño para PostgreSQL 15+, sin implementación. El detalle de columnas y restricciones es normativo en [diccionario_datos.md](diccionario_datos.md); [diagrama_er.mmd](diagrama_er.mmd) representa las mismas tablas y relaciones. Las cifras y definiciones proceden de `perfil_datos.md` y `catalogo_kpis.md`; no se crean observaciones.

## Grano y relaciones

| Hecho | Grano por ejecución | Cardinalidad dimensional | Unicidad natural por ejecución |
|---|---|---|---|
| `hecho_cnbv_sector_mes` | Un concepto de `Series` por mes, sector SOCAPS consolidado | Muchos hechos a un mes y a un concepto | ejecución, mes, concepto |
| `hecho_cnbv_institucion_trim` | Una sociedad por trimestre, fecha de cierre | Muchos a un mes y una institución | ejecución, mes, institución |
| `hecho_cnbv_total_trim` | Un total sectorial publicado por trimestre | Muchos a un mes | ejecución, mes |
| `hecho_fonacot_mes` | Mes, entidad o canal, género | Muchos a un mes, una categoría territorial y un género | ejecución, mes, ámbito, género |
| `hecho_sniiv_mes` | Las 12 dimensiones originales: año, mes, cve_ent, cve_mun, organismo, modalidad, destino, tipo, sexo, edad_rango, ingresos_rango, vivienda_valor | Muchos a un mes; los otros diez atributos son dimensiones degeneradas, códigos en el hecho | ejecución, mes y esos diez códigos, con nulos iguales |

El mes representa conjuntamente año y mes; no se almacenan dos versiones independientes. Un mes trimestral es marzo, junio, septiembre o diciembre. El total del boletín tiene su propia tabla: no se confunde con una institución ni se suma a ella. Los hechos externos no tienen relación con instituciones. Sus coincidencias geográficas o temporales permiten únicamente comparaciones de contexto, no atribución ni unión causal a cooperativas.

`dim_concepto_cnbv` identifica cada fila semántica por hoja y número de fila dentro de una versión del archivo; no exige código fuente, pues hay filas sin código. Contiene naturaleza y unidad; los valores monetarios y conteos se almacenan en `valor`, interpretado según el concepto. Cambios de disposición o semántica requieren mapear y validar explícitamente las filas, no reutilizar ciegamente el número. El archivo de origen permite reconstruir su ubicación. Conceptos y códigos SNIIV se conservan como texto para preservar ceros y evitar pérdida de códigos originales; las etiquetas geográficas originales SNIIV también se conservan. Los diez códigos SNIIV son dimensiones degeneradas deliberadas; su diccionario oficial es un archivo trazable, no se inventan catálogos ni equivalencias.

## Versiones y trazabilidad

Una `ejecucion_etl` exitosa representa una **instantánea completa y coherente**, no una carga incremental parcial; sus hechos son inmutables. Las ejecuciones fallidas no son consultables como instantánea. Una selección explícita de ejecución exitosa por consulta evita sumar versiones o mezclar insumos; la publicación atómica y la regla de selección quedan pendientes de implementación. Reejecutar el mismo archivo genera otra ejecución, sin duplicados dentro de ella. La ventana de CNBV y su numerador deben pertenecer a la misma ejecución y versión del libro. Los insumos se registran en `ejecucion_archivo`; cada hecho referencia la pareja ejecución/archivo registrada. FONACOT referencia separadamente ambos CSV, permitiendo uno ausente cuando falta esa medida. La ruta, URL, tamaño, hash SHA-256, fecha de descarga y período permiten identificar los bytes; hoja, fila/columna o clave natural permiten localizar el origen. Para CNBV institucional, las medidas se localizan mediante institución, corte y hoja/campo documentados en el catálogo KPI; cada boletín es un solo archivo. En FONACOT se conservan ambas etiquetas originales y la clave determina mes y género de cada columna. No se sobrescriben revisiones ni se atribuyen sus diferencias a una causa no documentada.

## Reglas de interpretación y calidad

- Importes normalizados en **MXN**, `numeric(30,6)`: `Series` × 1.000.000, escala inferida; boletines × 1.000, escala declarada; FONACOT y SNIIV ya en pesos. Mantener precisión sin redondear al cargar; validar que no se exceda escala ni precisión, sin truncamiento silencioso. Conteos enteros y porcentajes en puntos porcentuales, no fracciones. `dim_concepto_cnbv` documenta unidad y naturaleza; nunca multiplicar conteos o porcentajes por la escala monetaria.
- Saldo es semiaditivo: no sumar entre cortes. Flujos mensuales y flujos de 12 meses superpuestos no se suman entre sí. Porcentajes publicados no se suman ni promedian sin justificación. En institucional, tasas de `TI` son trimestrales anualizadas con promedio de dos trimestres, no ventanas mensuales.
- `NULL` significa ausente/no publicado, nunca cero. Preservar `n.d.` institucional mediante campo de estado; excluir faltantes del ranking. Para agregados, informar cobertura y devolver no disponible si faltan componentes requeridos; no dejar que `SUM` o `AVG` oculten ausencias. Denominador cero o nulo: resultado no disponible.
- SNIIV usa `UNIQUE NULLS NOT DISTINCT` de PostgreSQL 15 sobre ejecución, mes y las diez dimensiones textuales: dos combinaciones iguales incluso con nulos colisionan; no sustituir nulos por códigos artificiales. Sexo nulo permanece en totales y fuera del denominador femenino; lo mismo para sexo distinto de 1 o 2. CSV es único origen de hechos; XLSX y JSON solo contrastan, nunca se suman.
- FONACOT: `APP MOVIL` es canal, no entidad; se incluye en total nacional y excluye de comparaciones entre entidades. Canonizar explícitamente Veracruz preservando texto original por cada archivo. El PDF describe créditos, aunque el archivo diga trabajadores; no afirmar personas distintas. Si falta una medida, su archivo y etiqueta pueden ser nulos y la métrica conjunta no está disponible.
- CNBV: captación **total** y **tradicional** son distintos campos. KPI-09 mensual usa tradicional; institucional usa total. Tasa pasiva mensual usa gastos totales de intereses, aunque la nota mencione gastos de captación tradicional: reproduce el publicado, pero hay inconsistencia documentada. No existe liquidez ≤30 días por institución.
- Para KPI-05, 06 y 08 cargar al menos 2024-02…2025-12 si se presentan todos los cortes 2025. Cada ventana incluye corte y 11 meses anteriores, con exactamente 12 meses consecutivos y valores no nulos; el numerador de 12 meses se toma del corte, no se vuelve a sumar. Por ejemplo, 2025-01 necesita 2024-02…2025-01. No filtrar 2024 antes de calcular.

## Matriz KPI – campo – tabla

Abreviaturas: S = `hecho_cnbv_sector_mes.valor` filtrado por `dim_concepto_cnbv.fila_series`; I = `hecho_cnbv_institucion_trim`; T = `hecho_cnbv_total_trim`; F = `hecho_fonacot_mes`; V = `hecho_sniiv_mes`. Filas de `Series` 1-based. Todas las fórmulas porcentuales se multiplican por 100.

| Indicador | Campos y tablas / regla |
|---|---|
| KPI-01 IMOR | S(17)/S(9); institucional I.`imor_pct` publicado; contraste T.`imor_pct` |
| KPI-02 ICOR | ABS(S(21))/S(17); institucional ABS(I.`estimacion_mxn`)/I.`cartera_vencida_mxn`; contraste T.`icor_pct` |
| KPI-03 liquidez | S(194)/S(195); S(6) componente; sin versión institucional |
| KPI-04 NICAP | S(212)/S(213); I.`nicap_pct`, I.`categoria_nicap`; contraste T.`nicap_pct` |
| KPI-05 activa y spread | S(145)/prom12(S(13)); spread = KPI-05 − KPI-06; I.`tasa_activa_pct` publicada, fórmula trimestral distinta |
| KPI-06 pasiva | S(153)/prom12(S(35)); I.`tasa_pasiva_total_pct` e I.`tasa_pasiva_tradicional_pct`, distintas |
| KPI-07 capital/activo | S(46)/S(5) |
| KPI-08 ROA | S(141)/prom12(S(5)); contraste T.`roa_pct` |
| KPI-09 colocación/captación | S(13)/S(35); I o T `cartera_vigente_mxn`/`captacion_total_mxn` |
| M-01 socias | S(203)/(S(203)+S(204)); no usar total de socios como denominador |
| M-02 participación activo | I.`activo_mxn`/T.`activo_mxn`; I.`participacion_activo_pct` publicado |
| M-03 FONACOT | F.`creditos`, F.`monto_mxn`, `genero_id`, `ambito_id`: sumas; mujeres/total créditos; monto/créditos |
| M-04 SNIIV | V.`acciones`, V.`monto_mxn`, V.`sexo`, V.`organismo`: sumas; sexo 2 / sexo 1 o 2 para acciones y monto; organismo 1 / total acciones; monto/acciones |
| Ficha institucional | I.`socios`, `sucursales`, `activo_mxn`, `disponibilidades_mxn`, `cartera_vigente_mxn`, `cartera_vencida_mxn`, `captacion_total_mxn`, `captacion_tradicional_mxn`, tasas y ratios anteriores |

Las bandas observadas 2025 se calculan con 12 resultados válidos del mismo conjunto de versión; no son regulatorias. Solo NICAP tiene el umbral y categorías documentados en `catalogo_kpis.md`: cobertura adecuada >100%, categoría 1 ≥150%, categoría 2 ≥100% y <150%, categoría 3 ≥50% y <100%, categoría 4 <50%. No se almacena una meta inventada.

## Validaciones previstas y límites

Antes de publicar una instantánea: verificar hash/tamaño contra manifiesto; FKs, unicidades, cierre trimestral, dominios y conversión exacta; comprobar los 12 meses consecutivos; excluir totales de hechos institucionales; conciliar referencias de ambas fuentes FONACOT; conservar nulos y cobertura; comprobar las 12 dimensiones SNIIV y no sumar XLSX/JSON. Contrastar ejemplos 2025-03 y 2025-12 del catálogo, totales FONACOT por trimestre y SNIIV CSV (325.649 filas, 998.745 acciones y 617.246.458.236,39 MXN); sexo nulo son 399 filas y 4 acciones. Las 723 discrepancias de grupos con JSON no deben corregirse sin evidencia. Validar diferencias entre boletín y `Series` sin asumir causa.

Estas son pruebas de aceptación de una implementación futura, no ejecuciones de carga. Quedan pendientes la selección de instantánea, mapeo verificado de conceptos entre versiones, identificación de valores/códigos especiales originales, reglas de precisión efectivas y pruebas sobre una base real. No hay modelo de recuperación individual, datos personales, serie institucional mensual ni liquidez institucional completa. No se implementan SQL ni ETL en este paso.
