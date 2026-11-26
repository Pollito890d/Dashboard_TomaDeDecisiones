import { useMemo } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { formatCurrencyFull } from '../../utils/formatters';

export default function OverdueInstallmentsTable({
  cuotasVencidas,
  sucursalId,
  tableViewMode,
  setTableViewMode,
  sortBy,
  setSortBy,
  selectedTipoFilter,
  setSelectedTipoFilter,
}) {
  const sortedAndFilteredCuotas = useMemo(() => {
    let list = [...cuotasVencidas];

    if (selectedTipoFilter) {
      list = list.filter((item) => item.tipo_prestamo === selectedTipoFilter);
    }

    if (tableViewMode === 'wireframe' && sucursalId === 'ALL' && !selectedTipoFilter) {
      list = list.slice(0, 3);
    }

    if (sortBy === 'dias_desc') {
      list.sort((a, b) => b.dias_atraso - a.dias_atraso || b.saldo_pendiente - a.saldo_pendiente);
    } else if (sortBy === 'monto_desc') {
      list.sort((a, b) => b.saldo_pendiente - a.saldo_pendiente || b.dias_atraso - a.dias_atraso);
    }

    return list;
  }, [cuotasVencidas, tableViewMode, sortBy, sucursalId, selectedTipoFilter]);

  return (
    <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 flex-1 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">
              Préstamos con cuotas vencidas
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Orden sugerido: mayor atraso y saldo pendiente
            </p>
          </div>

          {/* Controles ligeros para alternar entre las 3 filas del wireframe o los Top 10 socios */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (sortBy === 'wireframe_order') {
                  setSortBy('dias_desc');
                  setTableViewMode('top10');
                } else if (sortBy === 'dias_desc') {
                  setSortBy('monto_desc');
                } else {
                  setSortBy('wireframe_order');
                  setTableViewMode('wireframe');
                }
              }}
              title="Cambiar criterio de ordenamiento (Vista Wireframe / Mayor Atraso / Mayor Saldo)"
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition"
            >
              <ArrowUpDown className="w-3 h-3 text-slate-500" />
              <span>
                {sortBy === 'wireframe_order'
                  ? 'Wireframe'
                  : sortBy === 'dias_desc'
                  ? 'Por Días'
                  : 'Por Monto'}
              </span>
            </button>
          </div>
        </div>

        {/* Tabla de préstamos con cuotas vencidas */}
        <div className="overflow-x-auto max-h-[245px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs text-[11px] font-bold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2 px-2.5 rounded-tl">Socio</th>
                <th className="py-2 px-2.5">Vencimiento</th>
                <th className="py-2 px-2.5 text-right">Pendiente</th>
                <th className="py-2 px-2.5 text-right rounded-tr">Días</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {sortedAndFilteredCuotas.map((row) => (
                <tr
                  key={row.id_cuota}
                  className="hover:bg-slate-50/90 transition-colors group"
                  title={`${row.nombre_socio} · Préstamo ${row.tipo_prestamo} (Cuota ${row.num_cuota}) · Tel: ${row.telefono}`}
                >
                  <td className="py-2.5 px-2.5 font-medium text-slate-800">
                    <div>{row.codigo_socio}</div>
                    {tableViewMode === 'top10' && (
                      <div className="text-[10px] text-slate-400 truncate max-w-[125px]">
                        {row.nombre_socio} · {row.tipo_prestamo}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-2.5 text-slate-600 font-medium">
                    {row.fecha_vencimiento}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-bold text-slate-800">
                    {formatCurrencyFull(row.saldo_pendiente)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-extrabold text-[#D95D2E]">
                    {row.dias_atraso}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pie de la tabla con acción rápida para ver los 10 socios de cobranza prioritaria */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
        <span className="text-slate-500">
          Mostrando <strong>{sortedAndFilteredCuotas.length}</strong> de{' '}
          <strong>{cuotasVencidas.length}</strong> casos prioritarios
        </span>
        {sucursalId === 'ALL' && !selectedTipoFilter && (
          <button
            type="button"
            onClick={() => {
              const nextMode = tableViewMode === 'wireframe' ? 'top10' : 'wireframe';
              setTableViewMode(nextMode);
              if (nextMode === 'wireframe') {
                setSortBy('wireframe_order');
              }
            }}
            className="font-semibold text-[#0E7C7B] hover:underline"
          >
            {tableViewMode === 'wireframe'
              ? 'Ver Top 10 socios en mora →'
              : '← Volver a vista Wireframe (3)'}
          </button>
        )}
      </div>
    </div>
  );
}
