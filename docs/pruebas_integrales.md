# Pruebas integrales y arranque reproducible — Fase VII (pasos 27 y 28)

**Fecha:** 2026-11-26 · **Rama:** `main` · **Estado:** sin commit ni merge.
**Alcance:** validación extremo a extremo y arranque Windows reproducible. No se reanalizaron los 19 originales, no se ejecutó el ETL con `--cargar` sobre la base de trabajo, no se modificaron fórmulas, esquema ni datos oficiales. Los artefactos originales de fase VII (`feature/fase-7-integracion`, commit `5dc7f33`) se trajeron al árbol de trabajo de `main` (`8f4247d`) sin commit ni merge; sobre ellos se aplicaron las correcciones de la sección 5. En esta ronda solo se ejecutaron comprobaciones de scripts: no se repitieron suites, no se reconstruyó la base y no se instalaron dependencias.

## 1. Trazabilidad de los nueve KPIs (`2025-12`)

Cadena verificada, reutilizando las conciliaciones existentes:

`data/raw/` (19 archivos con SHA-256 en `manifest.json`) → `ETL/run_etl.py` y `ETL/validations.py` → PostgreSQL (`ejecucion_etl`, `ejecucion_archivo`, cinco tablas de hechos) → `Database/views/01_vistas.sql` y `02_kpis.sql` → `GET /api/dashboard` → `Frontend/src/App.jsx`.

Evidencia reutilizada: `Database/tests/validacion_kpis.sql`, `ETL/tests`, `Backend/tests/test_sql_independiente.py`, `docs/validacion_kpis.md` y `docs/validacion_backend.md`. No se repitió el perfilado de los archivos originales.

| KPI | API JSON (`2025-12`) | SQL / catálogo | Valor publicado en `Series` | Dif. API–SQL |
|---|---:|---:|---:|---:|
| KPI-01 IMOR | 4.0549697085 | 4.0549697085 | 4.054970 | 0.0000000000 |
| KPI-02 ICOR | 127.5907268062 | 127.5907268062 | 127.590727 | 0.0000000000 |
| KPI-03 liquidez | 35.6261802328 | 35.6261802328 | 35.626180 | 0.0000000000 |
| KPI-04 NICAP | 300.2533349855 | 300.2533349855 | 300.253335 | 0.0000000000 |
| KPI-05 tasa activa | 18.2304798424 | 18.2304798424 | 18.230480 | 0.0000000000 |
| KPI-06 tasa pasiva | 5.2719823640 | 5.2719823640 | 5.271982 | 0.0000000000 |
| KPI-07 capital/activo | 17.8527845893 | 17.8527845893 | 17.852785 | 0.0000000000 |
| KPI-08 ROA | 2.1536581163 | 2.1536581163 | 2.153658 | 0.0000000000 |
| KPI-09 colocación/captación | 69.2030772470 | 69.2030772470 | elaboración propia | 0.0000000000 |

M-01 (participación femenina, contexto): `54.2112064685` en API y SQL. La suite SQL asertiva informó **diferencia máxima 0 pp contra el catálogo** y **0.0000004407 pp contra `Series`**, dentro de la tolerancia documentada. `docs/validacion_kpis.md` y `docs/validacion_backend.md` ya contenían los mismos valores.

## 2. Endpoints, filtros y estados

Peticiones HTTP reales contra FastAPI en `127.0.0.1:8000`, con la base de trabajo:

| Endpoint | Estado | Tiempo | Bytes |
|---|---:|---:|---:|
| `/api/health` | 200 | 255 ms | 52 |
| `/api/dashboard?periodo=2025-12` | 200 | 93 ms | 28512 |
| `/api/instituciones?trimestre=2025-Q4&limite=10` | 200 | 78 ms | 14763 |
| `/api/instituciones/catalogo` | 200 | 62 ms | 20211 |
| `/api/periodos?fuente=cnbv_sectorial` | 200 | 45 ms | 370 |
| `/api/periodos?fuente=cnbv_institucional` | 200 | 39 ms | 179 |
| `/api/periodos?fuente=fonacot` | 200 | 40 ms | 260 |
| `/api/periodos?fuente=sniiv` | 200 | 245 ms | 149 |
| `/api/fuentes` | 200 | 71 ms | 8415 |
| `/api/fonacot?anio=2025&trimestre=2025-Q4` | 200 | 57 ms | 883 |
| `/api/sniiv?anio=2025` | 200 | 823 ms | 910 |
| `/docs` | 200 | 32 ms | 1030 |

