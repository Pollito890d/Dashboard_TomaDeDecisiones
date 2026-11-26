# Contrato JSON de la API — Fase V (pasos 20 y 21)

**Versión del contrato:** `1.0.0`  
**Rama:** `feature/fase-6-frontend`  
**Estado:** endpoints de lectura sobre las vistas validadas de la Fase IV. La fase VI agregó de forma compatible `GET /api/instituciones/catalogo` y el parámetro opcional `fuente` en `/api/periodos`; el frontend consume el contrato sin datos de demostración. Ver [`validacion_frontend.md`](validacion_frontend.md).

Todas las respuestas de datos (y las respuestas de error controladas) incluyen:

```json
{ "contrato_version": "1.0.0" }
```

Excepción: `GET /api/health` conserva la forma acordada en el paso 19 (`status`, `database`, `detail`) y no incorpora el campo de versión.

---

## 1. Convenciones de tipos, unidades y nulos

| Concepto | Representación JSON | Observación |
|---|---|---|
| `numeric(30,6)` / `numeric(20,10)` de PostgreSQL | **cadena** (p. ej. `"4.0549697085"`, `"56207601837.000000"`) | Pydantic serializa `Decimal` como texto para no perder precisión. El cliente Decide si lo convierte a número para graficar. |
| Enteros (`bigint`, `integer`, `COUNT`) | número JSON | p. ej. `325649`, `6`. |
| Bandera `boolean` | `true` / `false` | p. ej. `ventana_12m_completa`, `es_infonavit`. |
| Fecha (`date`) | `"YYYY-MM-DD"` | p. ej. `"2025-12-01"`. |
| Corte mensual | `"YYYY-MM"` | p. ej. `"2025-12"`. Debe existir en `dim_mes`. |
| Trimestre | `"YYYY-Qn"` | p. ej. `"2025-Q4"`. |
| Timestamptz | ISO 8601 con zona | p. ej. `"2026-11-25T...Z"`. |
| Valor no disponible | `null` | **Nunca se imputa `0`**. Los nulos de las vistas se conservan de extremo a extremo. |
| Importes | pesos mexicanos (MXN) | Series y boletines normalizados en la Fase IV; FONACOT y SNIIV ya están en pesos. |
| Tasas y participaciones | porcentaje (`%`) | Escala 0–100, no fracción 0–1. |
| Saldos | corte del periodo | **No se suman entre meses ni trimestres**. |

Los indicadores financieros no se recalculan en Python: la API solo selecciona y filtra columnas ya calculadas en `Database/views/01_vistas.sql` y `Database/views/02_kpis.sql`.

---

## 2. Fuentes oficiales y granularidades

| Universo | Fuente oficial | Vista principal | Granularidad |
|---|---|---|---|
| CNBV sectorial | `SH_SOCAPS.xlsm!Series` | `v_kpis_cnbv_sector_mes`, `v_kpis_cnbv_sector_bandas_2025`, `v_kpis_cnbv_contraste_trim` | 1 fila por mes |
| CNBV institucional | Boletines `BE_SOCAPS_20XX.xlsx` | `v_kpis_cnbv_institucion_trim` | 1 fila por mes × `clave_seis` |
| FONACOT | Datos abiertos FONACOT | `v_kpis_fonacot_trim_resumen`, `v_kpis_fonacot_ambito_trim` | 1 fila por `anio × trimestre` (y por ámbito si se solicita) |
| SNIIV | Financiamientos de vivienda 2025 | `v_kpis_sniiv_anual_resumen`, `v_kpis_sniiv_entidad_anual` | 1 fila por `anio` (y por `cve_ent` si se solicita) |
| Catálogos | `dim_mes`, `dim_institucion`, `archivo_fuente`, `v_ejecucion_activa` | — | Según catálogo |

Todas las consultas usan `v_ejecucion_activa`, por lo que no se mezclan instantáneas del ETL.

---

## 3. Endpoints, parámetros y respuestas

| Endpoint | Parámetros | Respuesta | Límite de respuesta |
|---|---|---|---|
| `GET /api/health` | ninguno | `status`, `database`, `detail` · `200` / `503` | 1 objeto |
| `GET /api/dashboard` | `periodo` (`YYYY-MM`), `anio` | `DashboardResponse` | 1 corte + hasta 12 filas de serie + 10 bandas |
| `GET /api/instituciones` | `periodo`, `trimestre`, `clave_seis`, `anio`, `limite` (1–100, default 10) | `InstitucionesResponse` | `limite` fichas; `limitado` indica tope alcanzado |
| `GET /api/instituciones/catalogo` | ninguno | `InstitucionesCatalogoResponse` | Todas las cooperativas del catálogo (155) |
| `GET /api/periodos` | `anio`, `limite` (1–100, default 50), `fuente` opcional (`cnbv_sectorial`, `cnbv_institucional`, `fonacot`, `sniiv`) | `PeriodosResponse` | `limite` períodos; sin `fuente` conserva `dim_mes` |
| `GET /api/fuentes` | `fuente` (`CNBV`/`FONACOT`/`SNIIV`), `rol` (`hechos`/`diccionario`/`validacion`), `limite` (1–100, default 25) | `FuentesResponse` | `limite` fuentes |
| `GET /api/fonacot` | `anio`, `trimestre`, `incluir_ambitos` (default `false`) | `FonacotResponse` | 4 resúmenes anuales; el desglose solo si se pide |
| `GET /api/sniiv` | `anio`, `incluir_entidades` (default `false`) | `SniivResponse` | 1 resumen anual; 33 entidades solo si se piden |

