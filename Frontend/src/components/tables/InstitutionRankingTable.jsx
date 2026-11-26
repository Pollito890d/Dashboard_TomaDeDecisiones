import { useMemo, useState } from 'react';
import {
  formatCurrencyFull,
  formatInteger,
  formatPercent,
  formatQuarter,
  toNumberOrNull,
} from '../../utils/formatters';
import { COLORS } from '../../constants/dashboardTheme';
import EstadoSeccion from '../layout/EstadoSeccion';

/** Comparativa institucional real: CNBV · boletines BE_SOCAPS. */
const COLUMNAS = [
  { clave: 'institucion_nombre', etiqueta: 'Institución', tipo: 'texto', alineacion: 'left' },
  { clave: 'clave_seis', etiqueta: 'Clave', tipo: 'texto', alineacion: 'left' },
  { clave: 'activo_mxn', etiqueta: 'Activos (MXN)', tipo: 'numero', alineacion: 'right' },
  { clave: 'socios', etiqueta: 'Socios', tipo: 'numero', alineacion: 'right' },
  { clave: 'kpi01_imor_publicado_pct', etiqueta: 'IMOR', tipo: 'numero', alineacion: 'right' },
  { clave: 'kpi02_icor_derivado_pct', etiqueta: 'ICOR', tipo: 'numero', alineacion: 'right' },
  { clave: 'kpi04_nicap_publicado_pct', etiqueta: 'NICAP', tipo: 'numero', alineacion: 'right' },
  {
    clave: 'm02_participacion_activo_publicada_pct',
    etiqueta: 'M-02',
    tipo: 'numero',
    alineacion: 'right',
  },
];

const esNulo = (valor, tipo) =>
  valor === null || valor === undefined || valor === ''
  || (tipo === 'numero' && toNumberOrNull(valor) === null);

const comparar = (a, b, columna, direccion) => {
  const valorA = a[columna.clave];
  const valorB = b[columna.clave];
  const nuloA = esNulo(valorA, columna.tipo);
  const nuloB = esNulo(valorB, columna.tipo);
  if (nuloA && nuloB) return 0;
  if (nuloA) return 1;
  if (nuloB) return -1;

  const resultado = columna.tipo === 'numero'
    ? toNumberOrNull(valorA) - toNumberOrNull(valorB)
    : String(valorA).localeCompare(String(valorB), 'es', { sensitivity: 'base' });
  return direccion === 'asc' ? resultado : -resultado;
};

