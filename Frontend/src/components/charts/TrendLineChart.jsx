import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import CustomLineTooltip from './CustomLineTooltip';
import { COLORS } from '../../constants/dashboardTheme';
import { formatMonth, formatMonthShort, formatPercent, toNumberOrNull } from '../../utils/formatters';
import EstadoSeccion from '../layout/EstadoSeccion';

/** Un indicador por gráfica: evita que escalas distintas oculten las variaciones. */
export const SERIES_INDICADORES = [
  { campo: 'kpi01_imor_pct', nombre: 'Morosidad (IMOR)', color: COLORS.orangeRed },
  { campo: 'kpi02_icor_pct', nombre: 'Cobertura (ICOR)', color: COLORS.teal },
  { campo: 'kpi03_liquidez_pct', nombre: 'Liquidez', color: COLORS.amber },
  { campo: 'kpi04_nicap_pct', nombre: 'Capitalización (NICAP)', color: COLORS.teal },
  { campo: 'kpi05_tasa_activa_pct', nombre: 'Tasa activa', color: COLORS.tealLight },
  { campo: 'kpi06_tasa_pasiva_pct', nombre: 'Tasa pasiva', color: COLORS.slateMuted },
  { campo: 'kpi07_capital_activo_pct', nombre: 'Capital / activo', color: COLORS.teal },
  { campo: 'kpi08_roa_pct', nombre: 'ROA', color: COLORS.amber },
  { campo: 'kpi09_colocacion_captacion_trad_pct', nombre: 'Colocación / captación', color: COLORS.tealLight },
];

const ejeX = {
  dataKey: 'periodo_ym',
  axisLine: { stroke: '#E2E8F0' },
  tickLine: false,
  tick: { fill: '#64748B', fontSize: 11, fontWeight: 500 },
  tickFormatter: formatMonthShort,
  dy: 8,
};

const ejeYBase = {
  axisLine: false,
  tickLine: false,
  tick: { fill: '#64748B', fontSize: 11, fontWeight: 500 },
};

/** Los decimales del eje se ajustan al rango real de la serie mostrada. */
const decimalesDelEje = (rango) => {
  if (rango < 0.1) return 3;
  if (rango < 1) return 2;
  if (rango < 5) return 1;
  return 0;
};

const maximoConExtras = (valores, incluir) =>
  Math.max(...valores, ...incluir.filter((valor) => Number.isFinite(valor)));

/**
 * Dominio calculado con los valores reales de la serie. NICAP inicia en cero
 * para conservar visible su umbral regulatorio; el resto se ajusta al rango.
 */
const dominioDelEje = (valores, { desdeCero = false, incluir = [] } = {}) => {
  if (!valores.length) return { dominio: [0, 'auto'], decimales: 0 };

  const minimo = Math.min(...valores);
  const maximo = maximoConExtras(valores, incluir);
  const rango = maximo - minimo;
  const margen = rango > 0 ? rango * 0.12 : Math.max(Math.abs(minimo) * 0.05, 0.1);
  const inferiorCalculado = desdeCero ? 0 : minimo - margen;
  const inferior = minimo >= 0 ? Math.max(0, inferiorCalculado) : inferiorCalculado;

  return {
    dominio: [inferior, maximo + margen],
    decimales: decimalesDelEje(rango),
  };
};

function SinSerie({ periodo }) {
  return (
    <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 text-xs text-slate-500">
      El corte {formatMonth(periodo)} no tiene observaciones mensuales; no se conectan períodos sin datos.
    </div>
  );
}

/** Evolución mensual de un indicador sectorial seleccionable. */
export default function TrendLineChart({
  serieAnual,
  periodo,
  fuente,
  loading,
  error,
  onReintentar,
  campo = null,
  onCampoChange = null,
  bandaNicap = null,
}) {
  const [campoInterno, setCampoInterno] = useState(SERIES_INDICADORES[0].campo);
  const campoActivo = campo ?? campoInterno;
  const seleccionar = (valor) => {
    if (onCampoChange) onCampoChange(valor);
    else setCampoInterno(valor);
  };
  const serie = SERIES_INDICADORES.find((item) => item.campo === campoActivo) ?? SERIES_INDICADORES[0];
  const umbral = toNumberOrNull(bandaNicap?.umbral_regulatorio_min_pct);
  const esNicap = serie.campo === 'kpi04_nicap_pct';
  const valores = (serieAnual ?? [])
    .map((fila) => toNumberOrNull(fila?.[serie.campo]))
    .filter((valor) => valor !== null);
  const { dominio, decimales } = dominioDelEje(valores, {
    desdeCero: esNicap,
    incluir: esNicap && umbral !== null ? [umbral] : [],
  });
  const primero = serieAnual?.[0]?.periodo_ym;
  const ultimo = serieAnual?.at(-1)?.periodo_ym;

  return (
    <EstadoSeccion
      cargando={loading}
      error={error}
      onReintentar={onReintentar}
      mensajeCarga="Consultando la serie mensual del sector…"
    >
      {!serieAnual?.length ? (
        <SinSerie periodo={periodo} />
      ) : (
        <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Evolución de {serie.nombre}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Compara el indicador mes a mes en el sector SOCAP ·{' '}
                {formatMonth(primero)} – {formatMonth(ultimo)}
              </p>
            </div>
            <div className="shrink-0">
              <label htmlFor="selector-indicador" className="mb-1 block text-[10px] font-semibold text-slate-500">
                Indicador
              </label>
              <select
                id="selector-indicador"
                value={serie.campo}
                onChange={(evento) => seleccionar(evento.target.value)}
                className="appearance-none bg-white border border-slate-200 text-xs font-semibold text-slate-700 rounded-md px-2.5 py-1.5 shadow-2xs hover:border-teal-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B]"
              >
                {SERIES_INDICADORES.map((item) => (
                  <option key={item.campo} value={item.campo}>{item.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serieAnual} margin={{ top: 10, right: 24, left: 4, bottom: 4 }}>
                <CartesianGrid horizontal={true} vertical={false} stroke="#E2E8F0" strokeDasharray="0" />
                <XAxis {...ejeX} />
                <YAxis
                  {...ejeYBase}
                  domain={dominio}
                  tickFormatter={(valor) => formatPercent(valor, decimales)}
                  width={decimales >= 2 ? 62 : 52}
                />
                <Tooltip
                  content={
                    <CustomLineTooltip
                      fuente={fuente}
                      decimales={Math.max(2, decimales)}
                    />
                  }
                />
                {esNicap && umbral !== null && (
                  <ReferenceLine
                    y={umbral}
                    stroke={COLORS.orangeRed}
                    strokeDasharray="4 4"
                    label={{
                      value: `Umbral regulatorio > ${formatPercent(umbral, decimales)}`,
                      fill: COLORS.orangeRed,
                      fontSize: 10,
                      position: 'insideTopRight',
                    }}
                  />
                )}
                <Line
                  type="linear"
                  dataKey={serie.campo}
                  name={serie.nombre}
                  stroke={serie.color}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: serie.color, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: serie.color, stroke: '#fff', strokeWidth: 2 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </EstadoSeccion>
  );
}
