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
│   ├── 03_views.sql               Punto de entrada de las vistas modulares
│   ├── 04_validation.sql          Validación atómica de Fase IV
│   ├── tests/validacion_kpis.sql  Suite SQL asertiva de KPIs
│   └── views/                     14 vistas base y de KPIs
├── ETL/                ETL local, cargador PostgreSQL y pruebas
├── scripts/
│   ├── setup.ps1                  Instalación en Windows
│   ├── run_etl.ps1                ETL, base, carga y validación
│   ├── start.ps1                  Arranque/verificación de FastAPI y React
│   ├── check_db.py                Comprobación segura de PostgreSQL
│   └── run_sql_docker.py          Ejecutor SQL dentro del contenedor Docker
├── data/
│   ├── raw/            Originales verificados (19 archivos, no modificados)
│   └── processed/      Salidas normalizadas y manifiesto determinista
├── docs/               Auditoría, catálogo, conciliación y validación
│   └── pruebas_integrales.md      Evidencia de las fases VII (pasos 27 y 28)
├── Frontend/           Aplicación React integrada al contrato 1.0.0
└── .gitignore          Reglas de seguridad, temporales y artefactos
```

Los archivos `.env` reales están ignorados. Ninguna credencial se guarda en el repositorio ni se imprime al ejecutar los comandos.

## Inicio rápido en Windows

Desde la raíz del repositorio, en PowerShell:

```powershell
# 1) Clonar (una sola vez)
git clone <URL_DEL_REPOSITORIO> Dashboard_TomaDeDecisiones
cd Dashboard_TomaDeDecisiones

# 2) Instalar dependencias y crear .env desde plantillas
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1

# 3) Base vacía: esquema + catálogos + vistas + ETL + validaciones
powershell -ExecutionPolicy Bypass -File scripts\run_etl.ps1 -InicializarBase -Cargar

# 4) Arrancar/verificar FastAPI y React
powershell -ExecutionPolicy Bypass -File scripts\start.ps1
```

Si la base ya está cargada, omita el paso 3. Si solo desea regenerar las salidas locales sin tocar PostgreSQL:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_etl.ps1
```

## Requisitos en Windows

- Python 3.10 o superior (verificado con 3.14.6 x64) y `pip`.
- Node.js 18 o superior y `npm` (verificado con npm 11.16.0).
- Docker Desktop con el contenedor PostgreSQL `dashboard-postgres`, o PostgreSQL local en `127.0.0.1:5432`.
- Los 19 archivos originales en `data/raw/` con su `manifest.json` (incluidos en el repositorio).
- No se necesita `psql` en el host: `scripts/run_sql_docker.py` ejecuta SQL dentro del contenedor.

## Configuración manual (equivalente a los scripts)

### 1. Entorno virtual y dependencias

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r Backend\requirements.txt -r ETL\requirements.txt
.\.venv\Scripts\python.exe -m pip check
cd Frontend
npm ci
cd ..
```

### 2. Archivos `.env`

`setup.ps1` copia las plantillas solo si los archivos no existen; nunca los sobrescribe. Revise los valores locales:

- `Backend/.env`: definir `DATABASE_URL` con el usuario, la contraseña local, el host `127.0.0.1`, el puerto `5432` y la base `dashboard_caja_ahorro`. También `API_HOST`, `API_PORT=8000`, `LOG_LEVEL` y `CORS_ORIGINS=http://localhost:5173`.
- `Frontend/.env`: `VITE_API_URL=http://localhost:8000`.

No comparta ni versione estos archivos; la contraseña se sustituye en el entorno local, nunca en la plantilla.

### 3. PostgreSQL local o Docker

Con Docker (el contenedor del proyecto ya existe en el entorno de trabajo):

```powershell
docker ps --filter name=dashboard-postgres
.\.venv\Scripts\python.exe scripts\check_db.py
```

Para recrear un entorno vacío, un administrador debe crear el usuario `dashboard_user` y la base `dashboard_caja_ahorro` antes de ejecutar el esquema. No reutilice una base con datos para `-InicializarBase`; el propio DDL se cancela si encuentra tablas de usuario.

### 4. Esquema, catálogos, vistas y ETL

Los scripts existentes se ejecutan en este orden:

```powershell
.\.venv\Scripts\python.exe scripts\run_sql_docker.py Database\01_schema.sql
.\.venv\Scripts\python.exe ETL\load_catalogs.py
.\.venv\Scripts\python.exe scripts\run_sql_docker.py Database\views\01_vistas.sql
.\.venv\Scripts\python.exe scripts\run_sql_docker.py Database\views\02_kpis.sql
.\.venv\Scripts\python.exe ETL\run_etl.py --cargar
.\.venv\Scripts\python.exe scripts\run_sql_docker.py Database\04_validation.sql
.\.venv\Scripts\python.exe scripts\run_sql_docker.py Database\tests\validacion_kpis.sql
```

