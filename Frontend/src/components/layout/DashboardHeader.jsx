import { Info } from 'lucide-react';
import DashboardTabs from './DashboardTabs';
import { formatMonth } from '../../utils/formatters';

/** Identidad, estado general, pestañas y acceso a la guía; sin filtros aquí. */
export default function DashboardHeader({ tabActiva, onCambiarTab, onAbrirGuia, corte }) {
  return (
    <header className="pb-4 border-b border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Caja de Ahorro y Préstamo
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tablero gerencial con información oficial del sector y sus contextos externos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {corte && (
            <span className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 rounded-md px-2.5 py-1.5">
              Corte sectorial: {formatMonth(corte)}
            </span>
          )}
          <button
            type="button"
            onClick={onAbrirGuia}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B]"
          >
            <Info className="w-3.5 h-3.5" aria-hidden="true" />
            Guía de indicadores
          </button>
        </div>
      </div>

      <div className="mt-4">
        <DashboardTabs activa={tabActiva} onChange={onCambiarTab} />
      </div>
    </header>
  );
}
