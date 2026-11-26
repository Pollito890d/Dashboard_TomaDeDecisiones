# Dashboard de Toma de Decisiones

## Objetivo

Construir un tablero gerencial para el análisis de liquidez, cartera, recuperación y contexto externo de una caja de ahorro y préstamo, utilizando **exclusivamente datos abiertos reales** de **CNBV**, **FONACOT** y **SNIIV**. No se generan datos sintéticos nuevos.

El frontend consume la API oficial de FastAPI y no sustituye respuestas fallidas por datos ilustrativos. Los datos del wireframe académico se conservan únicamente como línea base documental ([`docs/auditoria.md`](docs/auditoria.md)).

## Arquitectura implementada

```
Fuentes abiertas (CNBV · FONACOT · SNIIV)
         │
         ▼
    ETL/  (extracción, validación y transformación con Python)
         │  data/raw/<fuente>/  →  data/processed/
         ▼
  Database/  (esquema, vistas y validación PostgreSQL)
         │
         ▼
  Backend/   (API FastAPI de solo lectura: ocho rutas GET + /docs)
         │
         ▼
  Frontend/  (React + Vite + Tailwind + Recharts; consume la API, sin mock)
```

Los contratos y la línea base están documentados en [`docs/auditoria.md`](docs/auditoria.md). El catálogo definitivo de indicadores está en [`docs/catalogo_kpis.md`](docs/catalogo_kpis.md).

## Estructura de carpetas

```
.
├── Backend/            API FastAPI (Fase V y correcciones de la fase VI)
│   ├── app/            Configuración, repositorios, servicios, routers y esquemas
│   ├── tests/          Suite Pytest del backend (82 pruebas)
│   └── .env.example    Plantilla de configuración, sin credenciales reales
├── Database/
│   ├── 01_schema.sql              Esquema de referencia (sin cambios)
│   ├── 04_validation.sql          Validación atómica de Fase IV
│   ├── tests/validacion_kpis.sql  Suite SQL asertiva de KPIs
│   └── views/                     14 vistas base y de KPIs
├── ETL/                ETL local, cargador PostgreSQL y pruebas
├── scripts/            run_sql_docker.py (ejecutor SQL en Windows)
├── data/
│   ├── raw/            Originales verificados (19 archivos, no modificados)
│   └── processed/      Salidas normalizadas y manifiesto determinista
├── docs/               Auditoría, catálogo, conciliación y validación
├── Frontend/           Aplicación React integrada al contrato 1.0.0
└── .gitignore          Reglas de seguridad, temporales y artefactos
```

Los archivos `.env` reales están ignorados. Ninguna credencial se guarda en el repositorio ni se imprime al ejecutar los comandos.

## Ejecución del ETL

Requisitos: Python 3 con entorno `.venv` y los 19 originales verificados en `data/raw/`.

Modo local (no requiere PostgreSQL):

```powershell
.\.venv\Scripts\python.exe ETL\run_etl.py
.\.venv\Scripts\python.exe ETL\run_etl.py --fuente cnbv
```

El modo local publica salidas en `data/processed/` solo si todas las validaciones pasan. Las advertencias esperadas por redondeo (`186` importes, `1` y `3,655` porcentajes) se documentan en [`docs/etl_calidad.md`](docs/etl_calidad.md).

Carga PostgreSQL (exige las tres fuentes):

```powershell
.\.venv\Scripts\python.exe ETL\run_etl.py --cargar
```

`--cargar` delega en `ETL/load_facts.py`: una sola transacción, 19 filas de trazabilidad, cinco tablas de hechos, FK y precisión verificadas, idempotencia por SHA-256 y rollback ante cualquier error. Sin `--cargar` no se abre conexión a la base.

## Backend (Fase V)

La API es de **solo lectura** (`default_transaction_read_only=on`) y expone ocho rutas GET: `/api/health`, `/api/dashboard`, `/api/instituciones`, `/api/instituciones/catalogo`, `/api/periodos`, `/api/fuentes`, `/api/fonacot` y `/api/sniiv`. `/api/periodos` acepta además `fuente=cnbv_sectorial|cnbv_institucional|fonacot|sniiv` para listar períodos con observaciones de la ejecución activa; omitirlo conserva el catálogo `dim_mes` original. El contrato JSON `1.0.0` está en [`docs/api_contract.md`](docs/api_contract.md) y la evidencia de validación en [`docs/validacion_backend.md`](docs/validacion_backend.md).

Requisitos: PostgreSQL `dashboard-postgres` en funcionamiento y `Backend/.env` creado a partir de `Backend/.env.example` con la `DATABASE_URL` local (el archivo real está ignorado por Git).

```powershell
# 1) Dependencias (una sola vez)
.\.venv\Scripts\python.exe -m pip install -r Backend\requirements.txt

# 2) Pruebas del backend (82 pruebas)
.\.venv\Scripts\python.exe -m pytest Backend\tests -q

# 3) Arrancar Uvicorn en localhost:8000
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir Backend --host 127.0.0.1 --port 8000
```

