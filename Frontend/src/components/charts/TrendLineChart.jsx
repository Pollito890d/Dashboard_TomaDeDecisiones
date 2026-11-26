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
import { formatMonthShort, formatPercent, toNumberOrNull } from '../../utils/formatters';

const ejeX = {
  dataKey: 'periodo_ym',
  axisLine: { stroke: '#E2E8F0' },
  tickLine: false,
  tick: { fill: '#64748B', fontSize: 11, fontWeight: 500 },
  tickFormatter: formatMonthShort,
  dy: 8,
};

const ejeYPorcentaje = {
  domain: ['auto', 'auto'],
  tickFormatter: (valor) => formatPercent(valor, 0),
  axisLine: false,
  tickLine: false,
  tick: { fill: '#64748B', fontSize: 11, fontWeight: 500 },
  width: 52,
};

/**
 * NICAP se lee frente a un umbral normativo de 100 %. El dominio debe iniciar
 * en 0 para que esa referencia sea visible aunque las observaciones estén
 * cerca de 300 %; no se modifican los datos reales.
 */
const ejeYNicap = {
  ...ejeYPorcentaje,
  domain: [0, 'auto'],
};

function Leyenda({ series }) {
  return (
    <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-slate-600">
      {series.map((serie) => (
        <div key={serie.dataKey} className="flex items-center gap-2">
          <span
            className="w-3 h-2 rounded-xs inline-block"
            style={{ backgroundColor: serie.color }}
          />
          <span>{serie.nombre}</span>
        </div>
      ))}
    </div>
  );
}

function SinSerie({ periodo }) {
  return (
    <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 text-xs text-slate-500">
      No hay observaciones mensuales para el corte {periodo}. No se conectan períodos sin datos.
    </div>
  );
}

/** Tendencia mensual de morosidad, cobertura y liquidez (todas en %, CNBV Series). */
export default function TrendLineChart({ serieAnual, periodo, fuente }) {
  if (!serieAnual?.length) return <SinSerie periodo={periodo} />;

  const series = [
    { dataKey: 'kpi01_imor_pct', nombre: 'IMOR', color: COLORS.orangeRed },
    { dataKey: 'kpi02_icor_pct', nombre: 'ICOR', color: COLORS.teal },
    { dataKey: 'kpi03_liquidez_pct', nombre: 'Liquidez', color: COLORS.amber },
  ];

  return (
    <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h3 className="text-[15px] font-bold text-slate-900">
            Evolución mensual de morosidad, cobertura y liquidez
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            12 cortes mensuales del sector SOCAP · unidad: porcentaje
          </p>
        </div>
        <Leyenda series={series} />
      </div>

      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serieAnual} margin={{ top: 10, right: 24, left: 4, bottom: 4 }}>
            <CartesianGrid horizontal={true} vertical={false} stroke="#E2E8F0" strokeDasharray="0" />
            <XAxis {...ejeX} />
            <YAxis {...ejeYPorcentaje} />
            <Tooltip content={<CustomLineTooltip fuente={fuente} />} />
            {series.map((serie) => (
              <Line
                key={serie.dataKey}
                type="linear"
                dataKey={serie.dataKey}
                name={serie.nombre}
                stroke={serie.color}
                strokeWidth={2.5}
                dot={{ r: 3, fill: serie.color, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: serie.color, stroke: '#fff', strokeWidth: 2 }}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Capitalización sectorial frente al único umbral regulatorio documentado. */
export function NicapTrendChart({ serieAnual, periodo, fuente, bandaNicap }) {
  if (!serieAnual?.length) return <SinSerie periodo={periodo} />;

  const umbral = toNumberOrNull(bandaNicap?.umbral_regulatorio_min_pct);

  return (
    <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h3 className="text-[15px] font-bold text-slate-900">
            Nivel de capitalización (NICAP) del sector
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Capital neto / requerimiento por riesgos · unidad: porcentaje
          </p>
        </div>
        <Leyenda
          series={[
            { dataKey: 'kpi04_nicap_pct', nombre: 'NICAP', color: COLORS.teal },
            ...(umbral !== null
              ? [{
                  dataKey: 'umbral',
                  nombre: `Umbral regulatorio (> ${formatPercent(umbral, 0)})`,
                  color: COLORS.orangeRed,
                }]
              : []),
          ]}
        />
      </div>

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serieAnual} margin={{ top: 10, right: 24, left: 4, bottom: 4 }}>
            <CartesianGrid horizontal={true} vertical={false} stroke="#E2E8F0" strokeDasharray="0" />
            <XAxis {...ejeX} />
            <YAxis {...ejeYNicap} />
            <Tooltip content={<CustomLineTooltip fuente={fuente} />} />
            {umbral !== null && (
              <ReferenceLine
                y={umbral}
                stroke={COLORS.orangeRed}
                strokeDasharray="4 4"
                label={{ value: `Umbral > ${formatPercent(umbral, 0)}`, fill: COLORS.orangeRed, fontSize: 10, position: 'insideTopRight' }}
              />
            )}
            <Line
              type="linear"
              dataKey="kpi04_nicap_pct"
              name="NICAP"
              stroke={COLORS.teal}
              strokeWidth={2.5}
              dot={{ r: 3, fill: COLORS.teal, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: COLORS.teal, stroke: '#fff', strokeWidth: 2 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
