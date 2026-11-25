# ETL local — arranque y ejecución (pasos 10 y 14)

**Rama:** `feature/fase-3-etl`, creada desde `main` en `f6ace0e` (ese commit ya contiene el merge de `feature/database`, último commit `c109371`). El modelo de la fase II (`docs/modelo_datos.md`, `docs/diccionario_datos.md`, `Database/01_schema.sql`) se consultó en ese commit **solo como lectura**: no se editaron `Database/`, `Backend/`, `Frontend/` ni `data/raw/`.

**Alcance:** extracción, transformación y validación local de CNBV, FONACOT y SNIIV. **No** se instala ni configura PostgreSQL, **no** se usa `DATABASE_URL` y **no** se cargan hechos; la carga queda para la integración (ver [etl_integracion_pendiente.md](etl_integracion_pendiente.md)).

## Requisitos

- Python 3.14 (verificado con 3.14.3, Windows x64). Otras versiones 3.12+ deberían funcionar, pero no se probaron.
- Los 19 originales de `data/raw/` íntegros respecto de `data/raw/manifest.json` (el ETL lo comprueba antes y después de cada ejecución).

## Instalación (PowerShell, desde la raíz)

```powershell
python -m venv .venv                                   # solo si no existe
.\.venv\Scripts\python.exe -m pip install -r ETL\requirements.txt
```

`ETL/requirements.txt` fija pandas 3.1.1, openpyxl 3.1.5, python-dotenv 1.2.4 y pytest 9.2.0 con sus dependencias. No incluye SQLAlchemy ni psycopg porque el ETL local no se conecta a ninguna base.

## Configuración (opcional)

Sin configuración se usan los valores por defecto. Para cambiarlos, copiar `ETL/.env.example` a `ETL/.env` (ignorado por Git) o definir variables de entorno:

| Variable | Defecto | Uso |
|---|---|---|
| `ETL_RAW_DIR` | `data/raw` | Originales y `manifest.json` |
| `ETL_PROCESSED_DIR` | `data/processed` | Salidas normalizadas, manifiesto de salidas y registros |
| `ETL_LOG_LEVEL` | `INFO` | `DEBUG` muestra cada validación aprobada |
| `ETL_CNBV_MES_DESDE` / `ETL_CNBV_MES_HASTA` | `2024-02` / `2025-12` | Ventana de `SH_SOCAPS.xlsm!Series` exportada. 2024-02 es el primer mes requerido por la ventana de 12 meses de 2025-01 (ROA y tasas implícitas) |

`ETL/config.py` centraliza rutas, ventana, versión del proceso (`etl-local-fase3-1.0`) y logging (consola + archivo en `data/processed/logs/`). Nunca lee ni registra credenciales.

## Ejecución

```powershell
.\.venv\Scripts\python.exe ETL\run_etl.py                          # CNBV + FONACOT + SNIIV
.\.venv\Scripts\python.exe ETL\run_etl.py --fuente cnbv            # una fuente
.\.venv\Scripts\python.exe ETL\run_etl.py --fuente fonacot sniiv   # varias
.\.venv\Scripts\python.exe ETL\run_etl.py --salida C:\ruta\otra    # otro directorio de salida
```

Flujo de `ETL/run_etl.py`:

1. Verifica tamaño y SHA-256 de los 19 originales contra el manifiesto; si alguno falta o difiere, se detiene.
2. Ejecuta cada fuente (`cnbv_etl.py`, `fonacot_etl.py`, `sniiv_etl.py`) en un directorio temporal `data/processed/.staging_*`.
3. Ejecuta `validations.py` sobre esas salidas. Cualquier prueba con resultado `falla` cancela la ejecución completa.
4. Vuelve a verificar los 19 originales y solo entonces reemplaza las salidas vigentes (`os.replace` por archivo) y actualiza `data/processed/etl_manifest.json`. Si algo falla, las salidas anteriores quedan intactas y el directorio temporal se elimina.
5. Escribe `data/processed/logs/etl_<UTC>.log` y `ejecucion_<UTC>.json` (estado, fuentes, duración, pruebas y error si lo hubo).

Códigos de salida: `0` éxito, `1` error de lectura/validación, `2` opción `--cargar` (reservada; la carga SQL no está implementada y la función `cargar_postgres` lanza `NotImplementedError`).

## Salidas

| Archivo (`data/processed/`) | Filas | Versionado |
|---|---:|---|
| `cnbv_sector_mes.csv` | 598 | No (regenerable) |
| `cnbv_institucion_trim.csv` | 620 | No |
| `cnbv_total_trim.csv` | 4 | No |
| `fonacot.csv` | 792 | No |
| `sniiv.csv` (≈24 MB) | 325,649 | No |
| `rechazos_<fuente>.csv` | 9 / 0 / 0 | No |
| `etl_manifest.json` | — | **Sí**: determinista (sin fechas), con SHA-256, grano, columnas, unidades, filas, rechazos, conciliación y pruebas por fuente |
| `logs/` | — | No |

`data/processed/.gitignore` excluye todo salvo el manifiesto. Formato de CSV: UTF-8, coma, salto LF, decimales con punto y **campo vacío = NULL** (no hay cadenas vacías como valor).

## Pruebas

```powershell
.\.venv\Scripts\python.exe -m pytest ETL\tests -q
```

Resultado observado el 2026-11-25: **19 passed en 26 s**. Las pruebas ejecutan el pipeline real dos veces en directorios temporales (no tocan `data/processed/`). Detalle en [etl_calidad.md](etl_calidad.md).

## Ejecución registrada

| Comando | Resultado |
|---|---|
| `.\.venv\Scripts\python.exe ETL\run_etl.py` | Éxito en ≈13 s; 19/19 originales antes y después; 94 pruebas, 0 fallas, 3 advertencias de escala decimal |
| Segunda ejecución en otro directorio | Los 8 CSV y `etl_manifest.json` tienen SHA-256 idénticos a la primera |
| `pytest ETL\tests -q` | 19 passed |
