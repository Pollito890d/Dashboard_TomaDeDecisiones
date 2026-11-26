# Dashboard de Toma de Decisiones

## Objetivo

Construir un tablero gerencial para el análisis de liquidez, cartera, recuperación y contexto externo de una caja de ahorro y préstamo, utilizando **exclusivamente datos abiertos reales** de **CNBV**, **FONACOT** y **SNIIV**. No se generan datos sintéticos nuevos.

El frontend existente conserva sus datos ilustrativos heredados del wireframe académico solo como línea base ([`docs/auditoria.md`](docs/auditoria.md)). La integración de esos datos reales en la interfaz queda para una fase posterior; este repositorio ya cuenta con ETL, esquema, carga PostgreSQL, vistas y KPIs validados.

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
  Backend/   (API FastAPI: pendiente)
         │
         ▼
  Frontend/  (React + Vite + Tailwind + Recharts; aún con mock)
```

Los contratos y la línea base están documentados en [`docs/auditoria.md`](docs/auditoria.md). El catálogo definitivo de indicadores está en [`docs/catalogo_kpis.md`](docs/catalogo_kpis.md).

## Estructura de carpetas

```
.
├── Backend/            API FastAPI (pendiente)
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
├── Frontend/           Aplicación React existente (sin cambios)
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

Resultado real de la ejecución final: `28 passed in 85.05s`; validación Fase IV `VALIDACION_FASE_IV_OK`; suite de KPIs `VALIDACION_KPIS_ASERTIVA_OK`; ejecución activa `6`.

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

Mientras no exista la API, el adaptador actual cae a los datos ilustrativos de `Frontend/src/data/mockDashboardData.js`. No se modificó `Frontend/`.

## Estado del proyecto

- Pasos 01–05: auditoría, organización, catálogo definitivo de KPIs y propuesta de visualización.
- Pasos 06–11: esquema, catálogos, perfilado, conciliación y calidad del ETL.
- Pasos 12–14: ETL local con validación asertiva y manifiesto determinista.
- Pasos 15–17: integración PostgreSQL, 14 vistas/KPIs y validación con evidencia real.

Detalle de la integración y las pruebas: [`docs/etl_integracion_pendiente.md`](docs/etl_integracion_pendiente.md) y [`docs/validacion_kpis.md`](docs/validacion_kpis.md).

Pendiente para una fase posterior: API FastAPI y sustitución del mock del frontend por los KPIs validados. No se inició esa fase.
