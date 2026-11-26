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
│   └── run_sql_docker.py          Ejecutor SQL/validador del contenedor Docker (--contenedor)
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

Repositorio real: <https://github.com/Pollito890d/Dashboard_TomaDeDecisiones.git>. Los tres scripts resuelven las rutas desde su propia ubicación, así que pueden invocarse con una ruta absoluta desde cualquier directorio.

**Orden exacto de ejecución** (instalación nueva, en PowerShell desde cualquier directorio):

```powershell
# 1) Clonar (una sola vez)
git clone https://github.com/Pollito890d/Dashboard_TomaDeDecisiones.git Dashboard_TomaDeDecisiones
cd Dashboard_TomaDeDecisiones

# 2) Verificar sin escribir (opcional; seguro si los .env ya existen)
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1 -SoloComprobar
powershell -ExecutionPolicy Bypass -File scripts\run_etl.ps1 -SoloComprobar

# 3) Instalar dependencias y crear .env desde plantillas
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1

# 4) Solo en base vacía: esquema + catálogos + vistas + ETL + validaciones
powershell -ExecutionPolicy Bypass -File scripts\run_etl.ps1 -InicializarBase -Cargar

# 5) Arrancar/verificar FastAPI y React
powershell -ExecutionPolicy Bypass -File scripts\start.ps1
```

**Instalación nueva vs. base previamente cargada:**

| Situación | `run_etl.ps1` | Observación |
|---|---|---|
| Base vacía, primera carga | `-InicializarBase -Cargar` | Crea esquema, catálogos y vistas, luego carga hechos y valida. |
| Base ya cargada | omitir `run_etl.ps1`, o usar `-Cargar` | El DDL de `-InicializarBase` se cancela si encuentra tablas; `-Cargar` es idempotente por SHA-256. |
| Solo regenerar `data/processed/` | sin opciones | No abre conexión a PostgreSQL. |

Ejemplo sobre base ya cargada:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run_etl.ps1 -SoloComprobar
powershell -ExecutionPolicy Bypass -File scripts\start.ps1
```

`-SoloComprobar` valida rutas, `.env`, Docker y la coherencia contenedor/`DATABASE_URL` **sin escrituras**. `-Contenedor` debe designar el contenedor que publica el puerto configurado en `Backend/.env`; si no coincide, el script se detiene antes de crear esquema, cargar catálogos o insertar hechos.

## Requisitos en Windows

Versiones verificadas en este entorno:

| Componente | Versión verificada | Uso |
|---|---|---|
| Python | 3.14.6 x64 (`python --version`) | `.venv`, ETL, FastAPI y scripts Python |
| Node.js | v24.18.0 (`node --version`) | React/Vite |
| npm | 11.16.0 (`npm --version`) | `npm ci`, `npm run dev`, `npm run build` |
| Docker | 29.9.2 (`docker --version`) | Contenedor PostgreSQL `dashboard-postgres` |
| PostgreSQL | 17.12 (imagen `postgres:17`) | Base `dashboard_caja_ahorro` en `127.0.0.1:5432` |

Requisitos mínimos: Python 3.10+, Node.js 18+ y Docker Desktop o PostgreSQL nativo en `127.0.0.1:5432`. Los 19 archivos originales y su `manifest.json` están incluidos en `data/raw/`. No se necesita `psql` en el host: `scripts/run_sql_docker.py` ejecuta SQL dentro del contenedor.

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

### 2. Archivos `.env` (configuración segura)

`setup.ps1` copia `Backend/.env.example` y `Frontend/.env.example` **solo si el destino no existe**; si ya existen, los deja intactos. Verifique con `powershell -ExecutionPolicy Bypass -File scripts\setup.ps1 -SoloComprobar`.

- `Backend/.env`: `DATABASE_URL=postgresql+psycopg://dashboard_user:<contraseña_url_codificada>@127.0.0.1:5432/dashboard_caja_ahorro`, además de `API_HOST=127.0.0.1`, `API_PORT=8000`, `LOG_LEVEL=INFO` y `CORS_ORIGINS=http://localhost:5173`.
- `Frontend/.env`: `VITE_API_URL=http://localhost:8000`.

Si la contraseña contiene caracteres especiales, codifícelos para el componente URL (`@` → `%40`, `#` → `%23`, etc.). No comparta ni versione estos archivos: `.gitignore` ya los excluye. No se use la contraseña de ejemplo de las plantillas en un entorno real.