`ETL/run_etl.py` sin `--cargar` valida los 19 originales y publica salidas en `data/processed/` sin abrir conexión a PostgreSQL. Con `--cargar` exige las tres fuentes, carga en una sola transacción con trazabilidad SHA-256 y omite la inserción si las firmas ya están cargadas (idempotencia).

### 5. FastAPI y React

```powershell
# FastAPI en 127.0.0.1:8000
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir Backend --host 127.0.0.1 --port 8000 --reload

# React en localhost:5173 (otra terminal, desde Frontend/)
npm run dev
```

`scripts/start.ps1` hace lo mismo y verifica que los puertos ya estén activos antes de iniciar procesos nuevos. Opciones útiles: `-ApiPort 8010`, `-FrontPort 5174`, `-NoReload`, `-SkipDbCheck`.

## Verificación

```powershell
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/docs
curl "http://127.0.0.1:8000/api/dashboard?periodo=2025-12"
curl http://localhost:5173
```

Resultados esperados: PostgreSQL en `127.0.0.1:5432`, FastAPI en `127.0.0.1:8000`, Swagger en `/docs`, `/api/health` con `database=connected` y React en `localhost:5173`.

Suites y compilación:

```powershell
.\.venv\Scripts\python.exe -m pytest Backend\tests -q
node --test Frontend/tests/dashboardApi.test.js
cd Frontend
npm run build
cd ..
```

Evidencia real de la fase VII (incluye la reconstrucción en copia limpia con base aislada, idempotencia y pendientes visuales): [`docs/pruebas_integrales.md`](docs/pruebas_integrales.md). Detalle de fases anteriores: [`docs/validacion_kpis.md`](docs/validacion_kpis.md), [`docs/validacion_backend.md`](docs/validacion_backend.md), [`docs/validacion_frontend.md`](docs/validacion_frontend.md) y [`docs/api_contract.md`](docs/api_contract.md).

## Backend

La API es de **solo lectura** (`default_transaction_read_only=on`) y expone ocho rutas GET: `/api/health`, `/api/dashboard`, `/api/instituciones`, `/api/instituciones/catalogo`, `/api/periodos`, `/api/fuentes`, `/api/fonacot` y `/api/sniiv`. `/api/periodos` acepta además `fuente=cnbv_sectorial|cnbv_institucional|fonacot|sniiv` para listar períodos con observaciones de la ejecución activa; omitirlo conserva el catálogo `dim_mes` original. El contrato JSON `1.0.0` está en [`docs/api_contract.md`](docs/api_contract.md).

Ejemplos rápidos:

```powershell
curl http://127.0.0.1:8000/api/health
curl "http://127.0.0.1:8000/api/periodos?anio=2025&limite=3"
curl "http://127.0.0.1:8000/api/periodos?fuente=cnbv_sectorial"
curl "http://127.0.0.1:8000/api/dashboard?periodo=2025-12"
curl "http://127.0.0.1:8000/api/instituciones?trimestre=2025-Q4&limite=10"
curl http://127.0.0.1:8000/api/instituciones/catalogo
curl "http://127.0.0.1:8000/api/fonacot?anio=2025&trimestre=2025-Q4"
curl "http://127.0.0.1:8000/api/sniiv?anio=2025"
```

Si el contenedor se detiene, `/api/health` responde `503`; al reiniciarlo con `docker start dashboard-postgres` la API se recupera sin reiniciar Uvicorn.

## Frontend

El frontend obtiene la selección inicial de la ejecución activa: períodos observados por fuente y catálogo completo de 155 cooperativas. Los cambios rápidos de filtros descartan respuestas obsoletas mediante cancelación y una guarda de secuencia. Si FastAPI no responde, se muestra el error y se ofrece reintento; no se usan datos de demostración.

Compilación de producción y vista previa:

```powershell
cd Frontend
npm run build
npm run preview
```

El aviso de chunk JS mayor a 500 kB es conocido y no es un error.

## Estado del proyecto

- Pasos 01–05: auditoría, organización, catálogo definitivo de KPIs y propuesta de visualización.
- Pasos 06–11: esquema, catálogos, perfilado, conciliación y calidad del ETL.
- Pasos 12–14: ETL local con validación asertiva y manifiesto determinista.
- Pasos 15–17: integración PostgreSQL, 14 vistas/KPIs y validación con evidencia real.
- Pasos 18–21: backend FastAPI de solo lectura, contrato JSON `1.0.0` y ocho rutas GET.
- Paso 22: suite del backend (82 pruebas), comparaciones SQL independientes y validación HTTP con PostgreSQL detenido y recuperado.
- Fase VI: frontend integrado al contrato oficial, filtros por fuente observada, catálogo institucional completo y guarda anti-respuestas obsoletas.
- Fase VII: pruebas integrales extremo a extremo y arranque reproducible en Windows, con verificación en copia limpia y base aislada.

Pendiente: verificación interactiva en navegador de los nueve valores, restablecimiento de filtros, nulos y aviso de error con FastAPI detenido; no hay herramienta de navegador ni dependencias de prueba de navegador en el entorno. No se inició la fase VIII.
