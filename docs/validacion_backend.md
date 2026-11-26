# Validación del backend — Fase V, paso 22

**Rama:** `feature/fase-5-backend` · **Contrato JSON:** `1.0.0` · **Fecha:** 2026-11-25  
**Alcance:** únicamente la suite puntual del backend. No se ejecutó ETL, no se leyeron archivos originales, no se repitieron suites de fases anteriores, no se modificó el esquema ni `Frontend/`.

## 1. Suite Pytest

```powershell
.\.venv\Scripts\python.exe -m pytest Backend/tests -q
```

| Archivo | Pruebas | Resultado |
|---|---:|---|
| `Backend/tests/test_servicios.py` | 9 | 9 aprobadas (preexistentes) |
| `Backend/tests/test_health.py` | 3 | 3 aprobadas (preexistentes) |
| `Backend/tests/test_endpoints.py` | 7 | 7 aprobadas (preexistentes) |
| `Backend/tests/test_contrato_api.py` | 54 | 54 aprobadas (nuevas) |
| `Backend/tests/test_sql_independiente.py` | 6 | 6 aprobadas (nuevas) |
| **Total** | **79** | **79 aprobadas, 0 fallidas** |

Resultado real de la ejecución final: `79 passed in 13.27s` (ejecución inmediatamente anterior: `79 passed in 12.70s`).

Durante el desarrollo de la suite aparecieron 3 fallos: dos defectos reales de los routers y una expectativa incorrecta en una prueba nueva (un año sin filas en el catálogo es una respuesta controlada, no un error). Tras corregirlos, la suite quedó en 79/79.

### Casos cubiertos por las 60 pruebas nuevas

- Contrato `1.0.0` en los seis endpoints de datos; `/api/health` sin versión por diseño.
- Los siete endpoints (incluido health) responden `200` con parámetros válidos.
- 21 combinaciones inválidas: formatos de fecha (`2025-1`, `2025-00`, `2025-13`, `2025-12-01`), años fuera de rango o sin catálogo, mes no trimestral, `trimestre=2025-Q5`, claves de 5 dígitos y no numéricas, `limite=0/101`, fuentes/roles desconocidos y `anio`/`trimestre` incoherentes. Todas devuelven `422` con `contrato_version` y `detail`, sin datos del mock.
- Límites `1` y `100` verificados: nunca más filas que el tope solicitado.
- Períodos del catálogo sin observaciones (`2013-01`, `2026-09`, `2013` institucional/FONACOT, `2024` SNIIV, `anio=2027` en catálogo): `200` con `sin_datos: true`, listas vacías o `corte: null`.
- Nulos oficiales conservados: banda KPI-01 sin umbral, KPI-04 con umbral `100.0000000000`, KPI-03 institucional `null`, `descargado_en` nulo en fuentes y `cve_ent` nulo en SNIIV.
- Fallo de PostgreSQL simulado en cada uno de los seis endpoints: `503` exacto `{"contrato_version":"1.0.0","detail":"PostgreSQL no está disponible."}`; la excepción inyectada contenía texto de contraseña y no aparece en la respuesta.
- Ausencia de claves/valores del mock (`cuotas_vencidas`, `sucursal`, `8w`, `Socio 001`, etc.) en respuestas correctas y de error.

## 2. Comparaciones SQL independientes

Las pruebas de `test_sql_independiente.py` consultan las **tablas de hechos** con `sqlalchemy.text()` (`hecho_cnbv_sector_mes`, `hecho_cnbv_institucion_trim`, `hecho_fonacot_mes`, `hecho_sniiv_mes` y sus dimensiones), sin usar repositorios, servicios ni las vistas de KPIs. Los valores se comparan con `Decimal` exacto contra la respuesta HTTP.

### Nueve KPIs sectoriales, corte `2025-12`

| Indicador | API | SQL independiente |
|---|---:|---:|
| KPI-01 IMOR | 4.0549697085 | 4.0549697085 |
| KPI-02 ICOR | 127.5907268062 | 127.5907268062 |
| KPI-03 Liquidez | 35.6261802328 | 35.6261802328 |
| KPI-04 NICAP | 300.2533349855 | 300.2533349855 |
| KPI-05 Tasa activa | 18.2304798424 | 18.2304798424 |
| KPI-06 Tasa pasiva | 5.2719823640 | 5.2719823640 |
| KPI-07 Capital/activo | 17.8527845893 | 17.8527845893 |
| KPI-08 ROA | 2.1536581163 | 2.1536581163 |
| KPI-09 Colocación/captación | 69.2030772470 | 69.2030772470 |
| M-01 Participación femenina | 54.2112064685 | 54.2112064685 |

### Ranking institucional `2025-Q4` (top 10)

Claves devueltas por la API y por la SQL directa, en el mismo orden: `029056`, `029090`, `029045`, `029033`, `029020`, `029005`, `029093`, `029006`, `029040`, `029210`. Activo y `rank_activo_mayor_tamano` coinciden fila por fila; el primero es `029056` con `126888191520.000000` MXN y ranking `1`.

### FONACOT `2025-Q4`

| Campo | API = SQL |
|---|---:|
| Créditos nacionales | 561561 |
| Monto nacional (MXN) | 16889088475.450000 |
| Participación femenina en créditos (%) | 41.8268006503 |
| Participación femenina en monto (%) | 38.8003703209 |
| Ticket promedio (MXN) | 30075.251799 |
| Créditos entidades / canal APP MOVIL | 512257 / 49304 |

### SNIIV `2025`

