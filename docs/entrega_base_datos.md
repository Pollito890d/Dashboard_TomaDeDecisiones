# Entrega de base de datos — validación final de fase II

## Resultado

Se compararon `dashboard_caja_ahorro` y `dashboard_caja_ahorro_prueba` en el servidor local **PostgreSQL 17.4, Windows x86_64, 64 bits**. Las consultas se ejecutaron como `dashboard_user` en transacciones `REPEATABLE READ READ ONLY`; no se restauró, creó ni modificó ninguna base durante esta validación. La restauración de prueba ya existía al inicio.

| Comprobación | Original | Restaurada | Resultado |
|---|---:|---:|---|
| Tablas en `public` | 13 | 13 | Nombres idénticos |
| Columnas | 110 | 110 | Orden, nombre, tipo, nulabilidad, identidad, default y colación idénticos |
| Restricciones | 68 | 68 | Nombre, tipo, definición, validación y diferibilidad idénticos |
| Índices | 35 | 35 | Nombre, definición, validez, unicidad y tratamiento de nulos idénticos |
| Secuencias | 11 | 11 | `last_value` e `is_called` idénticos |
| Filas de catálogos y metadatos | 400 | 400 | Contenido completo por tabla idéntico |
| Filas de hechos y ejecuciones | 0 | 0 | Las siete tablas están vacías |

Los 68 objetos de restricción comprenden 13 PK, 19 FK, 11 UNIQUE y 25 CHECK. Se comparó también `indnullsnotdistinct` de los índices. El contenido se contrastó como todas las filas de cada tabla ordenadas por su representación JSON; no fue solo una comparación de recuentos. Los resultados son instantáneas de lectura separadas: no prueban igualdad bajo escrituras concurrentes posteriores. No se compararon propietarios, permisos, roles, extensiones ni configuración global del servidor.

### Recuentos por tabla

| Tabla | Original | Restaurada |
|---|---:|---:|
| `archivo_fuente` | 19 | 19 |
| `dim_mes` | 165 | 165 |
| `dim_institucion` | 155 | 155 |
| `dim_concepto_cnbv` | 26 | 26 |
| `dim_ambito_fonacot` | 33 | 33 |
| `dim_genero_fonacot` | 2 | 2 |
| `ejecucion_etl` | 0 | 0 |
| `ejecucion_archivo` | 0 | 0 |
| `hecho_cnbv_sector_mes` | 0 | 0 |
| `hecho_cnbv_institucion_trim` | 0 | 0 |
| `hecho_cnbv_total_trim` | 0 | 0 |
| `hecho_fonacot_mes` | 0 | 0 |
| `hecho_sniiv_mes` | 0 | 0 |

## Cobertura de conceptos para KPIs

En ambas bases se consultaron las 26 filas de `dim_concepto_cnbv` y su naturaleza y unidades; son idénticas. Están presentes las **17 filas distintas necesarias** de `Series` para componentes sectoriales KPI-01 a KPI-09 y M-01, incluido el componente contextual de liquidez:

| Indicador | Filas de `Series` |
|---|---|
| KPI-01 IMOR | 17, 9 |
| KPI-02 ICOR | 21, 17 |
| KPI-03 liquidez | 194, 195; componente 6 |
| KPI-04 NICAP | 212, 213 |
| KPI-05 tasa activa | 145, 13 |
| KPI-06 tasa pasiva | 153, 35 |
| KPI-07 capital/activo | 46, 5 |
| KPI-08 ROA | 141, 5 |
| KPI-09 colocación/captación | 13, 35 |
| M-01 participación femenina | 203, 204 |

También están las filas publicadas de contraste 177, 185, 193, 196, 198, 210, 217 y 224, y el total contextual de socios 202. La presencia de conceptos **no implica que existan valores**: los hechos están vacíos y todavía no se pueden calcular indicadores. Las métricas institucionales, FONACOT y SNIIV dependen de sus propias tablas de hechos, no de filas adicionales de `Series`.

## Respaldo y versión del esquema

- Archivo externo: `D:\moimoi\dashboard_caja_ahorro_base.backup`.
- Tamaño: **51.601 bytes**.
- SHA-256: `4fc99652ce76c7f76184b2c83d54b6b543953bdcb55f7b3b416a1c24e2c993b5`.
- `pg_restore --list` identifica formato **CUSTOM**, compresión gzip, 106 entradas, respaldo creado con `pg_dump 17.4` desde PostgreSQL 17.4. Fecha indicada en la cabecera: `2026-11-25 08:37:09`; la cabecera no indica zona horaria.
- Commit que incorporó `Database/01_schema.sql`: **`a89dfcc9d9ffc867902c0dfa7dba698a68862063`**. La carga de catálogos está en `498f1c2`; la comparación actual no pretende ser una verificación bit a bit del DDL contra el commit.

## Restauración para el coordinador

Trabajar en una base **nueva y vacía**, con nombre elegido para ese propósito; no apuntar a la base original ni a una base con información. La creación de la base y sus permisos debe realizarla un administrador autorizado; el usuario de aplicación no requiere privilegios administrativos. Usar PostgreSQL/`pg_restore` 17 compatible, y comprobar previamente el SHA-256 del archivo recibido. No usar `--clean` ni sobrescribir recursos existentes.

Ejemplo en PowerShell, sustituyendo `BASE_VACIA_DESTINO` por el nombre de la base recién preparada y de la que `dashboard_user` sea propietario:

```powershell
Get-FileHash -Algorithm SHA256 'D:\moimoi\dashboard_caja_ahorro_base.backup'
& 'C:\Program Files\PostgreSQL\17\bin\pg_restore.exe' --list 'D:\moimoi\dashboard_caja_ahorro_base.backup'
& 'C:\Program Files\PostgreSQL\17\bin\pg_restore.exe' --exit-on-error --no-owner --no-privileges -h localhost -p 5432 -U dashboard_user -d BASE_VACIA_DESTINO 'D:\moimoi\dashboard_caja_ahorro_base.backup'
```

Autenticarse mediante un mecanismo local seguro; no colocar contraseñas en la línea de comandos ni compartir `Backend/.env`. `--no-owner --no-privileges` deja la propiedad y permisos según el usuario restaurador y la base destino: no restaura necesariamente las ACL originales. Verificar salida de `pg_restore`, estructura, recuentos, secuencias y contenido tras la restauración. La comparación documentada arriba confirma el estado de la restauración de prueba existente, no una nueva ejecución de esos comandos.

## Pendientes para el coordinador

- Integrar y revisar la entrega de la rama según el flujo del proyecto; aquí no se hizo commit, push ni merge.
- La fase III deberá cargar y validar hechos, linaje de ejecuciones, instantáneas completas y ventanas de 12 meses; no presentar KPIs como calculados antes de contar con ellos.
- Validar códigos geográficos SNIIV contra un catálogo INEGI completo, revisar historia institucional y conciliar fuentes de acuerdo con `docs/mapeo_catalogos.md`.
- Validar precisión antes de insertar `numeric(p,s)` para evitar redondeo silencioso y conservar las limitaciones de unidad inferida CNBV y diferencias entre fuentes.
- Definir almacenamiento seguro, transferencia, retención y verificación periódica del respaldo; no se hizo una nueva copia durante esta validación.
