# Auditoría del repositorio existente — Paso 01

**Fecha:** 2026-11-24  
**Objetivo:** establecer la línea base técnica y funcional del frontend antes de continuar el desarrollo.  
**Alcance:** solo lectura y verificación. No se modificó código fuente, dependencias ni configuración; no se implementó backend, base de datos ni ETL; no se generaron datos sintéticos nuevos; no se realizaron commits.

---

## 1. Estado del repositorio

| Elemento | Resultado |
|---|---|
| Rama actual | `main`, siguiendo a `origin/main` (sin divergencia) |
| Último commit | `900752d14b17a525013d33e6eb5b59403d45469a` — *Frontend del dashboard* (2026-11-24 17:47:47 -0600, Polltio890d) |
| `git status --short --branch` inicial | `## main...origin/main` (árbol limpio) |
| Archivos versionados | 11: `.gitignore`, `README.md`, `Frontend/index.html`, `Frontend/package.json`, `Frontend/package-lock.json`, `Frontend/postcss.config.js`, `Frontend/tailwind.config.js`, `Frontend/vite.config.js`, `Frontend/src/main.jsx`, `Frontend/src/index.css`, `Frontend/src/App.jsx`, `Frontend/src/data/mockDashboardData.js` (12 contando este último) |
| Entorno | Node `v24.18.0`, npm `11.16.0`, Windows |
| `README.md` | Codificado UTF-16 LE con BOM; contiene únicamente `# Dashboard_TomaDeDecisiones`. No hay instrucciones de instalación/ejecución. |

**Estructura relevante:**

```
/
├── .gitignore
├── README.md
├── docs/auditoria.md            ← único archivo creado en esta auditoría
└── Frontend/
    ├── index.html
    ├── package.json / package-lock.json (lockfileVersion 3)
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx
        ├── index.css
        ├── App.jsx                 (817 líneas; toda la UI)
        └── data/mockDashboardData.js (504 líneas; datos + adaptador de API)
```

No existen carpetas `backend/`, `etl/`, `tests/`, `docs/` previas, ni archivos `.env` o `.env.example`.

---

## 2. Inventario técnico

### Stack y dependencias instaladas (`npm ci`)

| Tipo | Paquete | Versión instalada |
|---|---|---|
| Runtime | `react` / `react-dom` | 18.3.1 |
| Runtime | `recharts` | 2.15.4 (rango declarado `^2.13.3`) |
| Runtime | `lucide-react` | 0.460.0 |
| Dev | `vite` | 5.4.21 (`^5.4.11`) |
| Dev | `@vitejs/plugin-react` | 4.7.0 |
| Dev | `tailwindcss` | 3.4.19 |
| Dev | `postcss` / `autoprefixer` | 8.5.33 / 10.7.0 |
| Dev | `@types/react` / `@types/react-dom` | 18.3.32 / 18.3.7 |

Scripts disponibles: `dev` (`vite`), `build` (`vite build`), `preview` (`vite preview`). No hay scripts de test ni lint.

### Configuración

- `vite.config.js`: plugin React, servidor en puerto **5173**, `open: false`, sin `proxy`, sin `server.fs` personalizado y sin configuración de `build`.
- `tailwind.config.js`: contenido `index.html` + `src/**/*.{js,ts,jsx,tsx}`, fuente `Inter` y paleta `teal` extendida. Las clases usadas en `App.jsx` son principalmente utilidades estándar de Tailwind.
- `postcss.config.js`: `tailwindcss` + `autoprefixer`.
- `index.html`: `lang="es"`, título *Caja de Ahorro y Préstamo — Dashboard Gerencial*, carga de fuentes Inter desde Google Fonts (dependencia externa en runtime), `<div id="root">`.
- `index.css`: directivas Tailwind, `Inter` como fuente base y scrollbars personalizados para la tabla.
- `.gitignore`: ignora `node_modules/`, `dist/`, `.env`, `.env.*` (con excepción de `!.env.example`), artefactos Python, ZIP/CSV pesados y archivos de IDE/SO.

