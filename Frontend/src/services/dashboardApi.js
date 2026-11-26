import { INDICADORES_SECTORIALES } from '../constants/dashboardIndicators';

/**
 * Paso 24 — conexión mínima y temporal al contrato API 1.0.0.
 *
 * Único punto de ejecución de `fetch` en el frontend. Consulta los cuatro
 * endpoints de datos con cortes fijos de comprobación y NO usa el dataset
 * sintético heredado: si alguna consulta falla se propaga un error visible.
 *
 * Pendiente para el paso 25: catálogos dinámicos, control de solicitudes
 * obsoletas y eliminación definitiva de mockDashboardData.js.
 */

const CONTRATO_ESPERADO = '1.0.0';

const CORTES = {
  dashboard: '2025-12',
  anio: 2025,
  trimestre: '2025-Q4',
  limiteInstituciones: 10,
};

async function requestJson(apiRoot, ruta, etiqueta) {
  let respuesta;
  try {
    respuesta = await fetch(`${apiRoot}${ruta}`);
  } catch {
    throw new Error(`No fue posible consultar ${etiqueta}. Verifique que FastAPI esté disponible.`);
  }

  if (!respuesta.ok) {
    throw new Error(`${etiqueta} respondió HTTP ${respuesta.status}.`);
  }

  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    throw new Error(`${etiqueta} devolvió una respuesta JSON no válida.`);
  }

  if (datos.contrato_version !== CONTRATO_ESPERADO) {
    throw new Error(`${etiqueta} no usa el contrato ${CONTRATO_ESPERADO}.`);
  }

  return datos;
}

export async function fetchDashboardData() {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    throw new Error('VITE_API_URL no está configurada; no se mostrarán datos sintéticos en su lugar.');
  }

  const apiRoot = apiUrl.replace(/\/$/, '');

  const [dashboard, instituciones, fonacot, sniiv] = await Promise.all([
    requestJson(
      apiRoot,
      `/api/dashboard?periodo=${CORTES.dashboard}&anio=${CORTES.anio}`,
      'el corte sectorial CNBV',
    ),
    requestJson(
      apiRoot,
      `/api/instituciones?periodo=${CORTES.dashboard}&trimestre=${CORTES.trimestre}&anio=${CORTES.anio}&limite=${CORTES.limiteInstituciones}`,
      'el comparativo institucional CNBV',
    ),
    requestJson(
      apiRoot,
      `/api/fonacot?anio=${CORTES.anio}&trimestre=${CORTES.trimestre}`,
      'el contexto FONACOT',
    ),
    requestJson(apiRoot, `/api/sniiv?anio=${CORTES.anio}`, 'el contexto SNIIV'),
  ]);

  const serieAnual = [...(dashboard.serie_anual ?? [])].sort((a, b) =>
    a.periodo_ym.localeCompare(b.periodo_ym),
  );

  const bandasPorKpi = Object.fromEntries(
    (dashboard.bandas_2025 ?? []).map((banda) => [banda.kpi_id, banda]),
  );

  return {
    contratoVersion: dashboard.contrato_version,
    indicadores: INDICADORES_SECTORIALES,
    corte: dashboard.corte,
    periodo: dashboard.periodo_solicitado ?? CORTES.dashboard,
    serieAnual,
    bandasPorKpi,
    fuenteCnbv: dashboard.fuente,
    notaCnbv: dashboard.nota,
    sinDatosCnbv: dashboard.sin_datos,

    instituciones: instituciones.instituciones ?? [],
    corteInstituciones: instituciones.corte,
    trimestreInstituciones: instituciones.trimestre,
    limitadoInstituciones: instituciones.limitado,
    totalDevueltosInstituciones: instituciones.total_devueltos,
    notaInstituciones: instituciones.nota,
    sinDatosInstituciones: instituciones.sin_datos,
    fuenteInstituciones: instituciones.fuente,

    fonacot: fonacot.resumen_trimestral?.[0] ?? null,
    trimestreFonacot: fonacot.resumen_trimestral?.[0]?.trimestre ?? null,
    fuenteFonacot: fonacot.fuente,
    sinDatosFonacot: fonacot.sin_datos,

    sniiv: sniiv.resumen_anual?.[0] ?? null,
    anioSniiv: sniiv.resumen_anual?.[0]?.anio ?? null,
    fuenteSniiv: sniiv.fuente,
    sinDatosSniiv: sniiv.sin_datos,
  };
}
