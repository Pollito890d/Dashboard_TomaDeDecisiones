import FilterBar from '../filters/FilterBar';

export default function DashboardHeader({
  periodoId,
  setPeriodoId,
  sucursalId,
  setSucursalId,
  setTableViewMode,
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
            CNBV · CONDUSEF
          </span>
        </div>
        <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5 font-medium">
          Panel de liquidez, cartera y recuperación · Vista gerencial
        </p>
      </div>

      <FilterBar
        periodoId={periodoId}
        setPeriodoId={setPeriodoId}
        sucursalId={sucursalId}
        setSucursalId={setSucursalId}
        setTableViewMode={setTableViewMode}
        showContextModal={showContextModal}
        setShowContextModal={setShowContextModal}
      />
    </header>
  );
}
