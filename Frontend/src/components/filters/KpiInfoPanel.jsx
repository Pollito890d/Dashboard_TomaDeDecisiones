import { Database } from 'lucide-react';
import {
  INDICADORES_SECTORIALES,
  METRICAS_COMPLEMENTARIAS,
} from '../../constants/dashboardIndicators';

/** Catálogo oficial: 9 KPIs sectoriales + 4 métricas complementarias. */
export default function KpiInfoPanel({ open, onClose }) {
  if (!open) return null;

  const indicadores = [...INDICADORES_SECTORIALES, ...METRICAS_COMPLEMENTARIAS];

  return (
    <div className="mt-4 bg-white border border-slate-200 rounded-md p-4 shadow-xs text-xs text-slate-700">
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#0E7C7B]" />
          <span className="font-bold text-slate-900">
            Catálogo de 13 indicadores (KPI-01 a KPI-09 · M-01 a M-04)
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 font-semibold"
        >
          Cerrar ✕
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {indicadores.map((indicador) => (
          <div key={indicador.id} className="p-2.5 rounded bg-slate-50 border border-slate-100">
            <span className="font-bold text-[#0E7C7B]">
              {indicador.id} · {indicador.nombre}:
            </span>
            <p className="text-[11px] text-slate-600 mt-0.5">
              <code>{indicador.formula}</code>. Unidad: {indicador.unidad}. {indicador.descripcion}
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">{indicador.interpretacion}</p>
            <p className="text-[10px] text-slate-400 mt-1">Fuente: {indicador.fuente}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