### Componentes y funcionalidad (`App.jsx`)

| Zona | Contenido |
|---|---|
| Encabezado | Título, badge `CNBV · CONDUSEF`, subtítulo, filtros globales y botón *Ficha de KPIs (8)* (panel desplegable con fórmulas SQL referidas a tablas PostgreSQL). |
| 01 Resumen ejecutivo | 4 tarjetas KPI: liquidez disponible (+ razón y variación), colocación vs. ahorro (vs. meta), tasa de morosidad (con capital vencido), recuperación de cartera (vs. mes anterior). |
| 02 Tendencias | Gráfica de líneas Recharts (`LineChart`) con dos series: `liquidez` y `obligaciones`, eje X `semana`, tooltip personalizado que calcula brecha y razón. |
| 03 Causa raíz | Dos visualizaciones de barras horizontales hechas con CSS (no Recharts): *Préstamos por estado* y *Cartera vencida por tipo* (esta última cliqueable para filtrar la tabla). Bloque de contexto externo FONACOT. |
| 04 Detalle operativo | Tabla de cuotas vencidas con columnas Socio, Vencimiento, Pendiente, Días; modos `wireframe` (3 filas) / `top10`, orden por `wireframe_order`, `dias_desc` o `monto_desc`, y filtro por tipo de préstamo. |
| Pie | Texto académico: *Datos y valores ilustrativos, no registros reales · Versión 12/11/2026* y mención a PostgreSQL 15 + FastAPI + React & Recharts. |

### Filtros e interactividad

- **Período** (`PERIODOS`): `8w` (default), `4w`, `12w`; recorta la serie de 12 semanas por número de elementos (`slice`).
- **Sucursal** (`SUCURSALES`): `ALL` (default), `1` CDMX (INEGI 09), `2` Jalisco (14), `3` Querétaro (22); al cambiar a una sucursal específica fuerza modo de tabla `top10`; al volver a `ALL`, vuelve a `wireframe`.
- **Tabla**: botón cíclico de ordenamiento, filtro por tipo al hacer clic en una barra, botón *Quitar filtro*, enlace *Ver Top 10 socios en mora*.
- **Ficha de KPIs**: panel informativo con 8 tarjetas y fórmulas SQL (KPI 1 liquidez vs. obligaciones, 2 colocación/ahorro, 3 morosidad, 4 recuperación, 5 evolución semanal, 6 préstamos por estado/tipo, 7 cobranza, 8 comparativa FONACOT).

### Datos mock (`mockDashboardData.js`)

- `SUCURSALES`, `PERIODOS` y `DATA_BY_BRANCH` (4 bloques: `ALL`, `1`, `2`, `3`).
- Cada bloque contiene: `resumen` (13 campos), `evolucion_12w` (12 registros con `semana`, `fecha_corte`, `liquidez`, `obligaciones`), `prestamos_por_estado` (3 registros: Vigentes/Vencidos/Liquidados, con `conteo`, `capital`, `color`, `tipo_alerta`), `cartera_vencida_por_tipo` (3 registros: Personal/Negocio/Emergencia, con `monto`, `creditos`, `pct`, `tasa_base`, `color`, `tipo_alerta`) y `fonacot_comparativa` (porcentajes, brecha, totales, trimestre y detalle por entidad).
- `CUOTAS_VENCIDAS_DATA`: 10 registros con `id_cuota`, `id_prestamo`, `id_socio`, `codigo_socio`, `nombre_socio`, `genero`, `id_sucursal`, `sucursal`, `tipo_prestamo`, `num_cuota`, `fecha_vencimiento`, `fecha_iso`, `monto_esperado`, `monto_pagado`, `saldo_pendiente`, `dias_atraso`, `estado_cuota`, `telefono`. Incluye nombres y teléfonos ficticios con apariencia de datos personales.
- El propio archivo declara en su cabecera que es un **dataset sintético** y reproduce valores exactos de un wireframe de Figma (liquidez $1,250,000, morosidad 8.2%, etc.).

