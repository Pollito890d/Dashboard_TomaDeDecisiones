import { ChevronDown, Info } from 'lucide-react';
import { formatMonth, formatQuarter, formatYear } from '../../utils/formatters';

/**
 * Los selectores siguen deshabilitados: muestran los valores reales ya
 * seleccionados y los catálogos cargados desde FastAPI. La interacción queda
 * preparada para el paso 26.
 */
const conValorActual = (opciones, valor, formato) => {
  const lista = Array.isArray(opciones) ? opciones : [];
  if (valor === null || valor === undefined || valor === '') return lista;
  return lista.some((opcion) => String(opcion.value) === String(valor))
    ? lista
    : [{ value: valor, etiqueta: formato(valor) }, ...lista];
};

function Selector({ id, etiqueta, valor, opciones, textoVacio }) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{etiqueta}</label>
      <select
        id={id}
        disabled
        value={valor ?? ''}
        className="appearance-none bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-md pl-3.5 pr-8 py-2 shadow-2xs opacity-70 cursor-not-allowed"
        title="Catálogo cargado desde la API; selector interactivo en el paso 26"
      >
        <option value="">{textoVacio}</option>
        {opciones.map((opcion) => (
          <option key={`${id}-${opcion.value}`} value={opcion.value}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

export default function FilterBar({
  periodo,
  corteInstitucional,
  trimestre,
  limite,
  seleccion,
  catalogos,
  showContextModal,
  setShowContextModal,
}) {
  const periodos = conValorActual(
    catalogos?.periodosMensuales,
    periodo,
    formatMonth,
  ).slice(0, 24).map((item) => ({ value: item.value, etiqueta: formatMonth(item.value) }));

  const cortesInstitucionales = conValorActual(
    catalogos?.periodosInstitucionales,
    corteInstitucional ?? trimestre,
    (valor) => valor,
  ).slice(0, 12).map((item) => ({
    value: item.value,
    etiqueta: `${formatMonth(item.value)} · ${item.trimestre ? formatQuarter(item.trimestre) : ''}`,
  }));

  const trimestresFonacot = conValorActual(
    catalogos?.trimestresFonacot,
    seleccion?.trimestreFonacot,
    formatQuarter,
  ).map((item) => ({ value: item.value, etiqueta: item.etiqueta ?? formatQuarter(item.value) }));

  const aniosSniiv = conValorActual(
    catalogos?.aniosSniiv,
    seleccion?.anioSniiv,
    formatYear,
  ).map((item) => ({ value: item.value, etiqueta: item.etiqueta ?? formatYear(item.value) }));

  const instituciones = (catalogos?.instituciones ?? []).map((item) => ({
    value: item.claveSeis,
    etiqueta: `${item.claveSeis} · ${item.nombre}`,
  }));

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Selector
        id="select-periodo"
        etiqueta="Período sectorial CNBV"
        valor={periodo}
        opciones={periodos}
        textoVacio="Sin período oficial"
      />
      <Selector
        id="select-instituciones"
        etiqueta="Corte institucional CNBV"
        valor={corteInstitucional ?? ''}
        opciones={cortesInstitucionales}
        textoVacio={`Sin corte · ${limite} cooperativas`}
      />
      <Selector
        id="select-fonacot"
        etiqueta="Trimestre FONACOT"
        valor={seleccion?.trimestreFonacot ?? ''}
        opciones={trimestresFonacot}
        textoVacio="Sin trimestre FONACOT"
      />
      <Selector
        id="select-sniiv"
        etiqueta="Año SNIIV"
        valor={seleccion?.anioSniiv ?? ''}
        opciones={aniosSniiv}
        textoVacio="Sin año SNIIV"
      />
      <Selector
        id="select-clave-seis"
        etiqueta="Clave institucional CNBV"
        valor={seleccion?.claveSeis ?? ''}
        opciones={instituciones}
        textoVacio={`Todas las consultadas (${limite})`}
      />

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
        Selección inicial derivada de catálogos API · filtros interactivos en el paso 26
      </span>
    </div>
  );
}
