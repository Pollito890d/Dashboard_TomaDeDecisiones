import { COLORS } from '../../constants/dashboardTheme';
import { formatPercent, formatMonth } from '../../utils/formatters';

/**
 * Tooltip de las tendencias mensuales oficiales. Todas las series comparten
 * unidad porcentual; los valores nulos se muestran como "No disponible".
 * El eje puede recortarse, pero aquí se conserva la precisión disponible.
 */
export default function CustomLineTooltip({ active, payload, label, fuente, decimales = 2 }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-lg p-3.5 text-xs min-w-[230px]">
      <div className="border-b border-slate-100 pb-1.5 mb-2">
        <span className="font-bold text-slate-800">{formatMonth(label)}</span>
      </div>
      <div className="space-y-1.5">
        {payload.map((entrada) => (
          <div key={entrada.dataKey} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-600 font-medium">
              <span
                className="w-2.5 h-2.5 rounded-sm inline-block"
                style={{ backgroundColor: entrada.color || COLORS.teal }}
              />
              {entrada.name}:
            </span>
            <span className="font-bold text-slate-900">{formatPercent(entrada.value, decimales)}</span>
          </div>
        ))}
      </div>
      {fuente && (
        <div className="pt-1.5 mt-1.5 border-t border-slate-100 text-[10px] text-slate-400">
          Fuente: {fuente}
        </div>
      )}
    </div>
  );
}
