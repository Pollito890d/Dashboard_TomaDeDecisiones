import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import CustomLineTooltip from './CustomLineTooltip';
import { COLORS } from '../../constants/dashboardTheme';
import { formatMillionsAxis } from '../../utils/formatters';

export default function TrendLineChart({ evolucionSemanal, sucursalId }) {
  return (
    <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div>
          <h3 className="text-[15px] font-bold text-slate-900">
            Evolución semanal de liquidez frente a obligaciones
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Comparación de montos disponibles y compromisos por cubrir
          </p>
        </div>

        {/* Leyenda limpia idéntica al wireframe */}
        <div className="flex items-center gap-5 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-2 rounded-xs inline-block"
              style={{ backgroundColor: COLORS.teal }}
            />
            <span>Liquidez</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-2 rounded-xs inline-block"
              style={{ backgroundColor: COLORS.orangeRed }}
            />
            <span>Obligaciones</span>
          </div>
        </div>
      </div>

      {/* Gráfico de líneas: solo líneas guía horizontales tenues, sin verticales (Sección 6 UX) */}
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={evolucionSemanal}
            margin={{ top: 10, right: 24, left: 4, bottom: 4 }}
          >
            <CartesianGrid
              horizontal={true}
              vertical={false}
              stroke="#E2E8F0"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="semana"
              axisLine={{ stroke: '#E2E8F0' }}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 11, fontWeight: 500 }}
              dy={8}
            />
            <YAxis
              domain={
                sucursalId === 'ALL'
                  ? [800000, 1400000]
                  : ['auto', 'auto']
              }
              ticks={
                sucursalId === 'ALL'
                  ? [800000, 1000000, 1200000, 1400000]
                  : undefined
              }
              tickFormatter={formatMillionsAxis}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 11, fontWeight: 500 }}
              width={52}
            />
            <Tooltip content={<CustomLineTooltip />} />
            <Line
              type="linear"
              dataKey="liquidez"
              name="Liquidez"
              stroke={COLORS.teal}
              strokeWidth={2.5}
              dot={{ r: 3, fill: COLORS.teal, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: COLORS.teal, stroke: '#fff', strokeWidth: 2 }}
            />
            <Line
              type="linear"
              dataKey="obligaciones"
              name="Obligaciones"
              stroke={COLORS.orangeRed}
              strokeWidth={2.5}
              dot={{ r: 3, fill: COLORS.orangeRed, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: COLORS.orangeRed, stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
