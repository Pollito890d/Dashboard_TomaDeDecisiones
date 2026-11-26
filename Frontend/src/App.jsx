import { useState } from 'react';
import DashboardFrame from './components/layout/DashboardFrame';
import DashboardHeader from './components/layout/DashboardHeader';
import SectionHeading from './components/layout/SectionHeading';
import KpiInfoPanel from './components/filters/KpiInfoPanel';
import KpiSummaryGrid from './components/kpi/KpiSummaryGrid';
import TrendLineChart from './components/charts/TrendLineChart';
import { StateLoanBars, OverdueTypeBars } from './components/charts/HorizontalBarList';
import FonacotContextStrip from './components/charts/FonacotContextStrip';
import OverdueInstallmentsTable from './components/tables/OverdueInstallmentsTable';
import { useDashboardData } from './hooks/useDashboardData';

export default function App() {
  const [periodoId, setPeriodoId] = useState('8w');
  const [sucursalId, setSucursalId] = useState('ALL');

  // Estado para la tabla de detalle operativo (Zona 04)
  // Wireframe mode shows the exact 3 rows of the Figma wireframe by default, with toggle to see all 10 overdue records
  const [tableViewMode, setTableViewMode] = useState('wireframe'); // 'wireframe' | 'top10'
  const [sortBy, setSortBy] = useState('wireframe_order'); // 'wireframe_order' | 'dias_desc' | 'monto_desc'
  const [selectedTipoFilter, setSelectedTipoFilter] = useState(null);
  const [showContextModal, setShowContextModal] = useState(false);

  const dashboardData = useDashboardData({ periodoId, sucursalId });

  if (!dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F5F8] text-slate-600 text-sm font-medium">
        Cargando tablero gerencial...
      </div>
    );
  }

  const {
    resumen,
    evolucion_semanal,
    prestamos_por_estado,
    cartera_vencida_por_tipo,
    fonacot_comparativa,
  } = dashboardData;

  return (
    <DashboardFrame>
      {/* =====================================================================
          ENCABEZADO SUPERIOR Y FILTROS GLOBALES
          ===================================================================== */}
      <DashboardHeader
        periodoId={periodoId}
        setPeriodoId={setPeriodoId}
        sucursalId={sucursalId}
        setSucursalId={setSucursalId}
        setTableViewMode={setTableViewMode}
        showContextModal={showContextModal}
        setShowContextModal={setShowContextModal}
      />

      {/* Panel desplegable opcional con la matriz técnica de los 8 KPIs para la exposición con el profesor */}
      <KpiInfoPanel
        open={showContextModal}
        onClose={() => setShowContextModal(false)}
        resumen={resumen}
      />

      {/* =====================================================================
          ZONA SUPERIOR — 01 / RESUMEN EJECUTIVO (EL GANCHO Y EL CONFLICTO)
          ===================================================================== */}
      <section className="mt-5" aria-labelledby="heading-resumen">
        <SectionHeading
          id="heading-resumen"
          aside={
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Corte dominical: 22/11/2026 · Razón de liquidez:{' '}
              <strong className="text-slate-600">{resumen.razon_liquidez_pct}%</strong>
            </span>
          }
        >
          01 / RESUMEN EJECUTIVO
        </SectionHeading>

        <KpiSummaryGrid resumen={resumen} />
      </section>

      {/* =====================================================================
          ZONA CENTRAL — 02 / TENDENCIAS Y COMPARATIVA (KPI 5)
          ===================================================================== */}
      <section className="mt-6" aria-labelledby="heading-tendencias">
        <SectionHeading id="heading-tendencias">
          02 / TENDENCIAS Y COMPARATIVA
        </SectionHeading>

        <TrendLineChart
          evolucionSemanal={evolucion_semanal}
          sucursalId={sucursalId}
        />
      </section>

      {/* =====================================================================
          ZONA INFERIOR — NIVEL 3 (03 / CAUSA RAÍZ) Y NIVEL 4 (04 / DETALLE OPERATIVO)
          ===================================================================== */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* ZONA INFERIOR IZQUIERDA: 03 / CAUSA RAÍZ (7 columnas en escritorio) */}
        <section className="lg:col-span-7 flex flex-col" aria-labelledby="heading-causa-raiz">
          <SectionHeading id="heading-causa-raiz">03 / CAUSA RAÍZ</SectionHeading>

          <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-bold text-slate-900">
                  ¿Dónde se concentra la cartera vencida?
                </h3>
                {selectedTipoFilter && (
                  <button
                    type="button"
                    onClick={() => setSelectedTipoFilter(null)}
                    className="text-[11px] font-semibold text-[#D95D2E] hover:underline"
                  >
                    Quitar filtro ({selectedTipoFilter}) ✕
                  </button>
                )}
              </div>

              {/* Dos gráficos de barras horizontales lado a lado como en el Wireframe */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
                <StateLoanBars prestamosPorEstado={prestamos_por_estado} />
                <OverdueTypeBars
                  carteraVencidaPorTipo={cartera_vencida_por_tipo}
                  selectedTipoFilter={selectedTipoFilter}
                  onSelectTipo={setSelectedTipoFilter}
                />
              </div>
            </div>

            <FonacotContextStrip fonacotComparativa={fonacot_comparativa} />
          </div>
        </section>

        {/* ZONA INFERIOR DERECHA: 04 / DETALLE OPERATIVO (5 columnas en escritorio) */}
        <section className="lg:col-span-5 flex flex-col" aria-labelledby="heading-detalle">
          <SectionHeading id="heading-detalle">04 / DETALLE OPERATIVO</SectionHeading>

          <OverdueInstallmentsTable
            cuotasVencidas={dashboardData.cuotas_vencidas}
            sucursalId={sucursalId}
            tableViewMode={tableViewMode}
            setTableViewMode={setTableViewMode}
            sortBy={sortBy}
            setSortBy={setSortBy}
            selectedTipoFilter={selectedTipoFilter}
            setSelectedTipoFilter={setSelectedTipoFilter}
          />
        </section>
      </div>

      {/* =====================================================================
          PIE DE PÁGINA ACADÉMICO (IDÉNTICO AL WIREFRAME DE FIGMA)
          ===================================================================== */}
      <footer className="mt-5 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-slate-400 font-medium">
        <div>
          WIREFRAME ACADÉMICO · Datos y valores ilustrativos, no registros reales · Versión 12/11/2026
        </div>
        <div>
          Equipo &ldquo;Los Menchos Victoria&rdquo; · PostgreSQL 15 + FastAPI + React &amp; Recharts
        </div>
      </footer>
    </DashboardFrame>
  );
}
