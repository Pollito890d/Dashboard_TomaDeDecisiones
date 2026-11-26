import { COLORS } from '../../constants/dashboardTheme';
import { formatCurrencyFull } from '../../utils/formatters';

/**
 * Tooltip personalizado para el Gráfico Central (Nivel 2: Evolución Semanal)
 */
export default function CustomLineTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const liq = payload.find((p) => p.dataKey === 'liquidez')?.value || 0;
  const obl = payload.find((p) => p.dataKey === 'obligaciones')?.value || 0;
  const brecha = liq - obl;
  const razon = obl > 0 ? ((liq / obl) * 100).toFixed(1) : '100.0';
  const fechaCorte = payload[0]?.payload?.fecha_corte;

  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-lg p-3.5 text-xs min-w-[230px]">
      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
        <span className="font-bold text-slate-800">Semana {label}</span>
        {fechaCorte && (
          <span className="text-[11px] text-slate-400">Corte: {fechaCorte}</span>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: COLORS.teal }} />
            Liquidez disponible:
          </span>
          <span className="font-bold text-slate-900">{formatCurrencyFull(liq)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: COLORS.orangeRed }} />
            Obligaciones C.P.:
          </span>
          <span className="font-bold text-slate-900">{formatCurrencyFull(obl)}</span>
        </div>
        <div className="pt-1.5 mt-1.5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-slate-500">Margen / Razón:</span>
          <span className="font-semibold text-[#0E7C7B]">
            +{formatCurrencyFull(brecha)} ({razon}%)
          </span>
        </div>
      </div>
    </div>
  );
}