| Campo | API = SQL |
|---|---:|
| Registros CSV | 325649 |
| Acciones | 998745 |
| Monto (MXN) | 617246458236.390000 |
| Filas sin sexo | 399 |
| Participación femenina en acciones (%) | 45.2635868559 |
| Participación INFONAVIT en acciones (%) | 66.7795082829 |

## 3. Solo lectura, credenciales y ausencia de datos ficticios

- `SHOW default_transaction_read_only` devuelve `on` tanto en la sesión de los servicios como en la sesión SQL independiente.
- Las consultas de los repositorios son `SELECT` sobre vistas/catálogos; las consultas de validación son `SELECT` contra tablas de hechos. No se ejecutó DDL/DML ni ETL.
- La contraseña configurada en `Backend/.env` se toma de `settings.database_url` solo para comprobar que **no aparece** en `/api/health`, los seis endpoints, un error `422`, `/openapi.json` ni en las respuestas `503`. Tampoco se imprimió en consola.
- Los errores `4xx`/`503` no contienen datos del dataset sintético: se validan claves y valores del mock en todas las respuestas de error.

## 4. HTTP real con Uvicorn

Arranque (con PostgreSQL en funcionamiento):

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir Backend --host 127.0.0.1 --port 8000
```

Comprobaciones reales sobre `http://127.0.0.1:8000`:

| Petición | Resultado |
|---|---|
| `GET /docs` | `200`, contiene Swagger UI |
| `GET /openapi.json` | `200`, `info.version = 1.0.0`, siete rutas: `/api/health`, `/api/dashboard`, `/api/instituciones`, `/api/periodos`, `/api/fuentes`, `/api/fonacot`, `/api/sniiv` |
| `GET /api/health` | `200`, `{"status":"ok","database":"connected","detail":null}` (52 bytes) |
| `GET /api/dashboard?periodo=2025-12` | `200`, contrato `1.0.0`, `sin_datos: false`, 28 512 bytes |
| `GET /api/instituciones?trimestre=2025-Q4&limite=3` | `200`, 3 fichas, 4 710 bytes |
| `GET /api/periodos?anio=2025&limite=2` | `200`, 159 bytes |
| `GET /api/fuentes?fuente=SNIIV&limite=2` | `200`, 941 bytes |
| `GET /api/fonacot?anio=2025&trimestre=2025-Q4` | `200`, 883 bytes |
| `GET /api/sniiv?anio=2025` | `200`, 910 bytes |
| `GET /api/dashboard?periodo=2025-13` | `422`, envelope con `contrato_version` y detalle del campo `query.periodo` |

Los desgloses pesados no se pidieron por omisión, por lo que no se generaron respuestas masivas.

## 5. PostgreSQL detenido y recuperación

1. `docker stop dashboard-postgres` → contenedor detenido.
2. `GET /api/health` → `503` con `status: "unavailable"`, `database: "disconnected"` y `detail: "PostgreSQL no está disponible."`.
3. `GET /api/dashboard?periodo=2025-12` → `503` con `contrato_version: "1.0.0"` y sin datos del mock.
4. `docker start dashboard-postgres` → contenedor `Up`; `SELECT 1` vuelve a responder inmediatamente.
5. `GET /api/health` → `200` (`connected`); `GET /api/dashboard?periodo=2025-12` → `200` con `periodo_solicitado: "2025-12"` y `sin_datos: false`. El pool existente se recuperó sin reiniciar Uvicorn.

**Defecto detectado y corregido:** antes del paso 22, con el contenedor detenido psycopg esperaba indefinidamente y `/api/health` no respondía (timeout de cliente superior a 60 s). Se añadió `connect_timeout=5` en `Backend/app/database.py`; ahora el fallo se convierte en `503` en ~5 s.

## 6. Defectos corregidos durante las pruebas

| Síntoma | Corrección |
|---|---|
| `/api/instituciones?clave_seis=029056` devolvía 4 trimestres con `corte: null` y `trimestre: null` | El corte por defecto también se aplica cuando solo se filtra por clave (`Backend/app/routers/instituciones.py`); ahora devuelve la ficha de `2025-Q4`. |
| `/api/fonacot?anio=2025&trimestre=2024-Q1` devolvía `200` vacío aunque los filtros eran incoherentes | Validación `anio` ↔ año del `trimestre` y derivación del año cuando solo se envía trimestre (`Backend/app/routers/fonacot.py`); ahora `422`. |
| `/api/health` colgaba con PostgreSQL detenido | `connect_timeout=5` en la configuración de SQLAlchemy (`Backend/app/database.py`). |
| Prueba nueva esperaba `422` para `/api/periodos?anio=2027` | Expectativa corregida: es un filtro de catálogo válido sin filas, por lo que debe ser `200` con `sin_datos: true`. |

## 7. Archivos modificados en este paso

- `Backend/tests/test_contrato_api.py` (nuevo, 54 pruebas).
- `Backend/tests/test_sql_independiente.py` (nuevo, 6 pruebas).
- `Backend/tests/conftest.py` (fixture `sesion` para SQL directo).
- `Backend/app/routers/instituciones.py`, `Backend/app/routers/fonacot.py`, `Backend/app/database.py` (correcciones de defectos).
- `docs/validacion_backend.md` (este documento).
- `docs/api_contract.md` (reglas de coherencia confirmadas en las pruebas).
- `README.md` (comandos de arranque y pruebas del backend).

## 8. Pendientes

- La migración del frontend sigue fuera de alcance: `fetchDashboardData` todavía envía `periodo=8w` y `sucursal=ALL` y conserva el fallback al mock.
- No se hizo commit ni merge. El contenedor `dashboard-postgres` quedó funcionando y Uvicorn quedó escuchando en `127.0.0.1:8000` al final de la validación.
