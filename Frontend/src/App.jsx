import { useState } from 'react';
import DashboardFrame from './components/layout/DashboardFrame';
import DashboardHeader from './components/layout/DashboardHeader';
import SourceTrace from './components/layout/SourceTrace';
import ContextMetric from './components/layout/ContextMetric';
import EstadoSeccion from './components/layout/EstadoSeccion';
import BotonReintento from './components/layout/BotonReintento';
import FilterBar from './components/filters/FilterBar';
import KpiInfoPanel from './components/filters/KpiInfoPanel';
import KpiSummaryGrid from './components/kpi/KpiSummaryGrid';
import TrendLineChart from './components/charts/TrendLineChart';
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
  formatPercentNumber,
  formatQuarter,
  formatYear,
  periodoAnterior,
  toNumberOrNull,
} from './utils/formatters';

const ETIQUETAS_ERROR = {
  periodos: 'Catálogo de períodos',
  catalogoInstituciones: 'Catálogo de cooperativas',
  instituciones: 'Fichas de cooperativas',
  fonacot: 'Contexto FONACOT',
  sniiv: 'Contexto SNIIV',
  fuentes: 'Trazabilidad de fuentes',
  health: 'Estado del servicio',
};

const LLAVES_POR_SECCION = {
  sectorial: ['periodo', 'anio'],
  institucional: [
    'periodoInstitucional', 'trimestreInstitucional', 'anioInstitucional', 'claveSeis',
  ],
  fonacot: ['trimestreFonacot', 'anioFonacot', 'entidadFonacot', 'generoFonacot'],
  sniiv: ['anioSniiv', 'entidadSniiv', 'generoSniiv'],
};

const IDS_PRINCIPALES = ['KPI-01', 'KPI-02', 'KPI-03', 'KPI-04'];
const IDS_SECUNDARIOS = ['KPI-05', 'KPI-06', 'KPI-07', 'KPI-08', 'KPI-09'];

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

function Panel({ id, children }) {
  return (
    <section role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className="mt-5">
      {children}
    </section>
  );
}