### Reglas de validación

- `periodo` debe tener formato `YYYY-MM` **y** existir en `dim_mes`; si no, `422`.
- `anio` debe estar entre `2000` y `2100` y tener al menos un período en `dim_mes`; si no, `422`.
- En `/api/dashboard`, `anio` y `periodo` deben ser coherentes; si no, `422`.
- En `/api/instituciones`, el `periodo` debe ser corte trimestral (mes `03`, `06`, `09` o `12`); `trimestre`, `periodo` y `anio` deben coincidir; si no, `422`. Si solo se envía `clave_seis`, se usa el último corte trimestral con observaciones.
- En `/api/fonacot`, `trimestre` debe ser coherente con `anio`; si no, `422`. Si solo se envía `trimestre`, el año se deriva de él.
- `clave_seis` debe tener exactamente 6 dígitos; `limite` está acotado por OpenAPI.
- Un período del catálogo **sin observaciones** no es error: devuelve `200` con `corte: null`, listas vacías y `sin_datos: true`.
- Fallo de PostgreSQL → `503` con `detail: "PostgreSQL no está disponible."`, sin credenciales ni mensajes internos.

### Forma de error

```json
{
  "contrato_version": "1.0.0",
  "detail": "periodo 2025-13 no disponible; use un YYYY-MM entre 2013-01 y 2026-09.",
  "errores": [
    { "campo": "query.periodo", "mensaje": "string does not match regex" }
  ]
}
```

`errores` aparece solo en fallos de validación de FastAPI. Los errores 4xx/503 están documentados en OpenAPI mediante `ErrorResponse`.

---

## 4. Sustitución de conceptos ficticios del mock

La tabla siguiente documenta la sustitución histórica del dataset sintético del wireframe. En la fase VI el frontend ya consume el contrato oficial; **ninguno de esos campos forma parte del contrato**.

| Concepto del mock (ficticio) | Indicador oficial que lo sustituye | Nota metodológica |
|---|---|---|
| `liquidez_disponible`, `obligaciones_corto_plazo`, `razon_liquidez_pct` | `kpi03_liquidez_pct` con `activos_liquidos_cp_mxn` y `pasivos_cp_mxn` | Fórmula de Series filas 194/195, calculada en SQL. No hay cortes semanales. |
| `variacion_liquidez_pct` | Sin equivalente oficial | No se calcula variación semanal; se reporta el corte mensual. |
| `tasa_morosidad_pct`, `umbral_morosidad_pct: 5.0` | `kpi01_imor_pct` y banda `observado_2025` de `KPI-01` | No existe umbral regulatorio de IMOR en las fuentes. |
| `colocacion_vs_ahorro_pct`, `meta_colocacion_pct: 80.0` | `kpi09_colocacion_captacion_trad_pct` y banda `observado_2025` de `KPI-09` | La meta del 80 % era sintética; se elimina. |
| `capital_cartera_activa`, `capital_cartera_vencida` | `cartera_vigente_mxn`, `cartera_vencida_mxn` | Saldos al cierre; nunca suma de semanas. |
| `recuperacion_cartera_pct`, `variacion_recuperacion_pp` | `kpi02_icor_pct` (cobertura con estimaciones preventivas) | No hay indicador oficial de "recuperación". |
| `evolucion_semanal` (`S1..S8`) | `serie_anual` de `v_kpis_cnbv_sector_mes` | 12 cortes mensuales, no 8 semanas. |
| `prestamos_por_estado`, `cartera_vencida_por_tipo` | `InstitucionTrimestreKpi` en `/api/instituciones` | No hay dimensión de tipo de préstamo ni estados de préstamo validados. |
| `cuotas_vencidas`, socio, teléfono, días de atraso | Sin equivalente | No existen datos societarios individuales en las fuentes oficiales cargadas. |
| Filtro `sucursal` (`ALL`, Centro, Norte, Bajío) | `clave_seis` para CNBV; `ambito_canonico`/`cve_ent` para FONACOT/SNIIV | No hay dimensión sucursal. |
| `fonacot_comparativa.pct_socias_caja` | `m01_participacion_femenina_socios_pct` (sector SOCAP) | M-01 usa filas 203/(203+204) de Series. |
| `fonacot_comparativa.pct_mujeres_fonacot` | `m03_participacion_femenina_creditos_pct` y `m03_participacion_femenina_monto_pct` | M-03 por trimestre y ámbito. |
| `fonacot_comparativa.brecha_pp` | Sin equivalente | Diferencia calculada en el mock; la API no publica fórmulas inventadas. |
| `monto_promedio_fonacot` | `m03_ticket_promedio_nacional_mxn` | Calculado en la vista FONACOT. |
| SNIIV (no presente en el mock) | `m04_*` de `v_kpis_sniiv_anual_resumen` y `v_kpis_sniiv_entidad_anual` | Incluye filas con `sexo` nulo conservadas. |