---

## 3. Contrato de datos esperado y fallback

### Endpoint

`fetchDashboardData({ periodoId, sucursalId })` intenta:

```
GET ${VITE_API_URL}/api/dashboard?periodo={8w|4w|12w}&sucursal={ALL|1|2|3}
```

- Sin `AbortController`, sin timeout, sin reintentos, sin cabeceras de autenticación.
- Solo se acepta `res.ok`; cualquier otro estado cae al fallback.
- No se valida la forma del JSON: se asume que contiene todas las claves que luego se desestructuran en `App.jsx`.

### Estructura JSON esperada (nombres y tipos; sin valores de ejemplo)

```json
{
  "resumen": {
    "liquidez_disponible": "number",
    "obligaciones_corto_plazo": "number",
    "ahorro_total": "number",
    "razon_liquidez_pct": "number",
    "variacion_liquidez_pct": "number",
    "colocacion_vs_ahorro_pct": "number",
    "meta_colocacion_pct": "number",
    "capital_cartera_activa": "number",
    "tasa_morosidad_pct": "number",
    "umbral_morosidad_pct": "number",
    "capital_cartera_vencida": "number",
    "recuperacion_cartera_pct": "number",
    "variacion_recuperacion_pp": "number"
  },
  "evolucion_semanal": [
    { "semana": "string", "fecha_corte": "YYYY-MM-DD", "liquidez": "number", "obligaciones": "number" }
  ],
  "prestamos_por_estado": [
    { "estado": "string", "conteo": "number", "capital": "number", "color": "string", "tipo_alerta": "string" }
  ],
  "cartera_vencida_por_tipo": [
    { "tipo": "string", "monto": "number", "creditos": "number", "pct": "number", "tasa_base": "number", "color": "string", "tipo_alerta": "string" }
  ],
  "cuotas_vencidas": [
    { "id_cuota": "number", "codigo_socio": "string", "nombre_socio": "string", "telefono": "string", "tipo_prestamo": "string", "fecha_vencimiento": "string", "fecha_iso": "YYYY-MM-DD", "saldo_pendiente": "number", "dias_atraso": "number" }
  ],
  "fonacot_comparativa": {
    "pct_socias_caja": "number",
    "pct_mujeres_fonacot": "number",
    "brecha_pp": "number",
    "total_socias_activas": "number",
    "trabajadores_fonacot_estado": "number",
    "monto_promedio_fonacot": "number",
    "trimestre_fuente": "string",
    "detalle_estados": [{ "entidad": "string", "socias_caja_pct": "number", "mujeres_fonacot_pct": "number" }]
  }
}
```

Nota: los tipos se muestran como etiquetas descriptivas (`"number"`, `"string"`), no como valores numéricos reales. Los campos listados son los que consumen `App.jsx` y `fetchDashboardData`; `id_prestamo`, `id_socio`, `genero`, `id_sucursal`, `sucursal`, `num_cuota`, `monto_esperado`, `monto_pagado` y `estado_cuota` están presentes en el mock pero no se renderizan actualmente.

### Variables de entorno

| Variable | Uso | Estado |
|---|---|---|
| `VITE_API_URL` | Base URL del backend FastAPI; se lee con `import.meta.env.VITE_API_URL` en `mockDashboardData.js` | Única variable usada. No hay `.env`, `.env.example` ni documentación de la misma. |

Si el valor termina en `/`, la URL construida queda con doble barra (`//api/dashboard`).

### Mecanismo de fallback