- Catálogo institucional real: `total=155`, `filas=155`.
- Períodos observados por fuente: CNBV sectorial 23, CNBV institucional 4, FONACOT 12, SNIIV 1 (`2025-12` sintetizado).
- Filtros, selección institucional, restablecimiento, cambios rápidos, nulos y guarda anti-respuestas obsoletas cubiertos por `Backend/tests/test_contrato_api.py`, `test_fase6_correcciones.py`, `test_health.py` y `Frontend/tests/dashboardApi.test.js`.
- **Sin mock activo:** búsqueda en `Frontend/src/` solo encontró textos explicativos en `App.jsx:139` y `services/dashboardApi.js:9,72`; no hay adaptador ni archivo con datos ilustrativos. Ante error de API se muestra el aviso y reintento, sin sustituir la respuesta.

### Caída y recuperación de FastAPI

Se detuvieron únicamente los PIDs de Uvicorn (`8664` y el hijo `20564`); PostgreSQL y Vite quedaron intactos.

- Puerto `8000` cerrado en 2968 ms.
- `GET /api/health` con servidor caído: `No es posible conectar con el servidor remoto`.
- Reinicio con el mismo comando (PID `16604`): `200` con `{"status":"ok","database":"connected","detail":null}` en 9153 ms acumulados.
- `/api/dashboard?periodo=2025-12` volvió a `200` y 28512 bytes.

La comprobación fue de servidor; el aviso visual en React queda pendiente (sección 7).

## 3. Suites ejecutadas una sola vez

| Comando | Resultado |
|---|---|
| `.\.venv\Scripts\python.exe -m pytest Backend\tests -q` | `82 passed in 15.33s` |
| `node --test Frontend/tests/dashboardApi.test.js` | `4 passed`, `0 failed`, `250.4932 ms` |
| `npm run build` (en `Frontend/`) | correcto: 2194 módulos, `built in 14.18s`; solo aviso de chunk >500 kB |

No se repitieron las suites: el único defecto corregido fue en `scripts/start.ps1` (`npm.ps1` no es ejecutable con `Start-Process`), ajeno a las pruebas de aplicación.

## 4. Arranque reproducible (paso 28)

### Scripts creados

- `scripts/setup.ps1`: reutiliza o crea `.venv`, instala `Backend/requirements.txt` y `ETL/requirements.txt`, ejecuta `pip check`, instala el frontend con `npm ci` si falta `node_modules`, y crea `.env` desde las plantillas **solo si no existen**. No imprime ni versiona credenciales. `-SoloComprobar` informa del estado sin instalar ni copiar nada.
- `scripts/run_etl.ps1`: por defecto ejecuta solo el ETL local; `-InicializarBase` crea esquema, catálogos y vistas en base vacía; `-Cargar` carga las cinco salidas y valida; `-SinValidar` y `-Contenedor` permiten ajustar el flujo. `-Contenedor` se propaga a todas las operaciones SQL y `-SoloComprobar` valida sin escrituras.
- `scripts/run_sql_docker.py`: acepta `--contenedor` (por defecto `dashboard-postgres`) y `--validar`. Antes de ejecutar cualquier SQL comprueba que el contenedor está activo, publica el puerto de `DATABASE_URL` y expone `dashboard_user/dashboard_caja_ahorro`. Nunca imprime la contraseña.
- `scripts/start.ps1`: comprueba DB y `.env`, inicia o verifica FastAPI y Vite de forma idempotente; acepta `-ApiPort`, `-FrontPort`, `-NoReload` y `-SkipDbCheck`.

### Procedimiento verificado en copia limpia aislada

