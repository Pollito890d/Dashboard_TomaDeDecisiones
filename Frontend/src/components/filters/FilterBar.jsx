import { ChevronDown, Info } from 'lucide-react';
import { formatMonth, formatQuarter, formatYear } from '../../utils/formatters';

/**
 * Filtros reales alimentados por los catálogos de la API. Los meses catálogo
 * no se presentan como observaciones garantizadas: la disponibilidad se valida
 * al consultar cada fuente.
 */
const conValorActual = (opciones, valor, formato) => {
  const lista = Array.isArray(opciones) ? opciones : [];
  if (valor === null || valor === undefined || valor === '') return lista;
  return lista.some((opcion) => String(opcion.value) === String(valor))
    ? lista
    : [{ value: valor, etiqueta: formato(valor) }, ...lista];
};

function Selector({
  id,
  etiqueta,
  valor,
  opciones,
  textoVacio,
  onChange,
  deshabilitado = false,
  motivo = '',
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{etiqueta}</label>
      <select
        id={id}
        disabled={deshabilitado}
        value={valor ?? ''}
        onChange={(evento) => onChange(evento.target.value)}
        title={deshabilitado ? motivo : etiqueta}
        aria-label={etiqueta}
        className={`appearance-none bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-md pl-3.5 pr-8 py-2 shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B] ${
          deshabilitado ? 'opacity-60 cursor-not-allowed' : 'hover:border-teal-300 cursor-pointer'
        }`}
      >
        <option value="">{textoVacio}</option>
        {opciones.map((opcion) => (
          <option key={`${id}-${opcion.value}`} value={opcion.value}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
    </div>
  );
}

function Grupo({ titulo, cargando, children }) {
  return (
    <fieldset className="flex flex-wrap items-end gap-2">
      <legend className="w-full text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {titulo}
        {cargando && <span className="ml-1 normal-case font-medium text-[#0E7C7B]">· consultando…</span>}
      </legend>
      {children}
    </fieldset>
  );
}

export default function FilterBar({
  seleccion,
  catalogos,
  entidadesFonacot,
  entidadesSniiv,
  onChange,
  showContextModal,
  setShowContextModal,
  cargando,
}) {
  const periodo = seleccion?.periodo;
  const corte = seleccion?.periodoInstitucional;
  const clave = seleccion?.claveSeis;

  const periodos = conValorActual(catalogos?.periodosMensuales, periodo, formatMonth)
    .map((item) => ({ value: item.value, etiqueta: formatMonth(item.value) }));

  const cortes = conValorActual(catalogos?.periodosInstitucionales, corte, (valor) => valor)
    .map((item) => ({
      value: item.value,
      etiqueta: `${formatMonth(item.value)} · ${item.trimestre ? formatQuarter(item.trimestre) : ''}`,
    }));

  const instituciones = conValorActual(
    catalogos?.instituciones,
    clave,
    (valor) => valor,
  ).map((item) => ({ value: item.claveSeis, etiqueta: `${item.claveSeis} · ${item.nombre}` }));

  const trimestresFonacot = conValorActual(
    catalogos?.trimestresFonacot,
    seleccion?.trimestreFonacot,
    formatQuarter,
  ).map((item) => ({ value: item.value, etiqueta: item.etiqueta ?? formatQuarter(item.value) }));

  const aniosSniiv = conValorActual(catalogos?.aniosSniiv, seleccion?.anioSniiv, formatYear)
    .map((item) => ({ value: item.value, etiqueta: item.etiqueta ?? formatYear(item.value) }));

  const opcionesEntidadFonacot = (entidadesFonacot ?? []).map((nombre) => ({
    value: nombre,
    etiqueta: nombre,
  }));
  const opcionesEntidadSniiv = (entidadesSniiv ?? []).map((item) => ({
    value: item.value,
    etiqueta: item.etiqueta,
  }));

  const totalConsultadas = catalogos?.totalInstitucionesDevueltas ?? instituciones.length;
  const limitado = Boolean(catalogos?.limitadoInstituciones);

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <Grupo titulo="CNBV · sectorial mensual" cargando={cargando?.cnbv}>
        <Selector
          id="select-periodo"
          etiqueta="Período sectorial CNBV"
          valor={periodo}
          opciones={periodos}
          textoVacio="Sin período oficial"
          onChange={(valor) => onChange('periodo', valor || null)}
        />
      </Grupo>

      <Grupo titulo="CNBV · institucional trimestral" cargando={cargando?.instituciones}>
        <Selector
          id="select-corte-institucional"
          etiqueta="Corte trimestral institucional CNBV"
          valor={corte}
          opciones={cortes}
          textoVacio="Sin corte institucional"
          onChange={(valor) => onChange('periodoInstitucional', valor || null)}
        />
        <Selector
          id="select-clave-seis"
          etiqueta="Institución CNBV (clave de seis dígitos)"
          valor={clave}
          opciones={instituciones}
          textoVacio={`Todas las consultadas (${totalConsultadas})${limitado ? ' · hay más' : ''}`}
          onChange={(valor) => onChange('claveSeis', valor || null)}
          deshabilitado={instituciones.length === 0}
          motivo="No hay fichas institucionales para el corte solicitado"
        />
      </Grupo>

      <Grupo titulo="FONACOT · trimestral" cargando={cargando?.fonacot}>
        <Selector
          id="select-fonacot-trimestre"
          etiqueta="Trimestre FONACOT"
          valor={seleccion?.trimestreFonacot}
          opciones={trimestresFonacot}
          textoVacio="Sin trimestre FONACOT"
          onChange={(valor) => onChange('trimestreFonacot', valor || null)}
        />
        <Selector
          id="select-fonacot-entidad"
          etiqueta="Entidad federativa FONACOT (desglose oficial)"
          valor={seleccion?.entidadFonacot}
          opciones={opcionesEntidadFonacot}
          textoVacio="Nacional · todas las entidades"
          onChange={(valor) => onChange('entidadFonacot', valor || null)}
          deshabilitado={opcionesEntidadFonacot.length === 0}
          motivo="La respuesta oficial no incluye desglose por entidad para este corte"
        />
        <Selector
          id="select-fonacot-genero"
          etiqueta="Género FONACOT (desglose oficial)"
          valor={seleccion?.generoFonacot}
          opciones={[{ value: 'mujeres', etiqueta: 'Mujeres' }, { value: 'hombres', etiqueta: 'Hombres' }]}
          textoVacio="Sin filtro de género"
          onChange={(valor) => onChange('generoFonacot', valor || null)}
        />
      </Grupo>

      <Grupo titulo="SNIIV · anual" cargando={cargando?.sniiv}>
        <Selector
          id="select-sniiv-anio"
          etiqueta="Año SNIIV"
          valor={seleccion?.anioSniiv}
          opciones={aniosSniiv}
          textoVacio="Sin año SNIIV"
          onChange={(valor) => onChange('anioSniiv', valor || null)}
        />
        <Selector
          id="select-sniiv-entidad"
          etiqueta="Entidad federativa SNIIV (desglose oficial)"
          valor={seleccion?.entidadSniiv}
          opciones={opcionesEntidadSniiv}
          textoVacio="Nacional · todas las entidades"
          onChange={(valor) => onChange('entidadSniiv', valor || null)}
          deshabilitado={opcionesEntidadSniiv.length === 0}
          motivo="La respuesta oficial no incluye desglose por entidad para este año"
        />
        <Selector
          id="select-sniiv-genero"
          etiqueta="Género SNIIV (desglose oficial)"
          valor={seleccion?.generoSniiv}
          opciones={[{ value: 'mujeres', etiqueta: 'Mujeres' }, { value: 'hombres', etiqueta: 'Hombres' }]}
          textoVacio="Sin filtro de género"
          onChange={(valor) => onChange('generoSniiv', valor || null)}
        />
      </Grupo>

      <button
        type="button"
        onClick={() => setShowContextModal(!showContextModal)}
        title="Ver catálogo de indicadores oficiales"
        aria-expanded={showContextModal}
        className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-semibold border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B] ${
          showContextModal
            ? 'bg-slate-800 text-white border-slate-800'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
        }`}
      >
        <Info className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="hidden lg:inline">Ficha de indicadores (13)</span>
      </button>

      <p className="w-full text-[10px] text-slate-400">
        Los meses y cortes provienen de catálogos oficiales; un período catalogado puede no tener
        observaciones. La disponibilidad se confirma al consultar cada fuente, sin suponer
        cobertura común entre CNBV, FONACOT y SNIIV. SNIIV solo publica el año 2025 en el contrato
        vigente: no se ofrecen años adicionales.
      </p>
    </div>
  );
}
