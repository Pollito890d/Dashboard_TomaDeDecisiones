import { INDICADORES_SECTORIALES } from '../constants/dashboardIndicators.js';
import { toNumberOrNull } from '../utils/formatters.js';

/**
 * Único punto de comunicación HTTP del frontend (contrato API 1.0.0).
 *
 * Además de la carga inicial completa, expone cargadores por fuente para que
 * un cambio de filtro no vuelva a consultar las demás. Todas las funciones
 * aceptan AbortSignal y ninguna contiene datos de demostración.
 */

const CONTRATO_ESPERADO = '1.0.0';
const LIMITES = Object.freeze({ periodos: 100, fuentes: 100, instituciones: 10 });
const RE_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;
const RE_TRIMESTRE = /^\d{4}-Q[1-4]$/;
const MESES_TRIMESTRE = [3, 6, 9, 12];
const CAMPOS_SERIE_GRAFICA = [
  'kpi01_imor_pct', 'kpi02_icor_pct', 'kpi03_liquidez_pct', 'kpi04_nicap_pct',
  'kpi05_tasa_activa_pct', 'kpi06_tasa_pasiva_pct', 'kpi07_capital_activo_pct',
  'kpi08_roa_pct', 'kpi09_colocacion_captacion_trad_pct',
];

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

export const describirError = mensajeError;

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

export function fetchPeriodos({
  fuente = null,
  anio = null,
  limite = LIMITES.periodos,
  signal,
} = {}) {
  return requestJson('/api/periodos', {
    params: { fuente, anio, limite },
    signal,
    etiqueta: 'el catálogo de períodos',
    validar: (datos) => Array.isArray(datos?.periodos),
  });
}