export default function App() {
  const [showContextModal, setShowContextModal] = useState(false);
  const [tabActiva, setTabActiva] = useState('resumen');
  const [indicadorGrafica, setIndicadorGrafica] = useState('kpi01_imor_pct');
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
      // La clave se conserva: el catálogo del selector es completo, aunque el
      // ranking del corte solo devuelva las fichas mejor calificadas.
      siguiente.trimestreInstitucional = trimestreDePeriodo(valor);
      siguiente.anioInstitucional = Number(String(valor).slice(0, 4));
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

  /** Quitar el override devuelve esa sección a la selección oficial inicial. */
  const restablecer = (seccion) => {
    const llaves = LLAVES_POR_SECCION[seccion] ?? [];
    setFiltros((anterior) => {
      const siguiente = { ...anterior };
      llaves.forEach((llave) => delete siguiente[llave]);
      return siguiente;
    });
    setAvisoSeleccion(null);
  };

  if (error) {
    const esApi = error instanceof ApiError;
    return (
      <DashboardFrame>
        <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5" role="alert">
          <h2 className="text-[15px] font-bold text-[#D95D2E]">
            No fue posible cargar la información oficial
          </h2>
          <p className="text-xs text-slate-600 mt-2">{error.message}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            El tablero no sustituye la respuesta fallida por datos de demostración.
          </p>
          {esApi && (error.status || error.code || error.detail || error.campos?.length > 0) && (
            <details className="mt-3 text-[11px] text-slate-500">
              <summary className="cursor-pointer font-semibold">Ver detalle técnico</summary>
              <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {error.code && <div><dt className="inline font-semibold">Código interno:</dt> <dd className="inline">{error.code}</dd></div>}
                {error.status && <div><dt className="inline font-semibold">Estado HTTP:</dt> <dd className="inline">{error.status}</dd></div>}
                {error.detail && <div className="sm:col-span-2"><dt className="inline font-semibold">Detalle:</dt> <dd className="inline">{error.detail}</dd></div>}
                {error.campos?.length > 0 && (
                  <div className="sm:col-span-2">
                    <dt className="inline font-semibold">Campos:</dt>{' '}
                    <dd className="inline">{error.campos.join(', ')}</dd>
                  </div>
                )}
              </dl>
            </details>
          )}
          <div className="mt-4">
            <BotonReintento onClick={recargarTodo} etiqueta="Reintentar carga" />
          </div>
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
  const serieAnual = data.serieAnual ?? [];
  const trimestreTexto = formatQuarter(data.trimestreInstituciones);
  const institucionesConsultadas = data.totalDevueltosInstituciones ?? data.instituciones.length;
  const totalCatalogo = data.catalogos?.totalInstitucionesDevueltas
    ?? data.catalogos?.instituciones?.length
    ?? institucionesConsultadas;
  const avisosParciales = Object.entries(data.errores ?? {});
  const indicadorActivo = (data.indicadores ?? []).find((item) => item.campo === indicadorGrafica)
    ?? (data.indicadores ?? [])[0];

  /* Lectura del corte y del mes inmediatamente anterior, solo con datos de la API. */
  const campoGrafica = indicadorActivo?.campo ?? indicadorGrafica;
  const valorCorteGrafica = toNumberOrNull(data.corte?.[campoGrafica]);
  const periodoPrevio = periodoAnterior(data.periodo);
  const filaPrevioGrafica = periodoPrevio
    ? serieAnual.find((fila) => fila.periodo_ym === periodoPrevio)
    : null;
  const valorPrevioGrafica = toNumberOrNull(filaPrevioGrafica?.[campoGrafica]);
  const variacionGrafica = valorCorteGrafica !== null && valorPrevioGrafica !== null
    ? valorCorteGrafica - valorPrevioGrafica
    : null;
  const textoVariacion = variacionGrafica === null
    ? formatNoDisponible()
    : variacionGrafica === 0
      ? `Sin cambio frente a ${formatMonth(periodoPrevio)} (0.00 puntos porcentuales).`
      : `${variacionGrafica > 0 ? 'Aumentó' : 'Disminuyó'} ${formatPercentNumber(Math.abs(variacionGrafica), 2)} puntos porcentuales frente a ${formatMonth(periodoPrevio)}.`;
  const interpretacionVariacion = variacionGrafica === null
    ? formatNoDisponible()
    : `${variacionGrafica > 0 ? 'El valor aumentó' : variacionGrafica < 0 ? 'El valor disminuyó' : 'El valor se mantuvo'} respecto al mes anterior. ${indicadorActivo?.lectura ?? indicadorActivo?.interpretacion ?? ''}`.trim();

  const propsFiltros = {
    seleccion,
    catalogos: data.catalogos,
    entidadesFonacot: data.entidadesFonacot,
    entidadesSniiv: data.entidadesSniiv,
    onChange: cambiarFiltro,
    cargando,
  };
  const barra = (secciones, seccion) => (
    <FilterBar {...propsFiltros} secciones={secciones} onRestablecer={() => restablecer(seccion)} />
  );

  return (
    <DashboardFrame>
      <DashboardHeader
        tabActiva={tabActiva}
        onCambiarTab={setTabActiva}
        onAbrirGuia={() => setShowContextModal(true)}
        corte={data.periodo}
      />

      <KpiInfoPanel open={showContextModal} onClose={() => setShowContextModal(false)} />

      {avisoSeleccion && <div className="mt-3"><Aviso>{avisoSeleccion}</Aviso></div>}

      {avisosParciales.length > 0 && (
        <details className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          <summary className="cursor-pointer font-semibold">
            Algunas secciones no pudieron actualizarse · ver detalle
          </summary>
          <ul className="list-disc pl-4 mt-2 space-y-0.5">
            {avisosParciales.map(([clave, mensaje]) => (
              <li key={clave}>
                <span className="font-semibold">{ETIQUETAS_ERROR[clave] ?? clave}:</span> {mensaje}
              </li>
            ))}
          </ul>
          <div className="mt-2">
            <BotonReintento onClick={recargarTodo} etiqueta="Reintentar consultas" />
          </div>
        </details>
      )}

      {/* 1–3. Situación actual → evolución → rentabilidad y eficiencia */}
      {tabActiva === 'resumen' && (
        <Panel id="resumen">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Situación financiera del sector</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Indicadores mensuales del sistema SOCAP.
              </p>
            </div>
            {barra(['sectorial'], 'sectorial')}
          </div>

          {data.sinDatosCnbv && !cargando.cnbv && (
            <Aviso>
              El corte {formatMonth(data.periodo)} no tiene observaciones publicadas. No se imputan
              valores ausentes.
            </Aviso>
          )}

          <EstadoSeccion
            cargando={cargando.cnbv}
            error={data.errores?.cnbv}
            onReintentar={() => recargar('cnbv')}
            mensajeCarga="Consultando los KPIs del corte solicitado…"
          >
            <KpiSummaryGrid
              corte={data.corte}
              indicadores={data.indicadores}
              periodo={data.periodo}
              fuente={data.fuenteCnbv}
              bandasPorKpi={data.bandasPorKpi}
              ids={IDS_PRINCIPALES}
            />
          </EstadoSeccion>

          <div className="mt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
              <h3 className="text-sm font-bold text-slate-900">
                ¿Cómo evolucionan riesgo, liquidez y capitalización?
              </h3>
              <span className="text-[11px] text-slate-400">Serie mensual · unidad: porcentaje</span>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_230px] gap-4">
              <TrendLineChart
                serieAnual={serieAnual}
                periodo={data.periodo}
                fuente={data.fuenteCnbv}
                loading={cargando.cnbv}
                error={data.errores?.cnbv}
                onReintentar={() => recargar('cnbv')}
                campo={indicadorGrafica}
                onCampoChange={setIndicadorGrafica}
                bandaNicap={data.bandasPorKpi['KPI-04']}
              />
              <aside className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-4">
                <h4 className="text-xs font-bold text-slate-900">Cómo leer la gráfica</h4>
                <dl className="mt-2 space-y-2 text-[11px] text-slate-600">
                  <div>
                    <dt className="font-semibold text-slate-700">Qué compara:</dt>
                    <dd>{indicadorActivo?.nombre}. Un indicador por gráfica para apreciar mejor sus variaciones.</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">Valor en {formatMonth(data.periodo)}:</dt>
                    <dd className="font-bold text-slate-900">{formatPercent(valorCorteGrafica)}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">Variación vs. mes anterior:</dt>
                    <dd>{textoVariacion}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">Lectura del cambio:</dt>
                    <dd>{interpretacionVariacion}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">Serie:</dt>
                    <dd>
                      {formatMonth(serieAnual[0]?.periodo_ym)} a{' '}
                      {formatMonth(serieAnual.at(-1)?.periodo_ym)}
                    </dd>
                  </div>
                </dl>
                <details className="mt-3 text-[10px] text-slate-400">
                  <summary className="cursor-pointer font-semibold">Detalle técnico</summary>
                  <p className="mt-1">Cálculo oficial: <code>{indicadorActivo?.formula}</code></p>
                  <p className="mt-0.5">Fuente: {data.fuenteCnbv}</p>
                </details>
              </aside>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-bold text-slate-900">Rentabilidad y eficiencia financiera</h3>
            <p className="text-xs text-slate-500 mt-0.5 mb-2">
              Cinco indicadores complementarios del mismo corte sectorial.
            </p>
            <KpiSummaryGrid
              corte={data.corte}
              indicadores={data.indicadores}
              periodo={data.periodo}
              fuente={data.fuenteCnbv}
              bandasPorKpi={data.bandasPorKpi}
              ids={IDS_SECUNDARIOS}
              compacta
            />
            <details className="mt-3 text-[11px] text-slate-500">
              <summary className="cursor-pointer font-semibold text-slate-600">
                Participación femenina en el sector
              </summary>
              <p className="mt-1">
                Socios reportados por género en {formatMonth(data.periodo)}:{' '}
                <strong className="text-slate-800">
                  {formatPercent(data.corte?.m01_participacion_femenina_socios_pct)}
                </strong>
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">
                El denominador es la suma de socios reportados por género, no el total publicado.
                Fuente: {data.fuenteCnbv}
              </p>
            </details>
          </div>

          {data.notaCnbv && (
            <details className="mt-4 text-[10px] text-slate-400">
              <summary className="cursor-pointer font-semibold">Nota metodológica oficial</summary>
              <p className="mt-1">{data.notaCnbv}</p>
            </details>
          )}
        </Panel>
      )}

      {/* 4. Comparativa de cooperativas */}
      {tabActiva === 'comparativa' && (
        <Panel id="comparativa">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Comparativa entre cooperativas</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Fichas trimestrales de la CNBV · {trimestreTexto}. Selecciona una cooperativa para ver
                su ficha individual.
              </p>
            </div>
            {barra(['institucional'], 'institucional')}
          </div>

          {fichaIndividual && (
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-50 text-[#0E7C7B]">
                Ficha individual
              </span>
              <span className="text-[11px] text-slate-500">
                {filaIndividual?.institucion_nombre} · clave {claveActiva} ·{' '}
                {formatMonth(data.corteInstituciones)}
              </span>
            </div>
          )}

          <EstadoSeccion
            cargando={cargando.instituciones}
            error={data.errores?.instituciones}
            onReintentar={() => recargar('instituciones')}
            mensajeCarga="Consultando fichas institucionales del corte seleccionado…"
          >
            {fichaIndividual ? (
              <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-4 sm:p-5">
                <h3 className="text-sm font-bold text-slate-900">
                  Indicadores de la cooperativa consultada
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Corte {formatMonth(data.corteInstituciones)} · {trimestreTexto}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-3">
                  <ContextMetric etiqueta="Activos" valor={`$ ${toNumberOrNull(filaIndividual?.activo_mxn)?.toLocaleString('en-US') ?? formatNoDisponible()}`} />
                  <ContextMetric etiqueta="Socios" valor={toNumberOrNull(filaIndividual?.socios)?.toLocaleString('en-US') ?? formatNoDisponible()} />
                  <ContextMetric etiqueta="IMOR publicado" valor={formatPercent(filaIndividual?.kpi01_imor_publicado_pct)} />
                  <ContextMetric etiqueta="ICOR derivado" valor={formatPercent(filaIndividual?.kpi02_icor_derivado_pct)} />
                  <ContextMetric etiqueta="NICAP publicado" valor={formatPercent(filaIndividual?.kpi04_nicap_publicado_pct)} />
                  <ContextMetric etiqueta="Participación por activo" valor={formatPercent(filaIndividual?.m02_participacion_activo_publicada_pct)} />
                </div>
              </div>
            ) : topImor.length === 0 ? (
              <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 text-xs text-slate-500">
                No hay fichas publicadas para el corte {trimestreTexto}. No se imputan valores ausentes.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-4 sm:p-5">
                  <HorizontalBarList
                    title="Morosidad (IMOR) por cooperativa"
                    items={topImor}
                    labelKey="institucion_nombre"
                    valueKey="kpi01_imor_publicado_pct"
                    color={COLORS.orangeRed}
                    formatValue={formatPercent}
                    descripcion={`Compara el IMOR publicado en ${trimestreTexto}. Barras más largas indican mayor morosidad.`}
                  />
                </div>
                <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-4 sm:p-5">
                  <HorizontalBarList
                    title="Cobertura (ICOR) por cooperativa"
                    items={topIcor}
                    labelKey="institucion_nombre"
                    valueKey="kpi02_icor_derivado_pct"
                    color={COLORS.teal}
                    formatValue={formatPercent}
                    descripcion={`Compara la cobertura derivada en ${trimestreTexto}. Barras más largas indican mayor cobertura contable, no recuperación efectiva.`}
                  />
                </div>
              </div>
            )}
          </EstadoSeccion>

          <details className="mt-3 text-[10px] text-slate-400">
            <summary className="cursor-pointer font-semibold">Alcance y fuente de la comparativa</summary>
            <p className="mt-1">
              Liquidez por cooperativa: {formatNoDisponible()} — los boletines no publican los
              componentes de corto plazo necesarios para el indicador sectorial.
            </p>
            <p className="mt-0.5">
              Fuente: {data.fuenteInstituciones}
              {claveActiva ? ` · clave consultada ${claveActiva}` : ''}
            </p>
          </details>

          <div className="mt-4">
            <InstitutionRankingTable
              instituciones={filasInstitucionales}
              trimestre={data.trimestreInstituciones}
              limitado={data.limitadoInstituciones}
              totalDevueltos={institucionesConsultadas}
              totalCatalogo={totalCatalogo}
              nota={data.notaInstituciones}
              fuente={data.fuenteInstituciones}
              error={data.errores?.instituciones}
              cargando={cargando.instituciones}
              onReintentar={() => recargar('instituciones')}
              fichaIndividual={fichaIndividual}
              claveSeis={claveActiva}
            />
          </div>
        </Panel>
      )}

      {/* 5. Contextos externos independientes */}
      {tabActiva === 'contexto' && (
        <Panel id="contexto">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900">Contexto financiero externo</h2>
            <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
              FONACOT y SNIIV describen universos independientes de las cooperativas SOCAP: sus cifras
              no se suman a los indicadores del sector ni se atribuyen a una cooperativa.
            </p>
          </div>

          <div className="space-y-4">
            <section
              aria-labelledby="heading-fonacot"
              className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 id="heading-fonacot" className="text-sm font-bold text-slate-900">
                    FONACOT · crédito al trabajo
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Universo externo de crédito; se consulta por separado del sector SOCAP.
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-50 text-[#0E7C7B] whitespace-nowrap">
                  {formatQuarter(data.trimestreFonacot)}
                </span>
              </div>

              <div className="mt-3">{barra(['fonacot'], 'fonacot')}</div>
              <div className="mt-3">
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
              </div>
            </section>

            <section
              aria-labelledby="heading-sniiv"
              className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 id="heading-sniiv" className="text-sm font-bold text-slate-900">
                    SNIIV · financiamiento de vivienda
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Universo externo de vivienda; corte anual, sin mezclarlo con las cooperativas.
                  </p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-teal-50 text-[#0E7C7B] whitespace-nowrap">
                  Anual {formatYear(data.anioSniiv)}
                </span>
              </div>

              <div className="mt-3">{barra(['sniiv'], 'sniiv')}</div>
              <div className="mt-3">
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
            </section>
          </div>
        </Panel>
      )}

      <footer className="mt-6 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-slate-400">
        <div className="space-y-0.5">
          <div>
            Cortes: sectorial {formatMonth(data.periodo)} · cooperativas {trimestreTexto} ·
            FONACOT {formatQuarter(data.trimestreFonacot)} · SNIIV {formatYear(data.anioSniiv)}
          </div>
          <div>
            <SourceTrace
              fuentes={data.fuentes}
              error={data.errores?.fuentes}
              estadoApi={data.estadoApi}
              contratoVersion={data.contratoVersion}
            />
          </div>
        </div>
        <div>Equipo &ldquo;Los Menchos Victoria&rdquo;</div>
      </footer>
    </DashboardFrame>
  );
}
