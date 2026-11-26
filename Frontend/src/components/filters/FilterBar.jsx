import { ChevronDown, RotateCcw } from 'lucide-react';
import { formatMonth, formatQuarter, formatYear } from '../../utils/formatters';

/**
 * Filtros reales alimentados por las observaciones de cada fuente en la
 * ejecución activa; no se presentan meses de catálogo sin datos. Cada pestaña
 * monta solo los grupos que le corresponden, pero el estado se conserva en App.
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
    <div>
      <label htmlFor={id} className="mb-1 block text-[10px] font-semibold text-slate-500">
        {etiqueta}
      </label>
      <div className="relative">
        <select
          id={id}
          disabled={deshabilitado}
          value={valor ?? ''}
          onChange={(evento) => onChange(evento.target.value)}
          title={deshabilitado ? motivo : etiqueta}
          aria-label={etiqueta}
          className={`appearance-none bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-md pl-2.5 pr-7 py-1.5 shadow-2xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B] ${
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
        <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
      </div>
    </div>
  );
}

function Grupo({ titulo, cargando, children, nota }) {
  return (
    <fieldset className="flex flex-wrap items-end gap-3" title={nota}>
      <legend className="w-full mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
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
  onRestablecer,
  secciones = ['sectorial'],
  cargando,
}) {
  const incluye = (seccion) => secciones.includes(seccion);
  const periodo = seleccion?.periodo;
  const corte = seleccion?.periodoInstitucional;

  const periodos = conValorActual(catalogos?.periodosMensuales, periodo, formatMonth)
    .map((item) => ({ value: item.value, etiqueta: formatMonth(item.value) }));

  const cortes = conValorActual(catalogos?.periodosInstitucionales, corte, (valor) => valor)
    .map((item) => ({
      value: item.value,
      etiqueta: item.etiqueta ?? formatMonth(item.value),
    }));

  const instituciones = conValorActual(
    catalogos?.instituciones,
    seleccion?.claveSeis,
    (valor) => valor,
  ).map((item) => ({ value: item.claveSeis, etiqueta: item.nombre ?? item.claveSeis }));

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

  const totalCatalogo = catalogos?.totalInstitucionesDevueltas ?? instituciones.length;

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      {incluye('sectorial') && (
        <Grupo
          titulo="Período sectorial"
          nota="Meses con observaciones publicadas por la fuente oficial."
          cargando={cargando?.cnbv}
        >
          <Selector
            id="select-periodo"
            etiqueta="Mes"
            valor={periodo}
            opciones={periodos}
            textoVacio="Sin período publicado"
            onChange={(valor) => onChange('periodo', valor || null)}
          />
        </Grupo>
      )}

      {incluye('institucional') && (
        <Grupo
          titulo="Corte y cooperativa"
          nota="Cortes trimestrales publicados. El selector incluye el catálogo completo de cooperativas."
          cargando={cargando?.instituciones}
        >
          <Selector
            id="select-corte-institucional"
            etiqueta="Trimestre"
            valor={corte}
            opciones={cortes}
            textoVacio="Sin corte publicado"
            onChange={(valor) => onChange('periodoInstitucional', valor || null)}
          />
          <Selector
            id="select-clave-seis"
            etiqueta="Cooperativa"
            valor={seleccion?.claveSeis}
            opciones={instituciones}
            textoVacio={`Todas (${totalCatalogo})`}
            onChange={(valor) => onChange('claveSeis', valor || null)}
            deshabilitado={instituciones.length === 0}
            motivo="No hay cooperativas en el catálogo oficial"
          />
        </Grupo>
      )}

      {incluye('fonacot') && (
        <Grupo
          titulo="FONACOT"
          nota="Trimestres y desgloses publicados por la fuente; la entidad y el género se aplican al desglose oficial."
          cargando={cargando?.fonacot}
        >
          <Selector
            id="select-fonacot-trimestre"
            etiqueta="Trimestre"
            valor={seleccion?.trimestreFonacot}
            opciones={trimestresFonacot}
            textoVacio="Sin trimestre publicado"
            onChange={(valor) => onChange('trimestreFonacot', valor || null)}
          />
          <Selector
            id="select-fonacot-entidad"
            etiqueta="Entidad"
            valor={seleccion?.entidadFonacot}
            opciones={opcionesEntidadFonacot}
            textoVacio="Nacional"
            onChange={(valor) => onChange('entidadFonacot', valor || null)}
            deshabilitado={opcionesEntidadFonacot.length === 0}
            motivo="La respuesta oficial no incluye desglose por entidad para este corte"
          />
          <Selector
            id="select-fonacot-genero"
            etiqueta="Género"
            valor={seleccion?.generoFonacot}
            opciones={[{ value: 'mujeres', etiqueta: 'Mujeres' }, { value: 'hombres', etiqueta: 'Hombres' }]}
            textoVacio="Sin filtro"
            onChange={(valor) => onChange('generoFonacot', valor || null)}
          />
        </Grupo>
      )}

      {incluye('sniiv') && (
        <Grupo
          titulo="SNIIV"
          nota="Años con observaciones publicadas; la entidad y el género se aplican al desglose oficial."
          cargando={cargando?.sniiv}
        >
          <Selector
            id="select-sniiv-anio"
            etiqueta="Año"
            valor={seleccion?.anioSniiv}
            opciones={aniosSniiv}
            textoVacio="Sin año publicado"
            onChange={(valor) => onChange('anioSniiv', valor || null)}
          />
          <Selector
            id="select-sniiv-entidad"
            etiqueta="Entidad"
            valor={seleccion?.entidadSniiv}
            opciones={opcionesEntidadSniiv}
            textoVacio="Nacional"
            onChange={(valor) => onChange('entidadSniiv', valor || null)}
            deshabilitado={opcionesEntidadSniiv.length === 0}
            motivo="La respuesta oficial no incluye desglose por entidad para este año"
          />
          <Selector
            id="select-sniiv-genero"
            etiqueta="Género"
            valor={seleccion?.generoSniiv}
            opciones={[{ value: 'mujeres', etiqueta: 'Mujeres' }, { value: 'hombres', etiqueta: 'Hombres' }]}
            textoVacio="Sin filtro"
            onChange={(valor) => onChange('generoSniiv', valor || null)}
          />
        </Grupo>
      )}

      {onRestablecer && (
        <button
          type="button"
          onClick={onRestablecer}
          title="Volver a los filtros iniciales de esta sección"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B]"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Restablecer
        </button>
      )}
    </div>
  );
}