export function fetchCatalogoInstituciones({ signal } = {}) {
  return requestJson('/api/instituciones/catalogo', {
    signal,
    etiqueta: 'el catálogo de cooperativas',
    validar: (datos) =>
      Array.isArray(datos?.instituciones) && typeof datos.total === 'number',
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

export function fetchFonacot({
  anio = null,
  trimestre = null,
  incluirAmbitos = true,
  signal,
} = {}) {
  return requestJson('/api/fonacot', {
    params: { anio, trimestre, ...(incluirAmbitos ? { incluir_ambitos: true } : {}) },
    signal,
    etiqueta: 'el contexto FONACOT',
    validar: (datos) =>
      Array.isArray(datos?.resumen_trimestral) &&
      (!incluirAmbitos || Array.isArray(datos?.por_ambito)),
  });
}

export function fetchSniiv({ anio = null, incluirEntidades = true, signal } = {}) {
  return requestJson('/api/sniiv', {
    params: { anio, ...(incluirEntidades ? { incluir_entidades: true } : {}) },
    signal,
    etiqueta: 'el contexto SNIIV',
    validar: (datos) =>
      Array.isArray(datos?.resumen_anual) &&
      (!incluirEntidades || Array.isArray(datos?.por_entidad)),
  });
}

/* ------------------------------------------------------------------------- *
 * Derivaciones y selección inicial
 * ------------------------------------------------------------------------- */

export const trimestreDePeriodo = (periodo) => {
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

const numeroValido = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

const unicos = (valores) => [
  ...new Set(valores.filter((valor) => valor !== null && valor !== undefined && valor !== '')),
];

const periodosObservados = (filas, clave) =>
  unicos((filas ?? []).map((fila) => fila?.[clave]))
    .filter((valor) => RE_PERIODO.test(valor ?? ''))
    .sort();

const esPeriodoTrimestral = (periodo) => MESES_TRIMESTRE.includes(Number(periodo.slice(5, 7)));

const limiteValido = (valor) => {
  const numero = numeroValido(valor);
  return Number.isInteger(numero) && numero >= 1 && numero <= 100 ? numero : LIMITES.instituciones;
};

/**
 * Selección inicial: cada fuente aporta su propio corte observado en la
 * ejecución activa. Nunca se usa la fecha del sistema ni un año fijo.
 */
export function construirSeleccionInicial(catalogos = {}, overrides = {}, periodos = {}) {
  const mensuales = periodosObservados(
    [
      ...(periodos.cnbv_sectorial?.periodos ?? []).map((valor) => ({ periodo_ym: valor })),
      ...(catalogos.dashboard?.serie_anual ?? []),
    ],
    'periodo_ym',
  );
  const corteApi = catalogos.dashboard?.periodo_solicitado;
  const periodoApi = RE_PERIODO.test(corteApi ?? '') ? corteApi : null;
  const periodoOverride = RE_PERIODO.test(overrides.periodo ?? '') ? overrides.periodo : null;
  const periodo = periodoOverride
    ?? (mensuales.includes(periodoApi) ? periodoApi : null)
    ?? periodoApi
    ?? mensuales[mensuales.length - 1]
    ?? null;

  const anioOverride = numeroValido(overrides.anio);
  const anio = anioOverride ?? (periodo ? Number(periodo.slice(0, 4)) : null);

  const cortesInstitucionales = periodosObservados(
    [
      ...(periodos.cnbv_institucional?.periodos ?? []).map((valor) => ({ periodo_ym: valor })),
      ...(catalogos.instituciones?.corte ? [{ periodo_ym: catalogos.instituciones.corte }] : []),
      ...(catalogos.instituciones?.instituciones ?? []),
    ],
    'periodo_ym',
  ).filter(esPeriodoTrimestral);
  const corteInstitucionalApi = catalogos.instituciones?.corte;
  const corteInstitucionalValido = cortesInstitucionales.includes(corteInstitucionalApi)
    ? corteInstitucionalApi
    : null;
  const periodoInstitucionalOverride = RE_PERIODO.test(overrides.periodoInstitucional ?? '')
    ? overrides.periodoInstitucional
    : null;
  const trimestreInstitucionalOverride = RE_TRIMESTRE.test(overrides.trimestreInstitucional ?? '')
    ? overrides.trimestreInstitucional
    : null;
  let periodoInstitucional = periodoInstitucionalOverride
    ?? corteInstitucionalValido
    ?? (trimestreInstitucionalOverride ? periodoDeTrimestre(trimestreInstitucionalOverride) : null)
    ?? cortesInstitucionales[cortesInstitucionales.length - 1]
    ?? null;

  const trimestreInstitucional = trimestreInstitucionalOverride
    ?? (RE_TRIMESTRE.test(catalogos.instituciones?.trimestre ?? '')
      ? catalogos.instituciones.trimestre
      : null)
    ?? (periodoInstitucional ? trimestreDePeriodo(periodoInstitucional) : null);
  if (!periodoInstitucional && trimestreInstitucional) {
    const derivado = periodoDeTrimestre(trimestreInstitucional);
    if (cortesInstitucionales.includes(derivado)) periodoInstitucional = derivado;
  }

  const anioInstitucional = numeroValido(overrides.anioInstitucional)
    ?? (trimestreInstitucional ? Number(trimestreInstitucional.slice(0, 4)) : null)
    ?? (periodoInstitucional ? Number(periodoInstitucional.slice(0, 4)) : anio);

  const filasFonacot = ordenarFonacot(catalogos.fonacot?.resumen_trimestral);
  const filaFonacotPreferida = filasFonacot[filasFonacot.length - 1] ?? null;
  const trimestreFonacot = RE_TRIMESTRE.test(overrides.trimestreFonacot ?? '')
    ? overrides.trimestreFonacot
    : filaFonacotPreferida?.trimestre
      ?? null;
  const anioFonacot = numeroValido(overrides.anioFonacot)
    ?? numeroValido(filaFonacotPreferida?.anio)
    ?? (trimestreFonacot ? Number(trimestreFonacot.slice(0, 4)) : anio);

  const filasSniiv = ordenarSniiv(catalogos.sniiv?.resumen_anual);
  const anioSniiv = numeroValido(overrides.anioSniiv)
    ?? numeroValido(filasSniiv[filasSniiv.length - 1]?.anio)
    ?? null;

  const claveSeis = typeof overrides.claveSeis === 'string' && overrides.claveSeis
    ? overrides.claveSeis
    : null;

  return {
    periodo,
    anio,
    periodoInstitucional,
    trimestreInstitucional,
    anioInstitucional,
    trimestreFonacot,
    anioFonacot,
    anioSniiv,
    claveSeis,
    limiteInstituciones: limiteValido(overrides.limiteInstituciones),
  };
}

/* ------------------------------------------------------------------------- *
 * Normalización por fuente (la usan la carga inicial y las cargas parciales)
 * ------------------------------------------------------------------------- */

export const sectorSlice = (respuesta, seleccion = {}) => ({
  contratoVersion: respuesta?.contrato_version ?? null,
  indicadores: INDICADORES_SECTORIALES,
  corte: respuesta?.corte ?? null,
  periodo: respuesta?.periodo_solicitado ?? seleccion.periodo ?? null,
  // Los Decimal llegan como cadena: las gráficas necesitan números, pero los
  // nulos oficiales se conservan como null (nunca como cero).
  serieAnual: [...(respuesta?.serie_anual ?? [])]
    .map((fila) => ({
      ...fila,
      ...Object.fromEntries(
        CAMPOS_SERIE_GRAFICA.map((campo) => [campo, toNumberOrNull(fila?.[campo])]),
      ),
    }))
    .sort((a, b) => String(a.periodo_ym).localeCompare(String(b.periodo_ym))),
  bandasPorKpi: Object.fromEntries(
    (respuesta?.bandas_2025 ?? []).map((banda) => [banda.kpi_id, banda]),
  ),
  fuenteCnbv: respuesta?.fuente ?? null,
  notaCnbv: respuesta?.nota ?? null,
  sinDatosCnbv: Boolean(respuesta?.sin_datos),
  periodosDisponiblesCnbv: respuesta?.periodos_disponibles ?? null,
});

const institucionesSlice = (respuesta, seleccion = {}) => ({
  instituciones: respuesta?.instituciones ?? [],
  corteInstituciones: respuesta?.corte ?? seleccion.periodoInstitucional ?? null,
  trimestreInstituciones: respuesta?.trimestre ?? seleccion.trimestreInstitucional ?? null,
  limitadoInstituciones: respuesta?.limitado ?? false,
  totalDevueltosInstituciones: respuesta?.total_devueltos ?? 0,
  notaInstituciones: respuesta?.nota ?? null,
  sinDatosInstituciones: respuesta?.sin_datos ?? true,
  fuenteInstituciones: respuesta?.fuente ?? null,
  claveSeisInstituciones: typeof seleccion.claveSeis === 'string' ? seleccion.claveSeis : null,
});

export const fonacotSlice = (respuesta, seleccion = {}) => {
  const filas = ordenarFonacot(respuesta?.resumen_trimestral);
  const fila = seleccion.trimestreFonacot
    ? filas.find((item) => item.trimestre === seleccion.trimestreFonacot) ?? null
    : filas[filas.length - 1] ?? null;
  const trimestre = fila?.trimestre ?? seleccion.trimestreFonacot ?? null;
  const porAmbito = (respuesta?.por_ambito ?? []).filter(
    (item) => !trimestre || item?.trimestre === trimestre,
  );
  const entidades = [...new Set(
    porAmbito
      .filter((item) => item?.tipo_ambito === 'entidad' && item?.ambito_canonico)
      .map((item) => item.ambito_canonico),
  )].sort((a, b) => String(a).localeCompare(String(b), 'es'));

  return {
    fonacot: fila,
    trimestreFonacot: fila?.trimestre ?? seleccion.trimestreFonacot ?? null,
    anioFonacot: numeroValido(fila?.anio) ?? numeroValido(seleccion.anioFonacot) ?? null,
    fuenteFonacot: respuesta?.fuente ?? null,
    sinDatosFonacot: Boolean(respuesta?.sin_datos) || !fila,
    desgloseFonacot: porAmbito,
    entidadesFonacot: entidades,
  };
};

const sniivSlice = (respuesta, seleccion = {}) => {
  const filas = ordenarSniiv(respuesta?.resumen_anual);
  const fila = numeroValido(seleccion.anioSniiv) !== null
    ? filas.find((item) => Number(item.anio) === Number(seleccion.anioSniiv)) ?? null
    : filas[filas.length - 1] ?? null;
  const porEntidad = respuesta?.por_entidad ?? [];
  const entidades = porEntidad
    .filter((item) => item?.cve_ent !== null && item?.cve_ent !== undefined && item.cve_ent !== '')
    .map((item) => ({
      value: String(item.cve_ent),
      etiqueta: `${String(item.cve_ent).padStart(2, '0')} · ${item.entidad_nombre ?? 'Entidad'}`,
      nombre: item.entidad_nombre ?? null,
    }))
    .sort((a, b) => a.value.localeCompare(b.value));

  return {
    sniiv: fila,
    anioSniiv: numeroValido(fila?.anio) ?? numeroValido(seleccion.anioSniiv) ?? null,
    fuenteSniiv: respuesta?.fuente ?? null,
    sinDatosSniiv: Boolean(respuesta?.sin_datos) || !fila,
    desgloseSniiv: porEntidad,
    entidadesSniiv: entidades,
  };
};

/** Cargadores independientes: cada filtro consulta solo su fuente. */
export async function cargarCnbv(parametros = {}, { signal } = {}) {
  const respuesta = await fetchDashboard({
    periodo: parametros.periodo ?? null,
    anio: parametros.anio ?? null,
    signal,
  });
  return sectorSlice(respuesta, parametros);
}

export async function cargarInstituciones(parametros = {}, { signal } = {}) {
  const respuesta = await fetchInstituciones({
    periodo: parametros.periodoInstitucional ?? null,
    trimestre: parametros.trimestreInstitucional ?? null,
    claveSeis: parametros.claveSeis ?? null,
    anio: parametros.anioInstitucional ?? null,
    limite: limiteValido(parametros.limiteInstituciones),
    signal,
  });
  return institucionesSlice(respuesta, parametros);
}

export async function cargarFonacot(parametros = {}, { signal } = {}) {
  const respuesta = await fetchFonacot({
    anio: parametros.anioFonacot ?? null,
    trimestre: parametros.trimestreFonacot ?? null,
    incluirAmbitos: true,
    signal,
  });
  return fonacotSlice(respuesta, parametros);
}

export async function cargarSniiv(parametros = {}, { signal } = {}) {
  const respuesta = await fetchSniiv({
    anio: parametros.anioSniiv ?? null,
    incluirEntidades: true,
    signal,
  });
  return sniivSlice(respuesta, parametros);
}

/* ------------------------------------------------------------------------- *
 * Catálogos, trazabilidad y carga inicial
 * ------------------------------------------------------------------------- */

export const construirCatalogos = ({
  dashboard,
  instituciones,
  fonacot,
  sniiv,
  periodos = {},
  catalogoInstituciones = null,
}) => {
  const comoFilasPeriodo = (valores) =>
    (valores ?? []).map((valor) => ({ periodo_ym: valor }));

  // Catálogos observados por fuente; se conserva el derivado de las respuestas
  // como respaldo si alguna consulta de períodos no estuvo disponible.
  const mensualesObservados = periodosObservados(
    comoFilasPeriodo(periodos.cnbv_sectorial?.periodos),
    'periodo_ym',
  );
  const mensuales = mensualesObservados.length
    ? mensualesObservados
    : periodosObservados(dashboard?.serie_anual, 'periodo_ym');
  const periodosMensuales = [...mensuales].reverse().map((valor) => ({
    value: valor,
    anio: Number(valor.slice(0, 4)),
    mes: Number(valor.slice(5, 7)),
  }));

  const cortesObservados = periodosObservados(
    comoFilasPeriodo(periodos.cnbv_institucional?.periodos),
    'periodo_ym',
  ).filter(esPeriodoTrimestral);
  const cortesRespaldo = [
    ...(instituciones?.corte ? [{ periodo_ym: instituciones.corte }] : []),
    ...(instituciones?.instituciones ?? []),
  ];
  const cortes = cortesObservados.length
    ? cortesObservados
    : periodosObservados(cortesRespaldo, 'periodo_ym').filter(esPeriodoTrimestral);
  const periodosInstitucionales = [...cortes].reverse().map((valor) => ({
    value: valor,
    anio: Number(valor.slice(0, 4)),
    trimestre: trimestreDePeriodo(valor),
    etiqueta: `T${Math.ceil(Number(valor.slice(5, 7)) / 3)} ${Number(valor.slice(0, 4))}`,
  }));

  const trimestresFonacot = unicos([
    ...periodosObservados(comoFilasPeriodo(periodos.fonacot?.periodos), 'periodo_ym')
      .map(trimestreDePeriodo),
    ...ordenarFonacot(fonacot?.resumen_trimestral).map((fila) => fila?.trimestre),
  ])
    .sort()
    .reverse()
    .map((valor) => ({
      value: valor,
      anio: Number(valor.slice(0, 4)),
      etiqueta: `T${String(valor).slice(-1)} ${Number(valor.slice(0, 4))}`,
    }));

  const aniosSniiv = unicos([
    ...periodosObservados(comoFilasPeriodo(periodos.sniiv?.periodos), 'periodo_ym')
      .map((valor) => Number(valor.slice(0, 4))),
    ...ordenarSniiv(sniiv?.resumen_anual).map((fila) => numeroValido(fila?.anio)),
  ])
    .sort((a, b) => b - a)
    .map((anio) => ({ value: anio, etiqueta: String(anio) }));

  // El selector se llena desde el catálogo completo, nunca desde las filas del
  // ranking (que están limitadas a 10 y cambian con la ficha seleccionada).
  const filasCatalogo = catalogoInstituciones?.instituciones ?? [];
  const usaCatalogoCompleto = filasCatalogo.length > 0;
  const filasSelector = usaCatalogoCompleto
    ? filasCatalogo
    : (instituciones?.instituciones ?? []);
  const institucionesCatalogo = filasSelector.map((fila) => ({
    claveSeis: fila.clave_seis,
    nombre: fila.nombre ?? fila.institucion_nombre,
    corte: usaCatalogoCompleto ? null : (instituciones?.corte ?? null),
    trimestre: usaCatalogoCompleto ? null : (instituciones?.trimestre ?? null),
  }));

  return {
    periodosMensuales,
    periodosInstitucionales,
    trimestresFonacot,
    aniosSniiv,
    instituciones: institucionesCatalogo,
    totalInstitucionesDevueltas: usaCatalogoCompleto
      ? (catalogoInstituciones.total ?? filasCatalogo.length)
      : (instituciones?.total_devueltos ?? institucionesCatalogo.length),
    limitadoInstituciones: usaCatalogoCompleto
      ? false
      : (instituciones?.limitado ?? false),
    catalogoInstitucionesIndependiente: usaCatalogoCompleto,
    nota: 'Los períodos provienen de las observaciones de cada fuente en la ejecución activa.',
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

const INDICES = Object.freeze({
  dashboard: 0,
  instituciones: 1,
  fonacot: 2,
  sniiv: 3,
  fuentes: 4,
  health: 5,
  periodosSectorial: 6,
  periodosInstitucional: 7,
  periodosFonacot: 8,
  periodosSniiv: 9,
  catalogoInstituciones: 10,
});

/**
 * Carga inicial completa: determina la selección a partir de las respuestas
 * oficiales y deja los catálogos listos para los filtros interactivos.
 */
export async function loadDashboardData(parametros = {}, { signal } = {}) {
  const seleccionSolicitada = parametros ?? {};
  const faseCatalogos = await Promise.allSettled([
    fetchDashboard({
      periodo: seleccionSolicitada.periodo ?? null,
      anio: seleccionSolicitada.anio ?? null,
      signal,
    }),
    // Sin filtros, cada endpoint devuelve su último corte con observaciones.
    fetchInstituciones({
      periodo: seleccionSolicitada.periodoInstitucional ?? null,
      trimestre: seleccionSolicitada.trimestreInstitucional ?? null,
      claveSeis: seleccionSolicitada.claveSeis ?? null,
      anio: seleccionSolicitada.anioInstitucional ?? null,
      limite: limiteValido(seleccionSolicitada.limiteInstituciones),
      signal,
    }),
    fetchFonacot({ signal }),
    fetchSniiv({ signal }),
    fetchFuentes({ signal }),
    fetchHealth({ signal }),
    // Catálogos de períodos con observaciones, uno por fuente.
    fetchPeriodos({ fuente: 'cnbv_sectorial', signal }),
    fetchPeriodos({ fuente: 'cnbv_institucional', signal }),
    fetchPeriodos({ fuente: 'fonacot', signal }),
    fetchPeriodos({ fuente: 'sniiv', signal }),
    // Catálogo completo de cooperativas, independiente del ranking.
    fetchCatalogoInstituciones({ signal }),
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
  ['instituciones', 'fonacot', 'sniiv', 'fuentes', 'health', 'catalogoInstituciones'].forEach(
    (clave) => {
      const resultado = faseCatalogos[INDICES[clave]];
      if (resultado.status === 'rejected') errores[clave] = mensajeError(resultado.reason);
    },
  );
  const fallosPeriodos = [
    'periodosSectorial',
    'periodosInstitucional',
    'periodosFonacot',
    'periodosSniiv',
  ]
    .filter((clave) => faseCatalogos[INDICES[clave]].status === 'rejected')
    .map((clave) => mensajeError(faseCatalogos[INDICES[clave]].reason));
  if (fallosPeriodos.length) errores.periodos = fallosPeriodos.join('; ');

  const dashboard = valor('dashboard');
  const instituciones = valor('instituciones');
  const fonacotCatalogo = valor('fonacot');
  const sniivCatalogo = valor('sniiv');
  const fuentes = valor('fuentes');
  const health = valor('health');
  const periodos = {
    cnbv_sectorial: valor('periodosSectorial'),
    cnbv_institucional: valor('periodosInstitucional'),
    fonacot: valor('periodosFonacot'),
    sniiv: valor('periodosSniiv'),
  };
  const catalogoInstituciones = valor('catalogoInstituciones');

  const seleccion = construirSeleccionInicial(
    { dashboard, instituciones, fonacot: fonacotCatalogo, sniiv: sniivCatalogo },
    seleccionSolicitada,
    periodos,
  );

  const sector = sectorSlice(dashboard, seleccion);
  const institucional = institucionesSlice(instituciones, seleccion);
  const fonacot = fonacotSlice(fonacotCatalogo, seleccion);
  const sniiv = sniivSlice(sniivCatalogo, seleccion);

  const seleccionFinal = {
    ...seleccion,
    periodo: sector.periodo,
    corteInstitucional: institucional.corteInstituciones,
    trimestreInstitucional: institucional.trimestreInstituciones,
    trimestreFonacot: fonacot.trimestreFonacot,
    anioFonacot: fonacot.anioFonacot,
    anioSniiv: sniiv.anioSniiv,
  };

  return {
    ...sector,
    ...institucional,
    ...fonacot,
    ...sniiv,
    catalogos: construirCatalogos({
      dashboard,
      instituciones,
      fonacot: fonacotCatalogo,
      sniiv: sniivCatalogo,
      periodos,
      catalogoInstituciones,
    }),
    fuentes: construirResumenFuentes(fuentes),
    estadoApi: health
      ? {
          status: health.status ?? null,
          database: health.database ?? null,
          detail: health.detail ?? null,
        }
      : null,
    seleccion: seleccionFinal,
    errores,
  };
}

export default loadDashboardData;
