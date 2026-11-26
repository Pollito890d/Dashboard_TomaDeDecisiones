import { INDICADORES_SECTORIALES } from '../constants/dashboardIndicators';

/**
 * PASO 25 — integración definitiva con el contrato API 1.0.0.
 *
 * Único punto de comunicación HTTP del frontend. Los siete endpoints se
 * consumen desde aquí, sin datasets de demostración ni fallback silencioso.
 * La selección inicial se deriva de los catálogos devueltos por FastAPI; nunca
 * de la fecha del sistema. Todas las solicitudes aceptan AbortSignal.
 */

const CONTRATO_ESPERADO = '1.0.0';
const LIMITES = Object.freeze({ periodos: 100, fuentes: 100, instituciones: 10 });
const RE_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;
const RE_TRIMESTRE = /^\d{4}-Q[1-4]$/;

export class ApiError extends Error {
  constructor(mensaje, { status = null, code = 'API', detail = null, campos = [] } = {}) {
    super(mensaje);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.campos = campos;
  }
}

export const esCancelacion = (error) =>
  error?.name === 'AbortError' || error?.code === 'ABORT_ERR';

const mensajeError = (error) => {
  if (error instanceof ApiError) return error.message;
  if (esCancelacion(error)) return 'Petición cancelada intencionalmente.';
  return 'Se presentó un error inesperado al consultar la API.';
};

const razonComoError = (razon) => (razon instanceof Error ? razon : new ApiError(mensajeError(razon)));

const textoDetalle = (detalle) => {
  if (typeof detalle === 'string') return detalle;
  if (Array.isArray(detalle)) {
    return detalle
      .map((item) => (typeof item?.msg === 'string' ? item.msg : item?.mensaje))
      .filter(Boolean)
      .join('; ');
  }
  return null;
};

const camposDetalle = (detalle, errores) => {
  const deErrores = Array.isArray(errores)
    ? errores.map((item) => item?.campo ?? item?.loc?.at?.(-1)).filter(Boolean)
    : [];
  const deDetalle = Array.isArray(detalle)
    ? detalle.map((item) => item?.loc?.at?.(-1)).filter(Boolean)
    : [];
  return [...new Set([...deErrores, ...deDetalle])];
};

const obtenerRaizApi = () => {
  const configurado = import.meta.env.VITE_API_URL;
  if (typeof configurado !== 'string' || !configurado.trim()) {
    throw new ApiError(
      'VITE_API_URL no está configurada. No se muestran datos de demostración en su lugar.',
      { code: 'CONFIGURACION' },
    );
  }
  const raiz = configurado.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(raiz)) {
    throw new ApiError(
      'VITE_API_URL debe ser una URL http(s) válida hacia FastAPI.',
      { code: 'CONFIGURACION' },
    );
  }
  return raiz;
};

const construirUrl = (raiz, ruta, params) => {
  const busqueda = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([clave, valor]) => {
    if (valor === undefined || valor === null || valor === '') return;
    // String() conserva la cadena "029056": el número 29056 perdería los ceros.
    busqueda.set(clave, String(valor));
  });
  const consulta = busqueda.toString();
  return `${raiz}${ruta}${consulta ? `?${consulta}` : ''}`;
};

const validarForma = (etiqueta, datos, esValida) => {
  if (!esValida(datos)) {
    throw new ApiError(`${etiqueta} devolvió una estructura incompatible con el contrato ${CONTRATO_ESPERADO}.`, {
      code: 'INCOMPATIBLE',
    });
  }
};

const parsearCuerpoError = async (respuesta) => {
  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    return { detail: null, campos: [] };
  }
  const detail = textoDetalle(cuerpo?.detail);
  return { detail, campos: camposDetalle(cuerpo?.detail, cuerpo?.errores) };
};

