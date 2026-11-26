import { useEffect, useState } from 'react';
import DashboardFrame from './components/layout/DashboardFrame';
import DashboardHeader from './components/layout/DashboardHeader';
import SectionHeading from './components/layout/SectionHeading';
import SourceTrace from './components/layout/SourceTrace';
import ContextMetric from './components/layout/ContextMetric';
import EstadoSeccion from './components/layout/EstadoSeccion';
import BotonReintento from './components/layout/BotonReintento';
import KpiInfoPanel from './components/filters/KpiInfoPanel';
import KpiSummaryGrid from './components/kpi/KpiSummaryGrid';
import TrendLineChart, { NicapTrendChart } from './components/charts/TrendLineChart';
import HorizontalBarList from './components/charts/HorizontalBarList';
import FonacotContextStrip from './components/charts/FonacotContextStrip';
import SniivContextStrip from './components/charts/SniivContextStrip';
import InstitutionRankingTable from './components/tables/InstitutionRankingTable';
import { useDashboardData } from './hooks/useDashboardData';
import { ApiError, trimestreDePeriodo } from './services/dashboardApi';
import { COLORS } from './constants/dashboardTheme';
import {
  formatMonth,
  formatNoDisponible,
  formatPercent,
  formatQuarter,
  formatYear,
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
  const [filtros, setFiltros] = useState({});
  const [avisoSeleccion, setAvisoSeleccion] = useState(null);
  const { data, error, loading, cargando, seleccion, recargar, recargarTodo } =
    useDashboardData(filtros);

  /** Los cortes, años y claves se envían solo al endpoint que los admite. */
  const cambiarFiltro = (nombre, valor) => {
    const anterior = filtros;
    const siguiente = { ...anterior, [nombre]: valor };
    let aviso = null;

    if (nombre === 'periodo' && valor) {
      // El contrato exige que `periodo` y `anio` sean coherentes en /api/dashboard.
      siguiente.anio = Number(String(valor).slice(0, 4));
    }
    if (nombre === 'periodoInstitucional' && valor) {
      siguiente.trimestreInstitucional = trimestreDePeriodo(valor);
      siguiente.anioInstitucional = Number(String(valor).slice(0, 4));
      if (anterior.claveSeis) {
        aviso = `Al cambiar el corte institucional a ${valor}, la clave ${anterior.claveSeis} se restableció a «Todas las consultadas».`;
      }
      siguiente.claveSeis = null;
    }
    if (nombre === 'trimestreFonacot' && valor) {
      siguiente.anioFonacot = Number(String(valor).slice(0, 4));
      if (anterior.entidadFonacot) {
        aviso = `El desglose cambió con el trimestre ${valor}; se restableció el filtro de entidad FONACOT.`;
      }
      siguiente.entidadFonacot = null;
    }
    if (nombre === 'anioSniiv') {
      siguiente.anioSniiv = valor ? Number(valor) : null;
      if (valor && anterior.entidadSniiv) {
        aviso = `El desglose cambió con el año ${valor}; se restableció el filtro de entidad SNIIV.`;
        siguiente.entidadSniiv = null;
      }
    }

    setFiltros(siguiente);
    setAvisoSeleccion(aviso);
  };

  /* Si una clave dejó de existir en el nuevo corte, se restablece de forma explícita. */
  useEffect(() => {
    const clave = seleccion?.claveSeis;
    if (!clave || !data?.instituciones?.length || cargando.instituciones) return;
    const disponible = data.instituciones.some(
      (fila) => String(fila.clave_seis) === String(clave),
    );
    if (!disponible) {
      setFiltros((anterior) => ({ ...anterior, claveSeis: null }));
      setAvisoSeleccion(
        `La clave ${clave} no está disponible en el corte ${data.corteInstituciones}; se restableció «Todas las consultadas».`,
      );
    }
  }, [seleccion?.claveSeis, data?.instituciones, data?.corteInstituciones, cargando.instituciones]);

  if (error) {
    const esApi = error instanceof ApiError;
    return (
      <DashboardFrame>
        <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5" role="alert">
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
          <div className="mt-4">
            <BotonReintento onClick={recargarTodo} etiqueta="Reintentar carga completa" />
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            No se sustituyó la respuesta fallida por datos de demostración.
          </p>
        </div>
      </DashboardFrame>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F5F8] text-slate-600 text-sm font-medium" role="status" aria-live="polite">
        Cargando tablero gerencial desde la API oficial...
      </div>
    );
  }

  const claveActiva = seleccion?.claveSeis ?? null;
  const filasInstitucionales = claveActiva
    ? data.instituciones.filter((fila) => String(fila.clave_seis) === String(claveActiva))
    : data.instituciones;
  const fichaIndividual = Boolean(claveActiva) && filasInstitucionales.length === 1;
  const filaIndividual = fichaIndividual ? filasInstitucionales[0] : null;

  const ordenarPor = (campo) =>
    [...filasInstitucionales]
      .filter((fila) => toNumberOrNull(fila[campo]) !== null)
      .sort((a, b) => toNumberOrNull(b[campo]) - toNumberOrNull(a[campo]))
      .slice(0, 5);

  const topImor = ordenarPor('kpi01_imor_publicado_pct');
  const topIcor = ordenarPor('kpi02_icor_derivado_pct');
  const trimestreTexto = formatQuarter(data.trimestreInstituciones);
  const institucionesConsultadas = data.totalDevueltosInstituciones ?? data.instituciones.length;
  const alcanceRanking = `Top 5 calculado sobre las ${institucionesConsultadas} fichas efectivamente consultadas${
    data.limitadoInstituciones ? ' (se alcanzó el tope admitido del parámetro limite)' : ''
  }; no cubre todo el universo de cooperativas.`;
  const avisosParciales = Object.entries(data.errores ?? {});

  return (
    <DashboardFrame>
      {/* =====================================================================
          ENCABEZADO Y FILTROS REALES
          ===================================================================== */}
      <DashboardHeader
        seleccion={data.seleccion}
        catalogos={data.catalogos}
        entidadesFonacot={data.entidadesFonacot}
        entidadesSniiv={data.entidadesSniiv}
        onChange={cambiarFiltro}
        showContextModal={showContextModal}
        setShowContextModal={setShowContextModal}
        cargando={cargando}
      />

      <KpiInfoPanel
        open={showContextModal}
        onClose={() => setShowContextModal(false)}
      />

      {avisoSeleccion && <Aviso>{avisoSeleccion}</Aviso>}

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
          <div className="mt-2">
            <BotonReintento onClick={recargarTodo} etiqueta="Reintentar consultas parciales" />
          </div>
        </Aviso>
      )}

      {/* =====================================================================
          01 / RESUMEN EJECUTIVO — CNBV sectorial mensual
          ===================================================================== */}
      <section className="mt-5" aria-labelledby="heading-resumen">
        <SectionHeading
          id="heading-resumen"
          aside={
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Corte CNBV: {formatMonth(data.periodo)} ·{' '}
              <strong className="text-slate-600">9 KPIs sectoriales</strong>
            </span>
          }
        >
          01 / RESUMEN EJECUTIVO
        </SectionHeading>

        {data.sinDatosCnbv && !cargando.cnbv && (
          <Aviso>
            HTTP 200 sin datos: CNBV no publica observaciones para el corte {formatMonth(data.periodo)}.
            No se imputan valores ausentes.
          </Aviso>
        )}
        {data.notaCnbv && (
          <p className="mb-3 text-[11px] text-slate-400">Nota oficial: {data.notaCnbv}</p>
        )}

        <EstadoSeccion
          cargando={cargando.cnbv}
          error={data.errores?.cnbv}
          onReintentar={() => recargar('cnbv')}
          mensajeCarga="Consultando los KPIs sectoriales del corte solicitado…"
        >
          <KpiSummaryGrid
            corte={data.corte}
            indicadores={data.indicadores}
            periodo={data.periodo}
            fuente={data.fuenteCnbv}
            bandasPorKpi={data.bandasPorKpi}
          />
        </EstadoSeccion>
      </section>

      {/* =====================================================================
          02 / TENDENCIAS — serie mensual del año del corte sectorial
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
            loading={cargando.cnbv}
            error={data.errores?.cnbv}
            onReintentar={() => recargar('cnbv')}
          />
          <NicapTrendChart
            serieAnual={data.serieAnual}
            periodo={data.periodo}
            fuente={data.fuenteCnbv}
            bandaNicap={data.bandasPorKpi['KPI-04']}
            loading={cargando.cnbv}
            error={data.errores?.cnbv}
            onReintentar={() => recargar('cnbv')}
          />
        </div>
      </section>

      {/* =====================================================================
          03 / ANÁLISIS INSTITUCIONAL Y 04 / TABLA
          ===================================================================== */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-7 flex flex-col" aria-labelledby="heading-analisis">
          <SectionHeading id="heading-analisis">03 / ANÁLISIS FINANCIERO</SectionHeading>

          <EstadoSeccion
            cargando={cargando.instituciones}
            error={data.errores?.instituciones}
            onReintentar={() => recargar('instituciones')}
            mensajeCarga="Consultando fichas institucionales del corte seleccionado…"
          >
            <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 gap-2">
                  <h3 className="text-[15px] font-bold text-slate-900">
                    {fichaIndividual ? 'Ficha de la cooperativa consultada' : 'Riesgo y cobertura por cooperativa'}
                  </h3>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-teal-50 text-[#0E7C7B] whitespace-nowrap">
                    Institucional · {trimestreTexto}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  {fichaIndividual
                    ? `${filaIndividual?.institucion_nombre} · clave ${filaIndividual?.clave_seis} · corte ${formatMonth(data.corteInstituciones)}. Fuente: ${data.fuenteInstituciones}.`
                    : `Comparación descriptiva entre las ${institucionesConsultadas} fichas consultadas; no establece causalidad ni cubre todo el universo de cooperativas.`}
                </p>

                {fichaIndividual ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <ContextMetric etiqueta="Activos" valor={'$ ' + (toNumberOrNull(filaIndividual?.activo_mxn)?.toLocaleString('en-US') ?? formatNoDisponible())} />
                    <ContextMetric etiqueta="Socios" valor={toNumberOrNull(filaIndividual?.socios)?.toLocaleString('en-US') ?? formatNoDisponible()} />
                    <ContextMetric etiqueta="IMOR publicado" valor={formatPercent(filaIndividual?.kpi01_imor_publicado_pct)} />
                    <ContextMetric etiqueta="ICOR derivado" valor={formatPercent(filaIndividual?.kpi02_icor_derivado_pct)} />
                    <ContextMetric etiqueta="NICAP publicado" valor={formatPercent(filaIndividual?.kpi04_nicap_publicado_pct)} />
                    <ContextMetric etiqueta="Participación por activo (M-02)" valor={formatPercent(filaIndividual?.m02_participacion_activo_publicada_pct)} />
                  </div>
                ) : topImor.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    HTTP 200 sin datos: no hay valores publicados para las fichas consultadas en el corte {trimestreTexto}.
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
                {claveActiva && (
                  <div>Clave consultada: {claveActiva} (cadena oficial, ceros iniciales conservados)</div>
                )}
              </div>
            </div>
          </EstadoSeccion>
        </section>

        <section className="lg:col-span-5 flex flex-col" aria-labelledby="heading-instituciones">
          <SectionHeading id="heading-instituciones">
            04 / COMPARATIVA INSTITUCIONAL
          </SectionHeading>

          <InstitutionRankingTable
            instituciones={filasInstitucionales}
            trimestre={data.trimestreInstituciones}
            limitado={data.limitadoInstituciones}
            totalDevueltos={institucionesConsultadas}
            nota={data.notaInstituciones}
            fuente={data.fuenteInstituciones}
            error={data.errores?.instituciones}
            cargando={cargando.instituciones}
            onReintentar={() => recargar('instituciones')}
            fichaIndividual={fichaIndividual}
            claveSeis={claveActiva}
          />
        </section>
      </div>

      {/* =====================================================================
          CONTEXTOS EXTERNOS INDEPENDIENTES
          ===================================================================== */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <FonacotContextStrip
          datos={data.fonacot}
          trimestre={data.trimestreFonacot}
          fuente={data.fuenteFonacot}
          error={data.errores?.fonacot}
          sinDatos={data.sinDatosFonacot}
          desglose={data.desgloseFonacot}
          entidad={seleccion?.entidadFonacot}
          genero={seleccion?.generoFonacot}
          loading={cargando.fonacot}
          onReintentar={() => recargar('fonacot')}
        />
        <SniivContextStrip
          datos={data.sniiv}
          anio={data.anioSniiv}
          fuente={data.fuenteSniiv}
          error={data.errores?.sniiv}
          sinDatos={data.sinDatosSniiv}
          desglose={data.desgloseSniiv}
          entidad={seleccion?.entidadSniiv}
          genero={seleccion?.generoSniiv}
          loading={cargando.sniiv}
          onReintentar={() => recargar('sniiv')}
        />
      </div>

      {/* =====================================================================
          PIE: CADA CONTEXTO CON SU PROPIA FECHA DE CORTE
          ===================================================================== */}
      <footer className="mt-5 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-slate-400 font-medium">
        <div className="space-y-0.5">
          <div>
            CNBV sectorial: {formatMonth(data.periodo)} · CNBV institucional:{' '}
            {formatMonth(data.corteInstituciones)} ({trimestreTexto}) · FONACOT:{' '}
            {formatQuarter(data.trimestreFonacot)} · SNIIV: {formatYear(data.anioSniiv)}
          </div>
          <div className="text-[10px]">
            Contrato API {data.contratoVersion} ·{' '}
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
