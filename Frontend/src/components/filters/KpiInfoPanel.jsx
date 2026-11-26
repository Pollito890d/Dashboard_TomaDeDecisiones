import { X } from 'lucide-react';
import {
  INDICADORES_SECTORIALES,
  METRICAS_COMPLEMENTARIAS,
} from '../../constants/dashboardIndicators';

/** Guía modal del catálogo oficial: definiciones visibles, cálculo en detalle. */
const GRUPOS = [
  { titulo: 'Situación y riesgos del sector', items: INDICADORES_SECTORIALES.slice(0, 4) },
  { titulo: 'Rentabilidad y eficiencia', items: INDICADORES_SECTORIALES.slice(4) },
  { titulo: 'Métricas complementarias y contextos', items: METRICAS_COMPLEMENTARIAS },
];

export default function KpiInfoPanel({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl rounded-lg border border-slate-200 bg-white p-4 shadow-xl sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-guia"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 id="titulo-guia" className="text-sm font-bold text-slate-900">
              Guía de indicadores
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Definiciones del catálogo oficial. Las cifras se consultan en tiempo real.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar guía de indicadores"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {GRUPOS.map((grupo) => (
            <section key={grupo.titulo} aria-label={grupo.titulo}>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {grupo.titulo}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {grupo.items.map((indicador) => (
                  <div key={indicador.id} className="p-2.5 rounded bg-slate-50 border border-slate-100">
                    <div className="text-[11px] font-bold text-[#0E7C7B]">
                      {indicador.nombreCorto ?? indicador.nombre}
                    </div>
                    {indicador.mide && (
                      <p className="text-[11px] text-slate-600 mt-1">Mide: {indicador.mide}</p>
                    )}
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Lectura: {indicador.lectura ?? indicador.interpretacion}
                    </p>
                    {indicador.evalua && (
                      <p className="text-[11px] text-slate-600 mt-0.5">Evalúa: {indicador.evalua}</p>
                    )}
                    {!indicador.mide && (
                      <p className="text-[11px] text-slate-600 mt-0.5">{indicador.descripcion}</p>
                    )}
                    <details className="mt-1.5 text-[10px] text-slate-400">
                      <summary className="cursor-pointer font-semibold">Detalle técnico</summary>
                      <p className="mt-1"><code>{indicador.formula}</code> · Unidad: {indicador.unidad}</p>
                      <p className="mt-0.5">{indicador.interpretacion}</p>
                      <p className="mt-0.5">Fuente: {indicador.fuente}</p>
                    </details>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