async function requestJson(
  ruta,
  { params = {}, signal, etiqueta, requiereContrato = true, validar = null } = {},
) {
  const url = construirUrl(obtenerRaizApi(), ruta, params);

  let respuesta;
  try {
    respuesta = await fetch(url, { signal });
  } catch (error) {
    if (esCancelacion(error)) throw error;
    throw new ApiError(`No fue posible comunicarse con FastAPI al consultar ${etiqueta}.`, {
      code: 'CONEXION',
    });
  }

  if (!respuesta.ok) {
    const { detail, campos } = await parsearCuerpoError(respuesta);
    const sufijo = detail ? `: ${detail}` : '.';
    let mensaje;
    if (respuesta.status === 422) {
      mensaje = `Parámetros no válidos en ${etiqueta}${sufijo}`;
    } else if (respuesta.status === 503) {
      mensaje = `Servicio no disponible al consultar ${etiqueta}${sufijo}`;
    } else {
      mensaje = `${etiqueta} respondió HTTP ${respuesta.status}${sufijo}`;
    }
    throw new ApiError(mensaje, { status: respuesta.status, detail, campos, code: 'HTTP' });
  }

  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    throw new ApiError(`${etiqueta} devolvió una respuesta JSON no válida.`, { code: 'JSON' });
  }

  if (requiereContrato && datos?.contrato_version !== CONTRATO_ESPERADO) {
    throw new ApiError(`${etiqueta} no usa el contrato ${CONTRATO_ESPERADO}.`, {
      code: 'CONTRATO',
    });
  }
  if (validar) validarForma(etiqueta, datos, validar);

  return datos;
}

/* ------------------------------------------------------------------------- *
 * Endpoints oficiales
 * ------------------------------------------------------------------------- */

export function fetchHealth({ signal } = {}) {
  return requestJson('/api/health', {
    signal,
    etiqueta: 'el estado de la API',
    requiereContrato: false,
    validar: (datos) => typeof datos?.status === 'string',
  });
}

export function fetchDashboard({ periodo = null, anio = null, signal } = {}) {
  return requestJson('/api/dashboard', {
    params: { periodo, anio },
    signal,
    etiqueta: 'el corte sectorial CNBV',
    validar: (datos) =>
      typeof datos?.periodo_solicitado === 'string' &&
      Array.isArray(datos.serie_anual) &&
      Array.isArray(datos.bandas_2025),
  });
}

export function fetchInstituciones({
  periodo = null,
  trimestre = null,
  claveSeis = null,
  anio = null,
  limite = LIMITES.instituciones,
  signal,
} = {}) {
  if (claveSeis !== null && claveSeis !== undefined && typeof claveSeis !== 'string') {
    throw new ApiError(
      'La clave institucional debe enviarse como cadena para conservar sus ceros iniciales.',
      { code: 'PARAMETRO' },
    );
  }
  return requestJson('/api/instituciones', {
    params: { periodo, trimestre, clave_seis: claveSeis, anio, limite },
    signal,
    etiqueta: 'el comparativo institucional CNBV',
    validar: (datos) =>
      Array.isArray(datos?.instituciones) &&
      typeof datos.total_devueltos === 'number' &&
      typeof datos.limitado === 'boolean',
  });
}

export function fetchPeriodos({ anio = null, limite = LIMITES.periodos, signal } = {}) {
  return requestJson('/api/periodos', {
    params: { anio, limite },
    signal,
    etiqueta: 'el catálogo de períodos',
    validar: (datos) => Array.isArray(datos?.periodos),
  });
}

export function fetchFuentes({ fuente = null, rol = null, limite = LIMITES.fuentes, signal } = {}) {
  return requestJson('/api/fuentes', {
    params: { fuente, rol, limite },
    signal,
    etiqueta: 'el catálogo de fuentes',
    validar: (datos) => Array.isArray(datos?.fuentes),
  });
}

export function fetchFonacot({ anio = null, trimestre = null, incluirAmbitos = false, signal } = {}) {
  return requestJson('/api/fonacot', {
    params: {
      anio,
      trimestre,
      ...(incluirAmbitos ? { incluir_ambitos: true } : {}),
    },
    signal,
    etiqueta: 'el contexto FONACOT',
    validar: (datos) => Array.isArray(datos?.resumen_trimestral),
  });
}

export function fetchSniiv({ anio = null, incluirEntidades = false, signal } = {}) {
  return requestJson('/api/sniiv', {
    params: {
      anio,
      ...(incluirEntidades ? { incluir_entidades: true } : {}),
    },
    signal,
    etiqueta: 'el contexto SNIIV',
    validar: (datos) => Array.isArray(datos?.resumen_anual),
  });
}

