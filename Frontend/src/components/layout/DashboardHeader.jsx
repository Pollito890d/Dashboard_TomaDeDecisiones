import FilterBar from '../filters/FilterBar';

export default function DashboardHeader({
  periodo,
  corteInstitucional,
  trimestre,
  limite,
  seleccion,
  catalogos,
  showContextModal,
  setShowContextModal,
}) {
  return (
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-slate-200">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] sm:text-2xl font-extrabold tracking-tight text-slate-900">
            Caja de Ahorro y Préstamo
          </h1>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-[#0E7C7B] border border-teal-200/70">
            CNBV · FONACOT · SNIIV
          </span>
        </div>
        <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5 font-medium">
          Información sectorial e institucional · contextos externos · contrato API 1.0.0
        </p>
      </div>

      <FilterBar
        periodo={periodo}
        corteInstitucional={corteInstitucional}
        trimestre={trimestre}
        limite={limite}
        seleccion={seleccion}
        catalogos={catalogos}
        showContextModal={showContextModal}
        setShowContextModal={setShowContextModal}
      />
    </header>
  );
}