1. Sin `VITE_API_URL` → se usan directamente los datos sintéticos locales.
2. Con `VITE_API_URL` y respuesta `ok` → se usa el JSON remoto.
3. Con `VITE_API_URL` y error de red/HTTP → `catch` silencioso y datos sintéticos locales (no hay aviso visual ni log).
4. Sucursal desconocida → `DATA_BY_BRANCH.ALL`; período desconocido → `PERIODOS[0]` (`8w`).
5. Si la API responde JSON incompleto o inválido, no hay fallback: `App.jsx` falla al desestructurar/mapear.

---

## 4. Inconsistencias y adaptaciones necesarias para datos abiertos reales

1. **Origen de datos:** todo lo que se muestra es sintético y así se declara en dos archivos (`mockDashboardData.js` y el pie de `App.jsx`). Los textos *CNBV · CONDUSEF*, *Mujeres con crédito FONACOT: 46.8% (4T 2025)* y *Corte dominical: 22/11/2026* son constantes incrustadas que deben derivarse de la fuente real y de su fecha de corte.
2. **CNBV:** hoy solo aparece como etiqueta y en fórmulas SQL académicas; no hay ingesta real. Sus catálogos (institución, entidad federativa, periodicidad mensual/trimestral) no coinciden con el modelo semanal `Posicion_Semanal` ni con las tres sucursales ficticias. Hace falta definir la agregación (semanal → mensual o viceversa) y la clave de entidad.
3. **FONACOT:** la comparativa mezcla un porcentaje interno de socias con el porcentaje externo de mujeres con crédito; `brecha_pp`, totales y `trimestre_fuente` son valores fijos. Con datos abiertos reales hay que alinear periodo, entidad federativa y definición de “crédito vigente”, y decidir qué hacer cuando la fuente no publique el corte por entidad o género.
4. **SNIIV:** no aparece en ningún archivo de código (solo se menciona en un comentario de `.gitignore` sobre CSVs pesados). No hay KPI, gráfica ni campo preparado para vivienda/INFONAVIT; hay que definir su indicador y su mapping al contrato JSON.
5. **Filtros hardcodeados:** sucursales y períodos son constantes del frontend (`ALL/1/2/3`, `8w/4w/12w`). Para datos nacionales reales deben venir del API o de catálogos oficiales; el recorte por `slice` asume que siempre hay 12 semanas.
6. **Escala visual fija:** el eje Y del gráfico usa `domain={[800000, 1400000]}` y ticks fijos cuando `sucursalId === 'ALL'`; con valores reales de otro orden de magnitud la gráfica se distorsionará u ocultará series.
7. **Lógica de wireframe en producción:** el modo por defecto muestra solo `slice(0, 3)`; la etiqueta “Top 10” no aplica un límite real (solo existen 10 registros mock). Con datos reales se requieren límites/paginación explícitos y reglas de priorización documentadas.
8. **Datos personales:** los registros de cobranza contienen nombres y teléfonos ficticios. Los datos reales deberán cumplir política de anonimización/minimización; el contrato actual expone esos campos al frontend.
9. **Presentación acoplada a datos:** `color` y `tipo_alerta` llegan dentro del payload mock. La API real debe entregar valores y reglas de umbral (por ejemplo `umbral_morosidad_pct`), no colores, o el frontend debe derivarlos.
10. **Contrato no validado:** `App.jsx` desestructura seis claves sin comprobación; cualquier cambio de esquema en el backend produce pantalla en blanco/error de render, sin fallback.
11. **Fórmulas SQL huérfanas:** la ficha de KPIs cita tablas (`Prestamo`, `Cuenta_Ahorro`, `Socio`, `Cuota_Prestamo`, `Posicion_Semanal`, `Ref_Credito_Fonacot`) que no existen en el repositorio; habrá que conciliarlas con el modelo de datos abiertos.
12. **Deuda de calidad:** sin tests, sin lint, sin `.env.example`, sin documentación de ejecución y sin control de errores de API. Hay dependencias dev con avisos de seguridad (ver §5) y un bundle >500 kB (Recharts).

---