/* ------------------------------------------------------------------------- *
 * Catálogos, trazabilidad y selección inicial
 * ------------------------------------------------------------------------- */

const trimestreDePeriodo = (periodo) => {
  if (!RE_PERIODO.test(periodo ?? '')) return null;
  const mes = Number(periodo.slice(5, 7));
  return `${periodo.slice(0, 4)}-Q${Math.ceil(mes / 3)}`;
};

const periodoDeTrimestre = (trimestre) => {
  if (!RE_TRIMESTRE.test(trimestre ?? '')) return null;
  return `${trimestre.slice(0, 4)}-${String(Number(trimestre.slice(-1)) * 3).padStart(2, '0')}`;
};

const ordenarFonacot = (filas) =>
  [...(filas ?? [])].sort((a, b) =>
    `${a.anio}-${a.trimestre}`.localeCompare(`${b.anio}-${b.trimestre}`),
  );

const ordenarSniiv = (filas) =>
  [...(filas ?? [])].sort((a, b) => Number(a.anio) - Number(b.anio));

/**
 * Selección inicial reutilizable: toma los valores del corte efectivo informado
 * por la API y los valida contra los catálogos reales. No hay Date(), ni meses
 * semanales, ni suposición de que todas las fuentes compartan cobertura.
 */
export function construirSeleccionInicial(catalogos = {}, overrides = {}) {
  const mensuales = (catalogos.periodos?.periodos ?? []).filter((valor) => RE_PERIODO.test(valor));
  const corteApi = catalogos.dashboard?.periodo_solicitado;
  const periodoApi = RE_PERIODO.test(corteApi ?? '') ? corteApi : null;
  const periodoOverride = RE_PERIODO.test(overrides.periodo ?? '') ? overrides.periodo : null;
  const periodo = periodoOverride
    ?? (mensuales.includes(periodoApi) ? periodoApi : null)
    ?? periodoApi
    ?? mensuales[0]
    ?? null;

  const anioOverride =
    overrides.anio !== null && overrides.anio !== undefined && overrides.anio !== ''
      ? Number(overrides.anio)
      : null;
  const anio = Number.isFinite(anioOverride)
    ? anioOverride
    : periodo
      ? Number(periodo.slice(0, 4))
      : null;

  const mesesTrimestrales = mensuales.filter((valor) =>
    [3, 6, 9, 12].includes(Number(valor.slice(5, 7))),
  );
  const corteTrimestralNatural = periodo
    ? `${String(anio).padStart(4, '0')}-${String(Math.ceil(Number(periodo.slice(5, 7)) / 3) * 3).padStart(2, '0')}`
    : null;

  let periodoInstitucional = RE_PERIODO.test(overrides.periodoInstitucional ?? '')
    ? overrides.periodoInstitucional
    : null;
  if (!periodoInstitucional) {
    const delAnio = mesesTrimestrales.filter((valor) => valor.startsWith(String(anio)));
    periodoInstitucional = (corteTrimestralNatural && mesesTrimestrales.includes(corteTrimestralNatural)
      ? corteTrimestralNatural
      : null)
      ?? delAnio[0]
      ?? mesesTrimestrales[0]
      ?? null;
  }

  const trimestreOverrideOk = RE_TRIMESTRE.test(overrides.trimestreInstitucional ?? '');
  let trimestreInstitucional = trimestreOverrideOk
    ? overrides.trimestreInstitucional
    : (periodoInstitucional ? trimestreDePeriodo(periodoInstitucional) : null);
  if (!periodoInstitucional && trimestreInstitucional) {
    const derivado = periodoDeTrimestre(trimestreInstitucional);
    if (mensuales.includes(derivado)) periodoInstitucional = derivado;
  }

  const anioInstitucionalOverride =
    overrides.anioInstitucional !== null &&
    overrides.anioInstitucional !== undefined &&
    overrides.anioInstitucional !== ''
      ? Number(overrides.anioInstitucional)
      : null;
  const anioInstitucional = Number.isFinite(anioInstitucionalOverride)
    ? anioInstitucionalOverride
    : trimestreInstitucional
      ? Number(trimestreInstitucional.slice(0, 4))
      : anio;

  const filasFonacot = ordenarFonacot(catalogos.fonacot?.resumen_trimestral);
  const filaFonacotPreferida = [...filasFonacot].reverse().find((fila) => Number(fila.anio) === anio)
    ?? filasFonacot[filasFonacot.length - 1]
    ?? null;
  const trimestreFonacotOverride = RE_TRIMESTRE.test(overrides.trimestreFonacot ?? '')
    ? overrides.trimestreFonacot
    : null;
  const trimestreFonacot = trimestreFonacotOverride
    ?? filaFonacotPreferida?.trimestre
    ?? null;

  const filasSniiv = ordenarSniiv(catalogos.sniiv?.resumen_anual);
  const anioSniivOverride =
    overrides.anioSniiv !== null && overrides.anioSniiv !== undefined && overrides.anioSniiv !== ''
      ? Number(overrides.anioSniiv)
      : null;
  const anioSniiv = Number.isFinite(anioSniivOverride)
    ? anioSniivOverride
    : filasSniiv.find((fila) => Number(fila.anio) === anio)?.anio
      ?? filasSniiv[filasSniiv.length - 1]?.anio
      ?? null;

  const claveSeis = typeof overrides.claveSeis === 'string' && overrides.claveSeis
    ? overrides.claveSeis
    : null;
  const limiteSolicitado = Number(overrides.limiteInstituciones);
  const limiteInstituciones = Number.isInteger(limiteSolicitado) && limiteSolicitado >= 1 && limiteSolicitado <= 100
    ? limiteSolicitado
    : LIMITES.instituciones;

  return {
    periodo,
    anio,
    periodoInstitucional,
    trimestreInstitucional,
    anioInstitucional,
    trimestreFonacot,
    anioSniiv,
    claveSeis,
    limiteInstituciones,
  };
}

