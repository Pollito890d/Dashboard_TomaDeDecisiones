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
    etiqueta: 'Participación',
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
  totalCatalogo,
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
  const titulo = fichaIndividual ? 'Ficha de la cooperativa consultada' : 'Detalle por cooperativa';

  return (
    <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">{titulo}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {fichaIndividual
              ? `Trimestre ${trimestreTexto} · ficha seleccionada${claveSeis ? ` · clave ${claveSeis}` : ''}`
              : `Trimestre ${trimestreTexto} · ${filas.length} fichas consultadas`}
          </p>
        </div>
        {fichaIndividual && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-[#0E7C7B] whitespace-nowrap">
            Ficha individual
          </span>
        )}
      </div>

      <EstadoSeccion
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        mensajeCarga="Consultando fichas institucionales…"
      >
        {!cargando && !error && filas.length === 0 ? (
          <p className="text-xs text-slate-500">
            No hay fichas publicadas para el corte {trimestreTexto}. No se imputan valores ausentes.
          </p>
        ) : (
          filas.length > 0 && (
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
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
                            title={`Ordenar por ${columna.etiqueta}`}
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
                      <td className="py-2.5 px-2.5 font-medium text-slate-800 min-w-[200px]">
                        <span className="block truncate max-w-[220px]" title={String(fila.institucion_nombre ?? 'No disponible')}>
                          {fila.institucion_nombre ?? 'No disponible'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatInteger(fila.socios)} socios · {fila.estado_reporte ?? 'Sin estado reportado'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2.5 text-slate-600 font-medium tabular-nums" title="Clave oficial de la cooperativa">
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
          )
        )}
      </EstadoSeccion>

      <details className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400">
        <summary className="cursor-pointer font-semibold">Alcance y fuente de la tabla</summary>
        <p className="mt-1">
          El orden se aplica sobre las {totalDevueltos} fichas consultadas. El selector permite elegir
          entre las {totalCatalogo} cooperativas del catálogo, pero la tabla solo muestra el detalle
          publicado para el corte.
          {fichaIndividual && ' Al seleccionar una cooperativa se presenta una ficha, no un ranking.'}
        </p>
        {nota && <p className="mt-1">{nota}</p>}
        <p className="mt-1">Fuente: {fuente}</p>
      </details>
    </div>
  );
}