### 3. PostgreSQL con Docker (volumen persistente)

Si el contenedor ya existe, solo verifíquelo:

```powershell
docker ps --filter name=dashboard-postgres
powershell -ExecutionPolicy Bypass -File scripts\run_etl.ps1 -SoloComprobar
```

Para crearlo desde cero con volumen persistente (solo en entorno vacío; administrator local):

```powershell
docker volume create dashboard_pgdata
docker run -d --name dashboard-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD='<contraseña_admin_local>' `
  -p 127.0.0.1:5432:5432 `
  -v dashboard_pgdata:/var/lib/postgresql/data `
  postgres:17
```

Cree el usuario de aplicación y la base antes de ejecutar el esquema. La contraseña se envía por `stdin`, no como argumento visible:

```powershell
@"
CREATE ROLE dashboard_user LOGIN PASSWORD '<contraseña_local>';
CREATE DATABASE dashboard_caja_ahorro OWNER dashboard_user;
"@ | docker exec -i dashboard-postgres psql -X -v ON_ERROR_STOP=1 -U postgres
```

Después, rellene `DATABASE_URL` en `Backend/.env` con esa misma contraseña local. No reutilice una base con datos para `-InicializarBase`: el DDL se cancela si detecta tablas de usuario.

### 3b. Procedimiento manual alternativo para PostgreSQL nativo

Si no usa Docker, instale PostgreSQL 17 en Windows y cree el rol y la base con `psql` o pgAdmin:

```powershell
# Como administrador de PostgreSQL (sustituya la contraseña local):
psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE ROLE dashboard_user LOGIN PASSWORD '<contraseña_local>';"
psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE dashboard_caja_ahorro OWNER dashboard_user;"
```

Configure `Backend/.env` como en el apartado 2 y ejecute el SQL directamente desde la raíz del repositorio (aquí sí hay `psql` en el host):

```powershell
psql -U dashboard_user -h 127.0.0.1 -p 5432 -d dashboard_caja_ahorro -v ON_ERROR_STOP=1 -f Database\01_schema.sql
.\.venv\Scripts\python.exe ETL\load_catalogs.py
psql -U dashboard_user -h 127.0.0.1 -p 5432 -d dashboard_caja_ahorro -v ON_ERROR_STOP=1 -f Database\03_views.sql
.\.venv\Scripts\python.exe ETL\run_etl.py --cargar
psql -U dashboard_user -h 127.0.0.1 -p 5432 -d dashboard_caja_ahorro -v ON_ERROR_STOP=1 -f Database\04_validation.sql
psql -U dashboard_user -h 127.0.0.1 -p 5432 -d dashboard_caja_ahorro -v ON_ERROR_STOP=1 -f Database\tests\validacion_kpis.sql
```

`Database/03_views.sql` usa `\ir`; ejecútelo desde la raíz del repositorio. Si prefiere evitar `\ir`, ejecute por separado `Database\views\01_vistas.sql` y `Database\views\02_kpis.sql`, igual que hace `run_etl.ps1`.

### 4. Esquema, catálogos, vistas y ETL

Los scripts existentes se ejecutan en este orden (el contenedor se pasa explícitamente para que SQL y ETL usen la misma instancia):

```powershell
.\.venv\Scripts\python.exe scripts\run_sql_docker.py --contenedor dashboard-postgres --validar
.\.venv\Scripts\python.exe scripts\run_sql_docker.py --contenedor dashboard-postgres Database\01_schema.sql
.\.venv\Scripts\python.exe ETL\load_catalogs.py
.\.venv\Scripts\python.exe scripts\run_sql_docker.py --contenedor dashboard-postgres Database\views\01_vistas.sql
.\.venv\Scripts\python.exe scripts\run_sql_docker.py --contenedor dashboard-postgres Database\views\02_kpis.sql
.\.venv\Scripts\python.exe ETL\run_etl.py --cargar
.\.venv\Scripts\python.exe scripts\run_sql_docker.py --contenedor dashboard-postgres Database\04_validation.sql
.\.venv\Scripts\python.exe scripts\run_sql_docker.py --contenedor dashboard-postgres Database\tests\validacion_kpis.sql
```

`--validar` solo lectura: comprueba que el contenedor publica el puerto de `DATABASE_URL` y que usuario/base coinciden. `run_etl.ps1` hace esta comprobación automáticamente antes de cualquier escritura cuando se usan `-InicializarBase` o `-Cargar`.

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
