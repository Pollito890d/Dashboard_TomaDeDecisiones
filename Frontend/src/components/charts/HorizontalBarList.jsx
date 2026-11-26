import { formatCurrencyFull } from '../../utils/formatters';

/**
 * Las dos visualizaciones de barras horizontales se agrupan en un solo archivo
 * porque comparten técnica de render, pero se exportan por separado para no
 * introducir condicionales que alteren su marcado o sus anchos mínimos.
 */

export function StateLoanBars({ prestamosPorEstado }) {
  const maxConteoEstado = Math.max(...prestamosPorEstado.map((d) => d.conteo), 1);

  return (
    <div>
      <h4 className="text-xs font-medium text-slate-500 mb-3.5">
        Préstamos por estado
      </h4>
      <div className="space-y-4">
        {prestamosPorEstado.map((item) => {
          const widthPct = Math.round((item.conteo / maxConteoEstado) * 100);
          return (
            <div key={item.estado} className="group">
              <div className="flex items-center gap-3">
                <span className="w-20 text-xs font-medium text-slate-600 shrink-0">
                  {item.estado}
                </span>
                <div className="flex-1 flex items-center gap-2.5">
                  <div
                    className="h-3.5 rounded-sm transition-all duration-300"
                    style={{
                      width: `${Math.max(widthPct, 12)}%`,
                      backgroundColor: item.color,
                    }}
                    title={`${item.estado}: ${item.conteo} préstamos (${formatCurrencyFull(item.capital)})`}
                  />
                  <span
                    className={`text-xs font-bold ${
                      item.tipo_alerta === 'riesgo'
                        ? 'text-[#D95D2E]'
                        : 'text-slate-700'
                    }`}
                  >
                    {item.conteo}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OverdueTypeBars({
  carteraVencidaPorTipo,
  selectedTipoFilter,
  onSelectTipo,
}) {
  const maxMontoTipo = Math.max(...carteraVencidaPorTipo.map((d) => d.monto), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-3.5">
        <h4 className="text-xs font-medium text-slate-500">
          Cartera vencida por tipo
        </h4>
        <span className="text-[10px] text-slate-400">
          Clic para filtrar tabla
        </span>
      </div>
      <div className="space-y-4">
        {carteraVencidaPorTipo.map((item) => {
          const widthPct = Math.round((item.monto / maxMontoTipo) * 100);
          const isSelected = selectedTipoFilter === item.tipo;
          return (
            <button
              key={item.tipo}
              type="button"
              onClick={() => onSelectTipo(isSelected ? null : item.tipo)}
              className={`w-full text-left group rounded px-1 -mx-1 py-0.5 transition ${
                isSelected ? 'bg-orange-50/70 ring-1 ring-[#D95D2E]/30' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-20 text-xs font-medium text-slate-600 shrink-0">
                  {item.tipo}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  <div
                    className="h-3.5 rounded-sm transition-all duration-300"
                    style={{
                      width: `${Math.max(widthPct, 16)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                  <span
                    className={`text-[11px] font-bold whitespace-nowrap ${
                      item.tipo_alerta === 'riesgo'
                        ? 'text-[#D95D2E]'
                        : 'text-slate-700'
                    }`}
                  >
                    ${(item.monto / 1000).toFixed(1)}k
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
