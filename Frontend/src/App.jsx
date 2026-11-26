import { useState } from 'react';
import DashboardFrame from './components/layout/DashboardFrame';
import DashboardHeader from './components/layout/DashboardHeader';
import SectionHeading from './components/layout/SectionHeading';
import SourceTrace from './components/layout/SourceTrace';
import KpiInfoPanel from './components/filters/KpiInfoPanel';
import KpiSummaryGrid from './components/kpi/KpiSummaryGrid';
import TrendLineChart, { NicapTrendChart } from './components/charts/TrendLineChart';
import HorizontalBarList from './components/charts/HorizontalBarList';
import FonacotContextStrip from './components/charts/FonacotContextStrip';
import SniivContextStrip from './components/charts/SniivContextStrip';
import InstitutionRankingTable from './components/tables/InstitutionRankingTable';
import { useDashboardData } from './hooks/useDashboardData';
import { ApiError } from './services/dashboardApi';
import { COLORS } from './constants/dashboardTheme';
import {
  formatMonth,
  formatNoDisponible,
  formatPercent,
  formatQuarter,
  toNumberOrNull,
} from './utils/formatters';

const ETIQUETAS_ERROR = {
  periodos: 'Catálogo de períodos',
  instituciones: 'Fichas institucionales CNBV',
  fonacot: 'Contexto FONACOT',
  sniiv: 'Contexto SNIIV',
  fuentes: 'Trazabilidad de fuentes',
  health: 'Estado de la API',
};

function Aviso({ children, critico = false }) {
  return (
    <div
      className={`mb-3 rounded border px-3 py-2 text-[11px] ${
        critico
          ? 'border-red-200 bg-red-50 text-[#B4472A]'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      }`}
    >
      {children}
    </div>
  );
}

