import { ChevronDown, Info } from 'lucide-react';
import { SUCURSALES, PERIODOS } from '../../data/mockDashboardData';

export default function FilterBar({
  periodoId,
  setPeriodoId,
  sucursalId,
  setSucursalId,
  setTableViewMode,
  showContextModal,
  setShowContextModal,
}) {
  return (
    /* Dos filtros globales únicos (Interactividad Proporcional - Sección 6) */
    <div className="flex flex-wrap items-center gap-3">
      {/* Filtro 1: Período */}
      <div className="relative">
        <label htmlFor="select-periodo" className="sr-only">Período</label>
        <select
          id="select-periodo"
          value={periodoId}
          onChange={(e) => setPeriodoId(e.target.value)}
          className="appearance-none bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-md pl-3.5 pr-8 py-2 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/20 focus:border-[#0E7C7B] cursor-pointer transition"
        >
          {PERIODOS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Filtro 2: Sucursal */}
      <div className="relative">
        <label htmlFor="select-sucursal" className="sr-only">Sucursal</label>
        <select
          id="select-sucursal"
          value={sucursalId}
          onChange={(e) => {
            setSucursalId(e.target.value);
            if (e.target.value !== 'ALL') {
              setTableViewMode('top10');
            } else {
              setTableViewMode('wireframe');
            }
          }}
          className="appearance-none bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-md pl-3.5 pr-8 py-2 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/20 focus:border-[#0E7C7B] cursor-pointer transition"
        >
          {SUCURSALES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Botón discreto para ver detalles de fórmulas SQL y 8 KPIs */}
      <button
        type="button"
        onClick={() => setShowContextModal(!showContextModal)}
        title="Ver ficha técnica de los 8 KPIs y modelo PostgreSQL"
        className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-semibold border transition ${
          showContextModal
            ? 'bg-slate-800 text-white border-slate-800'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        }`}
      >
        <Info className="w-3.5 h-3.5" />
        <span className="hidden lg:inline">Ficha de KPIs (8)</span>
      </button>
    </div>
  );
}
