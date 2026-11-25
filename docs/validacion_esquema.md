# Validación del esquema — paso 08

## Ejecución real

- Rama `feature/database`; destino local configurado `dashboard_caja_ahorro`, usuario `dashboard_user`; PostgreSQL **17.4**.
- Antes del DDL se consultó `pg_class`/`pg_namespace`: **0 tablas ordinarias, particionadas o foráneas** fuera de esquemas del sistema. No se modificó ninguna otra base.
- `Database/01_schema.sql` se ejecutó íntegro y confirmó una transacción. El propio archivo verifica nuevamente destino y ausencia de tablas, y aborta si ya existen; usa un bloqueo consultivo transaccional para serializar ejecuciones cooperantes. No sustituye la coordinación con otros clientes que creen objetos simultáneamente.
- Se crearon 13 tablas en `public`: `archivo_fuente`, `ejecucion_etl`, `ejecucion_archivo`, `dim_mes`, `dim_institucion`, `dim_concepto_cnbv`, `dim_ambito_fonacot`, `dim_genero_fonacot`, `hecho_cnbv_sector_mes`, `hecho_cnbv_institucion_trim`, `hecho_cnbv_total_trim`, `hecho_fonacot_mes` y `hecho_sniiv_mes`.
- Comparación automática con `docs/diagrama_er.mmd`: **13 tablas y 110 nombres de columnas coinciden exactamente**. Se consultó `pg_constraint`: **13 PK, 19 FK, 11 UNIQUE y 25 CHECK**, todas validadas; `pg_indexes` registra **35 índices** en total, incluidos los generados automáticamente por PK/UNIQUE. `NOT NULL` es adicional y no se incluye en esas cifras de CHECK. Se verificó en `pg_index` que `sniiv_grano_uq` tiene `indnullsnotdistinct` activo.

## Pruebas transaccionales

Se ejecutó `Database/tests/01_schema_tests.sql` en PostgreSQL. Todos estos casos pasaron:

| Cobertura | Resultado |
|---|---|
| Inserciones mínimas coherentes, nulos admitidos y distintas combinaciones SNIIV | Aceptadas dentro de la transacción |
| Cinco claves naturales de hechos, incluida SNIIV con nulos | Duplicados rechazados con `23505` |
| Mes inexistente, pareja ejecución/archivo inválida, concepto/archivo inconsistente y archivo FONACOT inexistente | Rechazados con `23503` |
| Día no inicial de mes, cierre trimestral incorrecto en ambas tablas CNBV, SHA inválido, unidad incompatible y APP como entidad | Rechazados con `23514` |
| FONACOT sin archivo, archivo sin etiqueta y medida sin archivo | Rechazados con `23514` |
| Importe con seis decimales y estimación negativa | Signo y seis decimales preservados |

El script utiliza exclusivamente identificadores explícitos negativos para no avanzar secuencias y concluye con `ROLLBACK`. Después se consultó el conteo de cada tabla: **13/13 con cero filas**. No se cargaron dimensiones, catálogos ni hechos reales. Los valores de prueba son marcadores transitorios, no datos financieros publicados.

Para repetir las pruebas desde PowerShell, con el servidor y usuario configurados (la herramienta pedirá la contraseña sin incluirla en el comando):

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -X -h localhost -p 5432 -U dashboard_user -d dashboard_caja_ahorro -v ON_ERROR_STOP=1 -f Database\tests\01_schema_tests.sql
```

La prueba está diseñada para la base vacía; si ya existen registros con sus identificadores de prueba o meses, se detiene en vez de alterarlos. Ante error, `ON_ERROR_STOP` termina la sesión y PostgreSQL revierte la transacción abierta. No repetir `01_schema.sql` sobre una base con tablas: su guardia lo rechaza.

## Decisiones y límites

- Los conceptos sectoriales se vinculan a la misma versión de archivo mediante FK compuesta; cada hecho se vincula a un archivo registrado en la ejecución. Las dos FKs opcionales de FONACOT permiten una medida ausente, con reglas independientes para archivo y etiqueta. Los códigos y nulos SNIIV permanecen intactos. No hay relación de FONACOT o SNIIV con instituciones.
- Los importes y resultados sectoriales usan `numeric(30,6)`; porcentajes institucionales `numeric(20,10)`. No se restringe el signo de los importes. Captación total y tradicional son columnas distintas.
- **Precisión de entrada:** PostgreSQL redondea automáticamente valores con más decimales que la escala de un `numeric(p,s)` antes de evaluar restricciones de columna. El DDL no puede detectar ese redondeo después de la conversión; el futuro ETL debe validar el valor original y rechazar pérdida de precisión antes del `INSERT`. No se ha implementado ETL ni garantía de rechazo previo en este paso.
- La integridad referencial y los CHECK no verifican el contenido de los archivos, sus hashes reales, el tipo de fuente asociado a cada hecho, la completitud de instantáneas, la inmutabilidad de publicaciones, el mapeo de conceptos entre versiones, la correspondencia de encabezados ni las ventanas KPI; son validaciones pendientes de procesos posteriores. La semántica y disponibilidad de las unidades inferidas de CNBV y las discrepancias entre fuentes siguen documentadas en los pasos anteriores.
- `rol` usa `hechos`, `diccionario`, `validacion`; `funcion` usa `hechos`, `metadato`, `contraste`. Son codificaciones técnicas de las categorías del diccionario, no datos cargados.
