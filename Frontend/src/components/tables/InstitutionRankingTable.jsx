import { formatCurrencyFull, formatInteger, formatPercent, formatQuarter, toNumberOrNull } from '../../utils/formatters';
import { COLORS } from '../../constants/dashboardTheme';

/**
 * Comparativa institucional real (CNBV · boletines BE_SOCAPS).
 * Orden inicial documentado: activo descendente. El orden interactivo
 * corresponde al paso 26.
 */
export default function InstitutionRankingTable({
  instituciones,
  trimestre,
  limitado,
  totalDevueltos,
  nota,
  fuente,
}) {
  const filas = [...instituciones].sort(
    (a, b) => (toNumberOrNull(b.activo_mxn) ?? -Infinity) - (toNumberOrNull(a.activo_mxn) ?? -Infinity),
  );
  const trimestreTexto = formatQuarter(trimestre);

  return (
    <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 flex-1 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">Cooperativas consultadas por tamaño de activo</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Fichas trimestrales · {trimestreTexto} · {filas.length} de {totalDevueltos} fichas
              {limitado ? ' (respuesta limitada por API)' : ''} · orden inicial por activo descendente
            </p>
          </div>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-[#0E7C7B] whitespace-nowrap">
            Institucional
          </span>
        </div>

        <div className="overflow-x-auto max-h-[245px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs text-[11px] font-bold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2 px-2.5 rounded-tl">Institución</th>
                <th className="py-2 px-2.5">Clave</th>
                <th className="py-2 px-2.5 text-right">Activos (MXN)</th>
                <th className="py-2 px-2.5 text-right">IMOR</th>
                <th className="py-2 px-2.5 text-right">ICOR</th>
                <th className="py-2 px-2.5 text-right">NICAP</th>
                <th className="py-2 px-2.5 text-right rounded-tr">M-02</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filas.map((fila) => (
                <tr key={fila.clave_seis} className="hover:bg-slate-50/90 transition-colors group">
                  <td className="py-2.5 px-2.5 font-medium text-slate-800 min-w-[180px]">
                    <div>{fila.institucion_nombre}</div>
                    <div className="text-[10px] text-slate-400">
                      {formatInteger(fila.socios)} socios · {fila.estado_reporte}
                    </div>
                  </td>
                  <td className="py-2.5 px-2.5 text-slate-600 font-medium tabular-nums">
                    {fila.clave_seis}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-bold text-slate-800 whitespace-nowrap">
                    {formatCurrencyFull(fila.activo_mxn)}
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
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
        <div>
          Mostrando <strong>{filas.length}</strong> de <strong>{totalDevueltos}</strong> fichas{' '}
          {limitado ? '(selección limitada por el parámetro limite)' : '(respuesta completa)'}
        </div>
        {nota && <div className="text-[10px] text-slate-400">{nota}</div>}
        <div className="text-[10px] text-slate-400">Fuente: {fuente}</div>
      </div>
    </div>
  );
}