Con el servidor activo: Swagger en <http://127.0.0.1:8000/docs> y esquema OpenAPI en <http://127.0.0.1:8000/openapi.json>. Si el contenedor se detiene, `/api/health` responde `503` en ~5 segundos; al reiniciarlo con `docker start dashboard-postgres` la API se recupera sin reiniciar Uvicorn.

Ejemplos rápidos:

```powershell
# Salud y cortes disponibles
curl http://127.0.0.1:8000/api/health
curl "http://127.0.0.1:8000/api/periodos?anio=2025&limite=3"
curl "http://127.0.0.1:8000/api/periodos?fuente=cnbv_sectorial"

# KPIs sectoriales mensuales, ranking y catálogo completo de cooperativas
curl "http://127.0.0.1:8000/api/dashboard?periodo=2025-12"
curl "http://127.0.0.1:8000/api/instituciones?trimestre=2025-Q4&limite=10"
curl http://127.0.0.1:8000/api/instituciones/catalogo

# Contexto externo (los desgloses son opcionales)
curl "http://127.0.0.1:8000/api/fonacot?anio=2025&trimestre=2025-Q4"
curl "http://127.0.0.1:8000/api/sniiv?anio=2025"
```

## Validación en Windows

No hay `psql` instalado en el host. El único ejecutor SQL es:

```powershell
.\.venv\Scripts\python.exe scripts\run_sql_docker.py Database/04_validation.sql
.\.venv\Scripts\python.exe scripts\run_sql_docker.py Database/tests/validacion_kpis.sql
```

El script valida `Backend/.env` contra el destino local y ejecuta el SQL dentro del contenedor Docker `dashboard-postgres`. Las suites fallan con `RAISE EXCEPTION` si faltan datos o si una diferencia excede la tolerancia.

Pruebas Python:

```powershell
.\.venv\Scripts\python.exe -m pytest ETL/tests -q -s
```

Resultado real de la ejecución final: `28 passed in 85.05s`; validación Fase IV `VALIDACION_FASE_IV_OK`; suite de KPIs `VALIDACION_KPIS_ASERTIVA_OK`; ejecución activa comprobada contra `ejecucion_etl`, sin identificador fijo.

## Ejecución del frontend

Requisitos: Node.js 18+ y npm.

```bash
cd Frontend
npm ci
npm run dev
```

Abrir <http://localhost:5173>. Compilación de producción y vista previa:

```bash
npm run build      # genera Frontend/dist/
npm run preview    # sirve la compilación generada
```

El frontend obtiene la selección inicial de la ejecución activa: períodos observados por fuente (`CNBV` sectorial e institucional, `FONACOT`, `SNIIV`) y catálogo completo de 155 cooperativas. El comparativo institucional sigue limitado a 10 fichas, pero ese tope ya no reduce las opciones del selector. Los cambios rápidos de filtros descartan respuestas obsoletas mediante cancelación y una guarda de secuencia. Si FastAPI no responde, se muestra el error y se ofrece reintento; no se usan datos de demostración.

Pruebas unitarias ligeras de las derivaciones del frontend (sin dependencias nuevas):

```bash
node --test Frontend/tests/dashboardApi.test.js
```

Detalle de resultados y pendientes: [`docs/validacion_frontend.md`](docs/validacion_frontend.md).

## Estado del proyecto

- Pasos 01–05: auditoría, organización, catálogo definitivo de KPIs y propuesta de visualización.
- Pasos 06–11: esquema, catálogos, perfilado, conciliación y calidad del ETL.
- Pasos 12–14: ETL local con validación asertiva y manifiesto determinista.
- Pasos 15–17: integración PostgreSQL, 14 vistas/KPIs y validación con evidencia real.
- Pasos 18–21: backend FastAPI de solo lectura, contrato JSON `1.0.0` y ocho rutas GET.
- Paso 22: suite del backend (82 pruebas), comparaciones SQL independientes y validación HTTP con PostgreSQL detenido y recuperado.
- Fase VI: frontend integrado al contrato oficial, filtros por fuente observada, catálogo institucional completo, guarda anti-respuestas obsoletas y pruebas específicas.

Detalle de la integración y las pruebas: [`docs/etl_integracion_pendiente.md`](docs/etl_integracion_pendiente.md), [`docs/validacion_kpis.md`](docs/validacion_kpis.md), [`docs/validacion_backend.md`](docs/validacion_backend.md) y [`docs/api_contract.md`](docs/api_contract.md).

Pendiente: verificación interactiva en navegador y comprobación visual del error al desconectar FastAPI; no hay herramienta de navegador ni dependencias de prueba de navegador en el entorno. No se inició la fase VII.