### Impacto resuelto en el frontend

La adaptación descrita quedó implementada en la fase VI:

1. Obtener cortes válidos desde `/api/periodos`.
2. Enviar `periodo=YYYY-MM` a `/api/dashboard`.
3. Sustituir la tabla de cuotas por `/api/instituciones`.
4. Consultar `/api/fonacot` y `/api/sniiv` para contexto externo con `clave_inegi` → `ambito_canonico` / `cve_ent`.
5. Eliminar el fallback a `mockDashboardData.js`.

---

## 5. Ejemplos reales (instantánea activa = ejecución `6`, exitosa)

Valores obtenidos de PostgreSQL; los importes y porcentajes se muestran como cadenas por precisión decimal.

### `GET /api/dashboard?periodo=2025-12`

```json
{
  "contrato_version": "1.0.0",
  "granularidad": "sectorial_mensual",
  "fuente": "CNBV · SH_SOCAPS.xlsm!Series",
  "periodo_solicitado": "2025-12",
  "periodos_disponibles": { "desde": "2013-01", "hasta": "2026-09", "total": 165 },
  "corte": {
    "periodo_ym": "2025-12",
    "mes_id": "2025-12-01",
    "kpi01_imor_pct": "4.0549697085",
    "kpi03_liquidez_pct": "35.6261802328",
    "activos_liquidos_cp_mxn": "56207601837.000000",
    "pasivos_cp_mxn": "157770497622.000000",
    "kpi04_nicap_pct": "300.2533349855",
    "kpi04_categoria_regulatoria": "Categoría 1 (>=150%)",
    "kpi09_colocacion_captacion_trad_pct": "69.2030772470",
    "m01_participacion_femenina_socios_pct": "54.2112064685"
  },
  "serie_anual": [ "… 12 cortes mensuales de 2025 …" ],
  "bandas_2025": [ "… 10 bandas; KPI-04 con umbral regulatorio 100.0000000000 …" ],
  "sin_datos": false,
  "nota": null
}
```

Banda real de `KPI-01`: mínimo `"4.0549697085"`, mediana `"4.2071924805"`, máximo `"4.2522300570"`, `umbral_regulatorio_min_pct: null`. En `KPI-04` el umbral es `"100.0000000000"` y `tipo_umbral: "regulatorio"`.

### `GET /api/instituciones?trimestre=2025-Q4&limite=3`

```json
{
  "contrato_version": "1.0.0",
  "granularidad": "institucional_trimestral",
  "corte": "2025-12",
  "trimestre": "2025-Q4",
  "instituciones": [
    {
      "clave_seis": "029056",
      "institucion_nombre": "Caja Popular Mexicana",
      "activo_mxn": "126888191520.000000",
      "kpi01_imor_publicado_pct": "2.8122274044",
      "kpi04_nicap_publicado_pct": "235.6833561551",
      "kpi03_liquidez_no_disponible_pct": null,
      "rank_activo_mayor_tamano": 1
    }
  ],
  "total_devueltos": 3,
  "limitado": false,
  "sin_datos": false,
  "nota": "KPI-03 no es reproducible por cooperativa: kpi03_liquidez_no_disponible_pct se devuelve null. Los rankings excluyen valores n.d."
}
```

### `GET /api/fonacot?anio=2025&trimestre=2025-Q4`

```json
{
  "contrato_version": "1.0.0",
  "granularidad": "contexto_externo_trimestral",
  "resumen_trimestral": [
    {
      "trimestre": "2025-Q4",
      "creditos_totales_nacional": "561561",
      "monto_total_nacional_mxn": "16889088475.450000",
      "m03_participacion_femenina_creditos_pct": "41.8268006503",
      "m03_participacion_femenina_monto_pct": "38.8003703209",
      "m03_ticket_promedio_nacional_mxn": "30075.251799",
      "creditos_solo_entidades": "512257",
      "creditos_canal_app_movil": "49304"
    }
  ],
  "por_ambito": [],
  "sin_datos": false
}
```

### `GET /api/sniiv?anio=2025`

```json
{
  "contrato_version": "1.0.0",
  "granularidad": "contexto_externo_anual",
  "resumen_anual": [
    {
      "anio": 2025,
      "total_registros_csv": 325649,
      "m04_acciones_totales": "998745",
      "m04_monto_total_mxn": "617246458236.390000",
      "m04_participacion_mujeres_acciones_pct": "45.2635868559",
      "m04_participacion_infonavit_acciones_pct": "66.7795082829",
      "filas_sin_sexo": 399
    }
  ],
  "por_entidad": [],
  "sin_datos": false
}
```

---

## 6. Verificación

```powershell
.\.venv\Scripts\python.exe -m pytest Backend/tests -q
```

La documentación interactiva está en `/docs`; el esquema OpenAPI enumera parámetros, modelos de respuesta y respuestas `422`/`503` para los siete endpoints registrados.
