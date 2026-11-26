/**
 * Formateadores de presentación. Ninguno imputa ceros: los valores ausentes
 * (null, undefined, cadena vacía o no numérico) se muestran como "No disponible".
 * Los decimales del contrato llegan como cadena y se convierten solo para mostrar u ordenar.
 */

const NO_DISPONIBLE = 'No disponible';

export const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : null;
};

export const formatNoDisponible = () => NO_DISPONIBLE;

export const formatCurrencyFull = (value) => {
  const numero = toNumberOrNull(value);
  if (numero === null) return NO_DISPONIBLE;
  return '$ ' + numero.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

export const formatMillionsAxis = (value) => {
  const numero = toNumberOrNull(value);
  if (numero === null) return NO_DISPONIBLE;
  return `$${(numero / 1000000).toFixed(1)} M`;
};

export const formatCompactCurrency = (value) => {
  const numero = toNumberOrNull(value);
  if (numero === null) return NO_DISPONIBLE;
  const magnitud = Math.abs(numero);
  if (magnitud >= 1000000000) {
    return `$${(numero / 1000000).toLocaleString('en-US', { maximumFractionDigits: 1 })} M MXN`;
  }
  if (magnitud >= 1000000) {
    return `$${(numero / 1000000).toFixed(1)} M MXN`;
  }
  if (magnitud >= 1000) {
    return `$${(numero / 1000).toFixed(1)} mil MXN`;
  }
  return `$${numero.toLocaleString('en-US', { maximumFractionDigits: 0 })} MXN`;
};

export const formatPercent = (value, decimales = 2) => {
  const numero = toNumberOrNull(value);
  if (numero === null) return NO_DISPONIBLE;
  return `${numero.toFixed(decimales)} %`;
};

/**
 * Devuelve solo la cifra porcentual, sin el símbolo `%`.
 * Se usa en tarjetas donde la unidad (%, % anual) la aporta el metadato
 * del indicador para que aparezca una sola vez.
 */
export const formatPercentNumber = (value, decimales = 2) => {
  const numero = toNumberOrNull(value);
  if (numero === null) return NO_DISPONIBLE;
  return numero.toFixed(decimales);
};

export const formatInteger = (value) => {
  const numero = toNumberOrNull(value);
  if (numero === null) return NO_DISPONIBLE;
  return numero.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const MESES_CORTOS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

const parsearPeriodo = (periodoYm) => {
  if (typeof periodoYm !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodoYm)) return null;
  const [anio, mes] = periodoYm.split('-');
  return { anio, mes: Number(mes) };
};

export const formatMonth = (periodoYm) => {
  const periodo = parsearPeriodo(periodoYm);
  return periodo ? `${MESES[periodo.mes - 1]} ${periodo.anio}` : NO_DISPONIBLE;
};

export const formatMonthShort = (periodoYm) => {
  const periodo = parsearPeriodo(periodoYm);
  return periodo ? `${MESES_CORTOS[periodo.mes - 1]} ${periodo.anio.slice(2)}` : NO_DISPONIBLE;
};

export const formatQuarter = (trimestre) => {
  if (typeof trimestre !== 'string' || !/^\d{4}-Q[1-4]$/.test(trimestre)) return NO_DISPONIBLE;
  const [anio, trimestreNumero] = trimestre.split('-');
  return `${trimestreNumero[1]}T ${anio}`;
};

export const formatYear = (anio) => {
  const numero = toNumberOrNull(anio);
  return numero === null ? NO_DISPONIBLE : String(numero);
};
