import { RefreshCw } from 'lucide-react';

/** Reintento local de una sección, sin recargar la página ni las demás fuentes. */
export default function BotonReintento({ onClick, etiqueta = 'Reintentar' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B]"
    >
      <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
      {etiqueta}
    </button>
  );
}