const construirCatalogos = ({ periodos, instituciones, fonacot, sniiv }) => {
  const periodosMensuales = (periodos?.periodos ?? []).map((valor) => ({
    value: valor,
    anio: Number(String(valor).slice(0, 4)),
    mes: Number(String(valor).slice(5, 7)),
  }));

  const periodosInstitucionales = periodosMensuales
    .filter(({ mes }) => [3, 6, 9, 12].includes(mes))
    .map(({ value, anio, mes }) => ({
      value,
      anio,
      trimestre: trimestreDePeriodo(value),
      etiqueta: `T${Math.ceil(mes / 3)} ${anio}`,
    }));

  const trimestresFonacot = ordenarFonacot(fonacot?.resumen_trimestral)
    .reverse()
    .filter((fila) => fila?.trimestre)
    .map((fila) => ({
      value: fila.trimestre,
      anio: fila.anio,
      etiqueta: `T${String(fila.trimestre).slice(-1)} ${fila.anio}`,
    }));

  const aniosSniiv = ordenarSniiv(sniiv?.resumen_anual)
    .reverse()
    .map((fila) => Number(fila.anio))
    .filter((anio) => Number.isFinite(anio))
    .map((anio) => ({ value: anio, etiqueta: String(anio) }));

  const institucionesCatalogo = (instituciones?.instituciones ?? []).map((fila) => ({
    claveSeis: fila.clave_seis,
    nombre: fila.institucion_nombre,
    corte: instituciones?.corte ?? null,
    trimestre: instituciones?.trimestre ?? null,
  }));

  return {
    periodosMensuales,
    periodosInstitucionales,
    trimestresFonacot,
    aniosSniiv,
    instituciones: institucionesCatalogo,
    totalInstitucionesDevueltas: instituciones?.total_devueltos ?? institucionesCatalogo.length,
    limitadoInstituciones: instituciones?.limitado ?? false,
    nota: 'Los meses del catálogo no garantizan observaciones: cada fuente valida su propio corte.',
  };
};

