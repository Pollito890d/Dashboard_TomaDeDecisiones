import { ChevronDown, Info } from 'lucide-react';
import { formatMonth, formatQuarter } from '../../utils/formatters';

/**
 * Los cortes son fijos durante el paso 24. Los selectores se muestran
 * deshabilitados y etiquetados como tales; la interactividad llega en el paso 26.
 */
export default function FilterBar({
  periodo,
  trimestre,
  limite,
  showContextModal,
  setShowContextModal,
}) {
  const claseSelect =
    'appearance-none bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-md pl-3.5 pr-8 py-2 shadow-2xs opacity-70 cursor-not-allowed';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <label htmlFor="select-periodo" className="sr-only">Período oficial</label>
        <select
          id="select-periodo"
          disabled
          value={periodo ?? ''}
          className={claseSelect}
          title="Corte sectorial fijo del paso 24; selector interactivo en el paso 26"
        >
          <option value={periodo ?? ''}>{formatMonth(periodo)}</option>
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      <div className="relative">
        <label htmlFor="select-instituciones" className="sr-only">Instituciones</label>
        <select
          id="select-instituciones"
          disabled
          value={trimestre ?? ''}
          className={claseSelect}
          title="Comparativa institucional fija del paso 24; selector interactivo en el paso 26"
        >
          <option value={trimestre ?? ''}>
            {formatQuarter(trimestre)} · {limite} cooperativas
          </option>
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      <button
        type="button"
        onClick={() => setShowContextModal(!showContextModal)}
        title="Ver catálogo de indicadores oficiales"
        className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-semibold border transition ${
          showContextModal
            ? 'bg-slate-800 text-white border-slate-800'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        }`}
      >
        <Info className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">Ficha de indicadores (13)</span>
      </button>

      <span className="text-[10px] text-slate-400 w-full sm:w-auto">
        Cortes fijos de comprobación · filtros interactivos en el paso 26
      </span>
    </div>
  );
}