export default function InstitutionRankingTable({
  instituciones,
  trimestre,
  limitado,
  totalDevueltos,
  nota,
  fuente,
  error,
  cargando,
  onReintentar,
  fichaIndividual,
  claveSeis,
}) {
  const [orden, setOrden] = useState({ campo: 'activo_mxn', direccion: 'desc' });
  const filas = useMemo(
    () => [...(instituciones ?? [])].sort((a, b) => {
      const columna = COLUMNAS.find((item) => item.clave === orden.campo) ?? COLUMNAS[2];
      return comparar(a, b, columna, orden.direccion);
    }),
    [instituciones, orden],
  );

  const alternarOrden = (columna) => {
    setOrden((anterior) => anterior.campo === columna.clave
      ? { campo: columna.clave, direccion: anterior.direccion === 'asc' ? 'desc' : 'asc' }
      : { campo: columna.clave, direccion: columna.tipo === 'numero' ? 'desc' : 'asc' });
  };

  const trimestreTexto = formatQuarter(trimestre);
  const titulo = fichaIndividual ? 'Ficha institucional consultada' : 'Cooperativas consultadas';

  const contenido = (
    <>
      {!cargando && !error && filas.length === 0 && (
        <div className="text-xs text-slate-500">
          HTTP 200 sin datos: no hay fichas institucionales publicadas para el corte {trimestreTexto}.
        </div>
      )}

      {filas.length > 0 && (
        <div className="overflow-x-auto max-h-[245px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs text-[11px] font-bold text-slate-600 border-b border-slate-200">
              <tr>
                {COLUMNAS.map((columna) => {
                  const activa = orden.campo === columna.clave;
                  const direccion = activa ? orden.direccion : null;
                  return (
                    <th
                      key={columna.clave}
                      scope="col"
                      aria-sort={direccion === 'asc' ? 'ascending' : direccion === 'desc' ? 'descending' : 'none'}
                      className={`py-2 px-2.5 ${columna.alineacion === 'right' ? 'text-right' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => alternarOrden(columna)}
                        title={`Ordenar por ${columna.etiqueta} (${direccion === 'asc' ? 'ascendente' : direccion === 'desc' ? 'descendente' : 'sin orden activo'})`}
                        aria-label={`Ordenar por ${columna.etiqueta}`}
                        className={`inline-flex items-center gap-1 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B] ${activa ? 'text-[#0E7C7B] underline decoration-2 underline-offset-2' : 'hover:text-slate-900'}`}
                      >
                        <span>{columna.etiqueta}</span>
                        <span className="text-[9px] font-bold" aria-hidden="true">
                          {direccion === 'asc' ? '▲' : direccion === 'desc' ? '▼' : '↕'}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filas.map((fila) => (
                <tr key={fila.clave_seis} className="hover:bg-slate-50/90 transition-colors">
                  <td className="py-2.5 px-2.5 font-medium text-slate-800 min-w-[180px]">
                    <span className="block truncate max-w-[180px]" title={String(fila.institucion_nombre ?? 'No disponible')}>
                      {fila.institucion_nombre ?? 'No disponible'}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatInteger(fila.socios)} socios · {fila.estado_reporte ?? 'Sin estado reportado'}
                    </span>
                  </td>
                  <td className="py-2.5 px-2.5 text-slate-600 font-medium tabular-nums" title={`Clave ${fila.clave_seis}`}>
                    {fila.clave_seis}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-bold text-slate-800 whitespace-nowrap">
                    {formatCurrencyFull(fila.activo_mxn)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right tabular-nums whitespace-nowrap">
                    {formatInteger(fila.socios)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap" style={{ color: COLORS.orangeRed }}>
                    {formatPercent(fila.kpi01_imor_publicado_pct)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-bold text-slate-800 whitespace-nowrap">
                    {formatPercent(fila.kpi02_icor_derivado_pct)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-bold text-slate-800 whitespace-nowrap">
                    {formatPercent(fila.kpi04_nicap_publicado_pct)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-bold text-slate-800 whitespace-nowrap">
                    {formatPercent(fila.m02_participacion_activo_publicada_pct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  return (
    <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 flex-1 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">{titulo}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Fichas trimestrales · {trimestreTexto} · {filas.length} de {totalDevueltos} fichas
              {limitado ? ' (respuesta limitada por API)' : ''}
              {claveSeis ? ` · clave consultada ${claveSeis}` : ''}
            </p>
          </div>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-[#0E7C7B] whitespace-nowrap">
            Institucional
          </span>
        </div>

        <EstadoSeccion
          cargando={cargando}
          error={error}
          onReintentar={onReintentar}
          mensajeCarga="Consultando fichas institucionales…"
        >
          {contenido}
        </EstadoSeccion>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
        <div>
          Orden aplicado sobre las <strong>{totalDevueltos}</strong> fichas efectivamente consultadas
          {limitado ? ' (tope oficial del parámetro limite alcanzado)' : ''}; no representa un ranking de todo el sector.
          {fichaIndividual && ' Una sola cooperativa consultada: se muestra como ficha, no como ranking.'}
        </div>
        {nota && <div className="text-[10px] text-slate-400">{nota}</div>}
        <div className="text-[10px] text-slate-400">Fuente: {fuente}</div>
      </div>
    </div>
  );
}