const construirResumenFuentes = (respuesta) => {
  const filas = respuesta?.fuentes ?? [];
  const agrupado = new Map();

  filas.forEach((fila) => {
    const nombre = fila?.fuente ?? 'No disponible';
    const actual = agrupado.get(nombre) ?? {
      nombre,
      total: 0,
      roles: new Set(),
      desde: null,
      hasta: null,
      hashCorto: null,
    };
    actual.total += 1;
    if (fila?.rol) actual.roles.add(fila.rol);
    if (fila?.periodo_desde && (!actual.desde || fila.periodo_desde < actual.desde)) {
      actual.desde = fila.periodo_desde;
    }
    if (fila?.periodo_hasta && (!actual.hasta || fila.periodo_hasta > actual.hasta)) {
      actual.hasta = fila.periodo_hasta;
    }
    if (!actual.hashCorto && typeof fila?.sha256 === 'string') {
      actual.hashCorto = fila.sha256.slice(0, 12);
    }
    agrupado.set(nombre, actual);
  });

  const porFuente = [...agrupado.values()]
    .map(({ roles, ...resto }) => ({ ...resto, roles: [...roles] }))
    .sort((a, b) => b.total - a.total);

  return {
    total: respuesta?.total ?? porFuente.reduce((suma, fila) => suma + fila.total, 0),
    porFuente,
    sinDatos: Boolean(respuesta?.sin_datos),
    conTrazabilidad: porFuente.some((fila) => Boolean(fila.hashCorto)),
  };
};

/* ------------------------------------------------------------------------- *
 * Orquestación reutilizable por el hook
 * ------------------------------------------------------------------------- */

const INDICES = Object.freeze({
  dashboard: 0,
  periodos: 1,
  fonacot: 2,
  sniiv: 3,
  fuentes: 4,
  health: 5,
});

/**
 * Carga oficial completa. Sin parámetros, `/api/dashboard` devuelve el corte
 * con observaciones más reciente según sus propios catálogos; esa respuesta y
 * `/api/periodos` determinan la selección inicial. Con parámetros explícitos,
 * se respeta exactamente la selección recibida (preparado para el paso 26).
 */