1. Copia de `HEAD` con `git archive` en `%TEMP%\opencode\fase7-clean` (sin `.venv`, `node_modules`, ni `.env`).
2. `setup.ps1`: Python 3.14.6, `.venv` nuevo, `pip check` sin incidentes, `npm ci` con 170 paquetes en 34 s. Se observaron avisos no bloqueantes de `npm audit` y de `allow-scripts` para `esbuild`.
3. `.env` generados desde plantillas y ajustados **solo en la copia** para el entorno aislado.
4. PostgreSQL aislado: contenedor `dashboard-postgres-fase7`, volumen `dashboard_pgdata_fase7`, `127.0.0.1:5433`. El contenedor de trabajo `dashboard-postgres` siguió en `127.0.0.1:5432` sin modificación. **Condición importante:** los validadores de esa copia temporal fueron parcheados para aceptar `5433`; no eran los scripts oficiales. Los scripts oficiales corregidos restringen el destino a `127.0.0.1:5432`, usuario `dashboard_user` y base `dashboard_caja_ahorro`, y rechazan cualquier desajuste antes de escribir. Por eso la prueba aislada no se repitió con el código corregido ni se cargó la base principal.
5. `run_etl.ps1 -InicializarBase -Cargar -Contenedor dashboard-postgres-fase7`: esquema (13 tablas, 35 índices), catálogos (19/19 archivos, 165 meses, 155 instituciones, 26 conceptos, 33 ámbitos, 2 géneros), 14 vistas, carga en ejecución `1` con `598 / 620 / 4 / 792 / 325649` filas. Resultados: `VALIDACION_FASE_IV_OK` y `VALIDACION_KPIS_ASERTIVA_OK`.
6. `start.ps1 -ApiPort 8010 -FrontPort 5174`: `/api/health` 329 ms, `/api/dashboard` 146 ms, `/api/sniiv` 1110 ms, `/docs` 41 ms, los 12 extremos en `200` y los nueve KPIs idénticos; frontend sirvió 912 bytes con `<title>`.
7. Segunda ejecución de `start.ps1`: ambos puertos ya en escucha, sin procesos duplicados; health, docs y frontend verificados de nuevo.
8. Repetición de `run_etl.ps1 -Cargar`: `omitida_idempotente`, ejecución `1`. Recuentos antes y después idénticos: `1 / 598 / 620 / 4 / 792 / 325649`.
9. Limpieza: servicios, contenedor, volumen y copia temporales eliminados. Quedaron activos `dashboard-postgres` (5432), FastAPI (8000) y Vite (5173).

### Defecto corregido durante la verificación

`start.ps1` usaba `Get-Command npm`, que en este Windows resuelve a `npm.ps1`; `Start-Process` no puede ejecutarlo (`%1 no es una aplicación Win32 válida`). Se cambió a `npm.cmd` del mismo directorio. Tras el cambio, Vite arrancó y la segunda ejecución fue idempotente. No hubo cambios en código de aplicación, fórmulas ni esquema.

## 5. Correcciones aplicadas sobre `main` y comprobaciones de scripts

| Corrección | Detalle |
|---|---|
| Coherencia contenedor/SQL | `run_sql_docker.py` tenía el contenedor fijo `dashboard-postgres` mientras `run_etl.ps1` exponía `-Contenedor`. Ahora el ejecutor acepta `--contenedor` (por defecto `dashboard-postgres`) y `--validar`, y `run_etl.ps1` propaga `-Contenedor` a todas las operaciones SQL. |
| Rechazo antes de escribir | `run_etl.ps1` ejecuta `scripts/check_db.py` y `scripts/run_sql_docker.py --contenedor <nombre> --validar` antes de `-InicializarBase` o `-Cargar`. El validador comprueba estado del contenedor, `HostPort` frente a `DATABASE_URL` y `current_user/current_database()`; si no coinciden, termina con error sin crear esquema, cargar catálogos ni insertar hechos. |
| Independencia del directorio | `Invoke-Python` (`run_etl.ps1`) e `Invoke-Checked` (`setup.ps1`) hacen `Push-Location $root` / `Pop-Location`, porque las rutas relativas que reciben Python/pip (`scripts\check_db.py`, `-r Backend\requirements.txt`, etc.) antes se resolvían contra el directorio del llamador. `run_sql_docker.py` ya resolvía sus rutas desde `Path(__file__)`. |
| No sobrescritura de `.env` | `setup.ps1` solo copia las plantillas si el destino no existe; con `-SoloComprobar` informa «existe; setup.ps1 no lo modificaría» sin escribir. |
| README | URL real del repositorio, versiones verificadas, contenedor con volumen persistente, creación de `dashboard_user`/`dashboard_caja_ahorro`, `.env` seguros, orden exacto `setup.ps1` → `run_etl.ps1` → `start.ps1`, tabla instalación nueva vs. base cargada y procedimiento nativo alternativo. |