export default function App() {
  const [showContextModal, setShowContextModal] = useState(false);
  const { data, error, loading } = useDashboardData();

  if (error) {
    const esApi = error instanceof ApiError;
    return (
      <DashboardFrame>
        <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5">
          <h2 className="text-[15px] font-bold text-[#D95D2E]">
            No fue posible cargar la información oficial
          </h2>
          <p className="text-xs text-slate-600 mt-2">{error.message}</p>
          {esApi && (error.status || error.code || error.detail || error.campos?.length > 0) && (
            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px] text-slate-500">
              {error.code && <div><dt className="inline font-semibold">Tipo:</dt> <dd className="inline">{error.code}</dd></div>}
              {error.status && <div><dt className="inline font-semibold">HTTP:</dt> <dd className="inline">{error.status}</dd></div>}
              {error.detail && <div className="sm:col-span-2"><dt className="inline font-semibold">Detalle:</dt> <dd className="inline">{error.detail}</dd></div>}
              {error.campos?.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="inline font-semibold">Campos:</dt>{' '}
                  <dd className="inline">{error.campos.join(', ')}</dd>
                </div>
              )}
            </dl>
          )}
          <p className="text-[11px] text-slate-400 mt-3">
            No se sustituyó la respuesta fallida por datos de demostración.
          </p>
        </div>
      </DashboardFrame>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F5F8] text-slate-600 text-sm font-medium">
        Cargando tablero gerencial desde la API oficial...
      </div>
    );
  }

  const ordenarPor = (campo) =>
    [...data.instituciones]
      .filter((fila) => toNumberOrNull(fila[campo]) !== null)
      .sort((a, b) => toNumberOrNull(b[campo]) - toNumberOrNull(a[campo]))
      .slice(0, 5);

  const topImor = ordenarPor('kpi01_imor_publicado_pct');
  const topIcor = ordenarPor('kpi02_icor_derivado_pct');
  const trimestreTexto = formatQuarter(data.trimestreInstituciones);
  const institucionesConsultadas = data.totalDevueltosInstituciones ?? data.instituciones.length;
  const alcanceRanking = data.limitadoInstituciones
    ? `Top 5 calculado sobre las ${institucionesConsultadas} instituciones devueltas por la API (respuesta limitada por el parámetro limite); no cubre todo el universo de cooperativas.`
    : `Top 5 calculado sobre las ${institucionesConsultadas} instituciones devueltas por la API; no cubre todo el universo de cooperativas.`;
  const avisosParciales = Object.entries(data.errores ?? {});

  return (
    <DashboardFrame>
      {/* =====================================================================
          ENCABEZADO SUPERIOR Y CORTES OFICIALES
          ===================================================================== */}
      <DashboardHeader
        periodo={data.periodo}
        corteInstitucional={data.corteInstituciones}
        trimestre={data.trimestreInstituciones}
        limite={institucionesConsultadas}
        seleccion={data.seleccion}
        catalogos={data.catalogos}
        showContextModal={showContextModal}
        setShowContextModal={setShowContextModal}
      />

      {/* Catálogo de los 13 indicadores efectivamente documentados */}
      <KpiInfoPanel
        open={showContextModal}
        onClose={() => setShowContextModal(false)}
      />

      {/* Fallos parciales: el resto del tablero se conserva */}
      {avisosParciales.length > 0 && (
        <Aviso>
          <strong>Alertas parciales de la API:</strong>
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            {avisosParciales.map(([clave, mensaje]) => (
              <li key={clave}>
                <span className="font-semibold">{ETIQUETAS_ERROR[clave] ?? clave}:</span> {mensaje}
              </li>
            ))}
          </ul>
        </Aviso>
      )}

      {/* =====================================================================
          ZONA SUPERIOR — 01 / RESUMEN EJECUTIVO
          ===================================================================== */}
      <section className="mt-5" aria-labelledby="heading-resumen">
        <SectionHeading
          id="heading-resumen"
          aside={
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Corte: {formatMonth(data.periodo)} ·{' '}
              <strong className="text-slate-600">9 KPIs sectoriales</strong>
            </span>
          }
        >
          01 / RESUMEN EJECUTIVO
        </SectionHeading>

        {data.sinDatosCnbv && (
          <Aviso>HTTP 200 sin datos: CNBV no publica observaciones para el corte {data.periodo}. No se imputan valores ausentes.</Aviso>
        )}
        {data.notaCnbv && (
          <p className="mb-3 text-[11px] text-slate-400">Nota oficial: {data.notaCnbv}</p>
        )}

        <KpiSummaryGrid
          corte={data.corte}
          indicadores={data.indicadores}
          periodo={data.periodo}
          fuente={data.fuenteCnbv}
          bandasPorKpi={data.bandasPorKpi}
        />
      </section>

      {/* =====================================================================
          ZONA CENTRAL — 02 / TENDENCIAS Y COMPARATIVA MENSUAL
          ===================================================================== */}
      <section className="mt-6" aria-labelledby="heading-tendencias">
        <SectionHeading id="heading-tendencias">
          02 / TENDENCIAS Y COMPARATIVA
        </SectionHeading>

        <div className="space-y-5">
          <TrendLineChart
            serieAnual={data.serieAnual}
            periodo={data.periodo}
            fuente={data.fuenteCnbv}
          />
          <NicapTrendChart
            serieAnual={data.serieAnual}
            periodo={data.periodo}
            fuente={data.fuenteCnbv}
            bandaNicap={data.bandasPorKpi['KPI-04']}
          />
        </div>
      </section>

      {/* =====================================================================
          ZONA INFERIOR — 03 / ANÁLISIS FINANCIERO Y 04 / COMPARATIVA
          ===================================================================== */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 flex flex-col" aria-labelledby="heading-analisis">
          <SectionHeading id="heading-analisis">03 / ANÁLISIS FINANCIERO</SectionHeading>

          <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-bold text-slate-900">
                  Riesgo y cobertura por cooperativa
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-teal-50 text-[#0E7C7B] whitespace-nowrap">
                  Institucional · {trimestreTexto}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Comparación descriptiva entre las {institucionesConsultadas} instituciones consultadas; no establece una relación de causalidad ni cubre todo el universo de cooperativas.
              </p>

              {topImor.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Sin fichas institucionales con valores publicados para el corte solicitado.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
                  <HorizontalBarList
                    title={`IMOR publicado · ${institucionesConsultadas} cooperativas consultadas (%)`}
                    items={topImor}
                    labelKey="institucion_nombre"
                    valueKey="kpi01_imor_publicado_pct"
                    color={COLORS.orangeRed}
                    formatValue={formatPercent}
                    descripcion={`${alcanceRanking} Orden por IMOR publicado descendente.`}
                  />
                  <HorizontalBarList
                    title={`ICOR derivado · ${institucionesConsultadas} cooperativas consultadas (%)`}
                    items={topIcor}
                    labelKey="institucion_nombre"
                    valueKey="kpi02_icor_derivado_pct"
                    color={COLORS.teal}
                    formatValue={formatPercent}
                    descripcion={`${alcanceRanking} Cobertura derivada de campos oficiales; no es recuperación de cartera.`}
                  />
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-[10px] text-slate-400 space-y-1">
              <div>
                Liquidez por cooperativa: {formatNoDisponible()} — los boletines BE_SOCAPS no publican activos y pasivos de corto plazo con corte ≤ 30 días
                (<code>kpi03_liquidez_no_disponible_pct</code> = null).
              </div>
              <div>Fuente: {data.fuenteInstituciones}</div>
              {data.claveSeisInstituciones && (
                <div>Clave consultada: {data.claveSeisInstituciones} (cadena oficial, ceros iniciales conservados)</div>
              )}
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 flex flex-col" aria-labelledby="heading-instituciones">
          <SectionHeading id="heading-instituciones">
            04 / COMPARATIVA INSTITUCIONAL
          </SectionHeading>

          <InstitutionRankingTable
            instituciones={data.instituciones}
            trimestre={data.trimestreInstituciones}
            limitado={data.limitadoInstituciones}
            totalDevueltos={data.totalDevueltosInstituciones}
            nota={data.notaInstituciones}
            fuente={data.fuenteInstituciones}
            error={data.errores?.instituciones}
          />
        </section>
      </div>

      {/* =====================================================================
          CONTEXTOS EXTERNOS INDEPENDIENTES (FONACOT Y SNIIV)
          ===================================================================== */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <FonacotContextStrip
          datos={data.fonacot}
          trimestre={data.trimestreFonacot}
          fuente={data.fuenteFonacot}
          error={data.errores?.fonacot}
          sinDatos={data.sinDatosFonacot}
        />
        <SniivContextStrip
          datos={data.sniiv}
          anio={data.anioSniiv}
          fuente={data.fuenteSniiv}
          error={data.errores?.sniiv}
          sinDatos={data.sinDatosSniiv}
        />
      </div>

      {/* =====================================================================
          PIE INFORMATIVO Y TRAZABILIDAD
          ===================================================================== */}
      <footer className="mt-5 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-slate-400 font-medium">
        <div className="space-y-0.5">
          <div>
            Datos oficiales CNBV · FONACOT · SNIIV · Contrato API {data.contratoVersion} · Corte {data.periodo}
          </div>
          <div className="text-[10px]">
            <SourceTrace
              fuentes={data.fuentes}
              error={data.errores?.fuentes}
              estadoApi={data.estadoApi}
            />
            {data.errores?.health && (
              <span className="text-amber-700"> · Estado API no disponible: {data.errores.health}</span>
            )}
          </div>
        </div>
        <div>
          Equipo &ldquo;Los Menchos Victoria&rdquo; · PostgreSQL + FastAPI + React &amp; Recharts
        </div>
      </footer>
    </DashboardFrame>
  );
}