export async function loadDashboardData(parametros = {}, { signal } = {}) {
  const seleccionSolicitada = parametros ?? {};
  const faseCatalogos = await Promise.allSettled([
    fetchDashboard({ periodo: seleccionSolicitada.periodo ?? null, anio: seleccionSolicitada.anio ?? null, signal }),
    fetchPeriodos({ signal }),
    fetchFonacot({ signal }),
    fetchSniiv({ signal }),
    fetchFuentes({ signal }),
    fetchHealth({ signal }),
  ]);

  const canceladaCatalogos = faseCatalogos.find(
    (item) => item.status === 'rejected' && esCancelacion(item.reason),
  );
  if (canceladaCatalogos) throw canceladaCatalogos.reason;

  const valor = (clave) => {
    const resultado = faseCatalogos[INDICES[clave]];
    return resultado.status === 'fulfilled' ? resultado.value : null;
  };

  if (faseCatalogos[INDICES.dashboard].status === 'rejected') {
    throw razonComoError(faseCatalogos[INDICES.dashboard].reason);
  }

  const errores = {};
  ['periodos', 'fonacot', 'sniiv', 'fuentes', 'health'].forEach((clave) => {
    const resultado = faseCatalogos[INDICES[clave]];
    if (resultado.status === 'rejected') errores[clave] = mensajeError(resultado.reason);
  });

  const dashboard = valor('dashboard');
  const periodos = valor('periodos');
  const fonacotCatalogo = valor('fonacot');
  const sniivCatalogo = valor('sniiv');
  const fuentes = valor('fuentes');
  const health = valor('health');

  const seleccion = construirSeleccionInicial(
    { dashboard, periodos, fonacot: fonacotCatalogo, sniiv: sniivCatalogo },
    seleccionSolicitada,
  );

  let instituciones = null;
  try {
    instituciones = await fetchInstituciones({
      periodo: seleccion.periodoInstitucional,
      trimestre: seleccion.trimestreInstitucional,
      claveSeis: seleccion.claveSeis,
      anio: seleccion.anioInstitucional,
      limite: seleccion.limiteInstituciones,
      signal,
    });
  } catch (error) {
    if (esCancelacion(error)) throw error;
    errores.instituciones = mensajeError(error);
  }

  const filasFonacot = ordenarFonacot(fonacotCatalogo?.resumen_trimestral);
  const fonacotFila = seleccion.trimestreFonacot
    ? filasFonacot.find((fila) => fila.trimestre === seleccion.trimestreFonacot) ?? null
    : filasFonacot[filasFonacot.length - 1] ?? null;
  if (seleccion.trimestreFonacot && !fonacotFila && !errores.fonacot) {
    errores.fonacot = `FONACOT no tiene información oficial para ${seleccion.trimestreFonacot}.`;
  }

  const filasSniiv = ordenarSniiv(sniivCatalogo?.resumen_anual);
  const sniivFila = seleccion.anioSniiv !== null
    ? filasSniiv.find((fila) => Number(fila.anio) === Number(seleccion.anioSniiv)) ?? null
    : filasSniiv[filasSniiv.length - 1] ?? null;
  if (seleccion.anioSniiv !== null && !sniivFila && !errores.sniiv) {
    errores.sniiv = `SNIIV no tiene información oficial para ${seleccion.anioSniiv}.`;
  }

  const serieAnual = [...(dashboard.serie_anual ?? [])].sort((a, b) =>
    String(a.periodo_ym).localeCompare(String(b.periodo_ym)),
  );
  const bandasPorKpi = Object.fromEntries(
    (dashboard.bandas_2025 ?? []).map((banda) => [banda.kpi_id, banda]),
  );

  return {
    contratoVersion: dashboard.contrato_version,
    indicadores: INDICADORES_SECTORIALES,
    corte: dashboard.corte,
    periodo: dashboard.periodo_solicitado ?? seleccion.periodo,
    serieAnual,
    bandasPorKpi,
    fuenteCnbv: dashboard.fuente ?? null,
    notaCnbv: dashboard.nota ?? null,
    sinDatosCnbv: Boolean(dashboard.sin_datos),
    periodosDisponiblesCnbv: dashboard.periodos_disponibles ?? null,

    instituciones: instituciones?.instituciones ?? [],
    corteInstituciones: instituciones?.corte ?? seleccion.periodoInstitucional,
    trimestreInstituciones: instituciones?.trimestre ?? seleccion.trimestreInstitucional,
    limitadoInstituciones: instituciones?.limitado ?? false,
    totalDevueltosInstituciones: instituciones?.total_devueltos ?? 0,
    notaInstituciones: instituciones?.nota ?? null,
    sinDatosInstituciones: instituciones?.sin_datos ?? true,
    fuenteInstituciones: instituciones?.fuente ?? null,
    claveSeisInstituciones: seleccion.claveSeis,

    fonacot: fonacotFila,
    trimestreFonacot: fonacotFila?.trimestre ?? seleccion.trimestreFonacot,
    fuenteFonacot: fonacotCatalogo?.fuente ?? null,
    sinDatosFonacot: fonacotCatalogo?.sin_datos ?? !fonacotFila,

    sniiv: sniivFila,
    anioSniiv: sniivFila?.anio ?? seleccion.anioSniiv,
    fuenteSniiv: sniivCatalogo?.fuente ?? null,
    sinDatosSniiv: sniivCatalogo?.sin_datos ?? !sniivFila,

    catalogos: construirCatalogos({ periodos, instituciones, fonacot: fonacotCatalogo, sniiv: sniivCatalogo }),
    fuentes: construirResumenFuentes(fuentes),
    estadoApi: health
      ? {
          status: health.status ?? null,
          database: health.database ?? null,
          detail: health.detail ?? null,
        }
      : null,
    seleccion: {
      ...seleccion,
      periodo: dashboard.periodo_solicitado ?? seleccion.periodo,
      anio: seleccion.anio,
      corteInstitucional: instituciones?.corte ?? seleccion.periodoInstitucional,
      trimestreInstitucional: instituciones?.trimestre ?? seleccion.trimestreInstitucional,
      trimestreFonacot: fonacotFila?.trimestre ?? seleccion.trimestreFonacot,
      anioSniiv: sniivFila?.anio ?? seleccion.anioSniiv,
    },
    errores,
  };
}

export default loadDashboardData;
