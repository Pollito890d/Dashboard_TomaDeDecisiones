const PESTANAS = [
  {
    id: 'resumen',
    etiqueta: 'Resumen ejecutivo',
    descripcion: 'Situación y evolución del sector',
  },
  {
    id: 'comparativa',
    etiqueta: 'Comparativa institucional',
    descripcion: 'Cooperativas del catálogo oficial',
  },
  {
    id: 'contexto',
    etiqueta: 'Contexto externo',
    descripcion: 'FONACOT y SNIIV',
  },
];

/** Los filtros viven en App: cambiar de pestaña nunca pierde la selección. */
export default function DashboardTabs({ activa, onChange }) {
  return (
    <nav aria-label="Secciones del tablero" className="flex flex-wrap gap-1 border-b border-slate-200">
      {PESTANAS.map((pestana) => {
        const seleccionada = activa === pestana.id;
        return (
          <button
            key={pestana.id}
            type="button"
            id={`tab-${pestana.id}`}
            role="tab"
            aria-selected={seleccionada}
            aria-controls={`panel-${pestana.id}`}
            title={pestana.descripcion}
            onClick={() => onChange(pestana.id)}
            className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B] sm:px-4 ${
              seleccionada
                ? 'border-[#0E7C7B] bg-white text-[#0E7C7B]'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
            }`}
          >
            {pestana.etiqueta}
          </button>
        );
      })}
    </nav>
  );
}

export { PESTANAS };