Comprobaciones ejecutadas **solo sobre los scripts modificados**, con directorio de trabajo `C:\Users\alexv\AppData\Local\Temp\opencode` (distinto de la raíz del proyecto):

| Comando / comprobación | Resultado |
|---|---|
| Parser de PowerShell para `setup.ps1`, `run_etl.ps1`, `start.ps1` | `syntax_errors=0` en los tres |
| `ast.parse` de `scripts/run_sql_docker.py` | `ast_ok` |
| `setup.ps1 -SoloComprobar` desde otro directorio | exit `0`; informa que ambos `.env` existen y no se modifican |
| `run_etl.ps1 -SoloComprobar` desde otro directorio | exit `0`; `check_db.py` correcto y «Contenedor dashboard-postgres coherente con Backend/.env; sin escrituras.» |
| `run_etl.ps1 -SoloComprobar` tras la corrección de `Push-Location` | la primera ejecución falló con `can't open file '...\Temp\opencode\scripts\check_db.py'`; tras el cambio pasó a exit `0` |
| `run_sql_docker.py --contenedor dashboard-postgres-inexistente --validar` | exit `2`; mensaje `Configuración incompatible: No se pudo inspeccionar el contenedor dashboard-postgres-inexistente` |
| `run_etl.ps1 -SoloComprobar -Contenedor dashboard-postgres-inexistente` | exit `1`; se detiene en el validador, sin escrituras |
| `start.ps1` desde otro directorio | exit `0`; puertos `8000` y `5173` ya en escucha, sin procesos duplicados; health y `/docs` verificados |
| SHA-256 de `Backend/.env` antes y después | `2675BEF5…54F1C7B2`, sin cambios |
| SHA-256 de `Frontend/.env` antes y después | `96349F13…EC918E10E`, sin cambios |

No se repitieron las suites `82 passed`, `4 passed` ni `npm run build`; no se reconstruyó ni cargó la base, no se instalaron dependencias y no se ejecutó ninguna escritura SQL sobre la base principal.

## 6. Estado final de los cinco extremos

| Comprobación | Resultado |
|---|---|
| PostgreSQL `127.0.0.1:5432` | contenedor `dashboard-postgres` activo y `check_db.py` correcto |
| FastAPI `127.0.0.1:8000` | `/api/health` 200 (`database=connected`) |
| Swagger `/docs` | 200 |
| React `localhost:5173` | 200 |

## 7. Pendiente explícito para comprobación manual

No se ejecutaron pruebas visuales en navegador ni se generaron capturas: el entorno no proporciona herramienta de navegador y no se instalaron Playwright, Puppeteer, jsdom ni Vitest. Queda pendiente, **sin declarar aprobado**:

- Ver los nueve valores de `2025-12` renderizados en las tarjetas KPI.
- Restablecer filtros y comprobar que vuelve al corte y al catálogo iniciales.
- Comprobar el renderizado de valores nulos en tablas y gráficas.
- Ver el aviso de error y el botón de reintento con FastAPI detenido.
- Capturas de las tres pestañas para el expediente.

## 8. Punto de control 7

**Se cumple en el alcance ejecutable:** trazabilidad de los nueve KPIs, ocho endpoints, sin mock, recuperación de FastAPI, suites y build en verde, arranque reproducible desde copia limpia, idempotencia de carga y reinicio, servicios originales activos al finalizar y, sobre `main`, coherencia contenedor/SQL con rechazo previo a escrituras, scripts independientes del directorio y `.env` intactos (sección 5). La única reserva sigue siendo la verificación visual manual indicada en la sección 7, que no se ha aprobado.
