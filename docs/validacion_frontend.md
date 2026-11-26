# Validación de las correcciones de la fase VI

Fecha: 2026-11-26. Rama: `feature/fase-6-frontend`. Sin commit, merge ni inicio de la fase VII.

## Alcance verificado

- `/api/periodos?fuente=...` conserva la forma de `PeriodosResponse` y el comportamiento por omisión (`dim_mes`). Con fuente, consulta las vistas de la ejecución activa: CNBV sectorial (23 meses, `2024-02` a `2025-12`), CNBV institucional (4 cortes, `2025-03` a `2025-12`), FONACOT (12 meses) y SNIIV (un corte anual sintetizado como `2025-12`).
- `GET /api/instituciones/catalogo` devuelve 155 cooperativas, separado del ranking (`/api/instituciones` sigue devolviendo 10 fichas con `limitado=true`). Consultar una ficha individual no reduce el catálogo.
- El selector institucional se llena desde ese catálogo completo; cambiar el corte o seleccionar una clave ya no restablece `claveSeis`.
- Los cambios rápidos de filtros cancelan la solicitud anterior y descartan respuestas cuyo turno deja de ser vigente.
- `Backend/tests/test_servicios.py` comprueba la ejecución activa contra `ejecucion_etl`, sin el identificador fijo `6`.

## Comandos ejecutados y resultados reales

| Comando | Resultado |
|---|---|
| `node --test Frontend/tests/dashboardApi.test.js` | `4 passed`, `0 failed`. Cubre catálogos por fuente, catálogo de 155 frente a ranking de 1 fila, preservación de `claveSeis` y guarda de secuencia. |
| `npm run build` (en `Frontend/`) | Compilación correcta: `✓ 2194 modules transformed`, `✓ built in 13.23s`. Solo el aviso ya conocido de chunk mayor a 500 kB; no es un error. |
| `.\.venv\Scripts\python.exe -m pytest Backend\tests -q` | Ejecución final: `82 passed in 18.79s`. La primera ejecución marcó `test_docs_y_openapi_solo_exponen_health` porque no contemplaba la nueva ruta; se actualizó esa expectativa y la ejecución final quedó verde. |
| Consultas puntuales con `TestClient` (fuera de la suite) | Estados HTTP y conteos confirmados: 23 / 4 / 12 / 1 períodos por fuente, 155 cooperativas, `200` en `/api/periodos?anio=2025` y `422` para `fuente=inegi`. |

## No ejecutado

- **Verificación en navegador** de períodos, selector de 155 instituciones, restablecimiento de filtros y error visible al desconectar FastAPI. El entorno no proporciona herramienta de navegador y `Frontend/node_modules` no contiene Playwright, Puppeteer, jsdom ni Vitest; no se instalaron dependencias nuevas. La ruta de error está implementada (`ApiError` con `code=CONEXION`, aviso de error y botón de reintento), pero su comprobación visual queda pendiente.

## Restricciones cumplidas

No se ejecutó ETL, no se leyeron archivos originales, no se modificaron esquema, vistas ni fórmulas financieras, no se instalaron dependencias, no se repitieron pruebas de fases anteriores y no se hicieron commit ni merge.