## 5. Pruebas ejecutadas y resultados

| Verificación | Comando / método | Resultado |
|---|---|---|
| Estado Git inicial | `git status --short --branch`, `git log -1`, `git ls-files` | OK, rama `main` limpia y sincronizada |
| Servidor previo (evidencia existente reutilizada) | `Invoke-WebRequest http://localhost:5173/` | HTTP 200 antes de reinstalar; proceso `npm run dev` (PID 2096) + Vite (PID 920) + esbuild (PID 18620) activos |
| Instalación (1er intento) | `npm ci` | **FALLÓ**: `EPERM` al hacer `unlink` de `node_modules/@esbuild/win32-x64/esbuild.exe`, bloqueado por el servidor de desarrollo ya en ejecución; instalación quedó parcial (16 carpetas) |
| Instalación (2º intento) | `npm ci` tras detener esos 3 procesos | **OK**: 170 paquetes instalados, 25s. Avisos: `recharts@2.15.4` deprecated (rama 2.x), 2 vulnerabilidades, script `postinstall` de `esbuild@0.21.5` no aprobado por npm 11 |
| Compilación | `npm run build` | **OK**: Vite 5.4.21, 2172 módulos, 9.99s. Salida `dist/index.html` 0.75 kB, CSS 16.28 kB, JS 580.85 kB (gzip 163.86 kB). Aviso: chunk >500 kB |
| Ejecución dev | `npm run dev` (reiniciado en segundo plano) + peticiones HTTP | **OK**: `/` → 200, `/src/App.jsx` → 200 (179167 bytes), `/src/data/mockDashboardData.js` → 200 (118101 bytes); puerto 5173 en escucha en `::1`, PID 14228 |
| Auditoría de dependencias | `npm audit --omit=dev` / `npm audit --json` | Producción: 0 vulnerabilidades. Total: 2 (1 moderate `esbuild`, 1 high `vite`), ambas de desarrollo; corrección sugerida es subir a Vite 8 (cambio mayor, no aplicado) |
| Integridad del árbol | `git status --short --branch` tras las pruebas | Sin cambios en archivos versionados; `node_modules/` y `dist/` ignorados |

No se ejecutaron tests unitarios, de integración, E2E ni lint porque el repositorio no define esos scripts.

---

## 6. Criterios de aceptación

| Criterio | Estado | Evidencia |
|---|---|---|
| Frontend ejecutable en localhost | **Aprobado** | HTTP 200 en `http://localhost:5173/` y en los módulos transformados por Vite, servidor en escucha |
| Compilación exitosa | **Aprobado** | `npm run build` terminó correctamente (2172 módulos, 9.99s) |
| Inventario técnico documentado | **Aprobado** | Secciones 2–4 de este documento |
| Código original sin modificaciones | **Aprobado** | `git status` sin archivos versionados modificados; único archivo nuevo: `docs/auditoria.md` |

---

## 7. Pendientes para los siguientes pasos

1. Definir y versionar el contrato real `GET /api/dashboard` (incluyendo validación de esquema y errores explícitos en el frontend) y un `.env.example` con `VITE_API_URL`.
2. Sustituir `DATA_BY_BRANCH` / `CUOTAS_VENCIDAS_DATA` por datos reales de CNBV, FONACOT y SNIIV mediante la capa de acceso acordada; sin generar datos sintéticos nuevos.
3. Convertir filtros, etiquetas de periodo/entidad y fechas de corte en datos dinámicos; eliminar la dependencia del array fijo de 12 semanas.
4. Revisar escalas, modos `wireframe`/`top10`, textos académicos y campos de datos personales antes de pasar a una vista gerencial real.
5. Alinear KPI 8 y sus fuentes (FONACOT) y decidir el indicador SNIIV que se incorporará.
6. Gestionar deuda técnica: tests, lint, actualización de Vite/Recharts, reducción del bundle y avisos de seguridad de desarrollo.
