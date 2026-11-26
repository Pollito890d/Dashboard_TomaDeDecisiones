import KpiCard from './KpiCard';
import { COLORS } from '../../constants/dashboardTheme';
import {
  formatMonth,
  formatPercent,
  formatPercentNumber,
  toNumberOrNull,
} from '../../utils/formatters';

const COLOR_POR_KPI = {
  'KPI-01': COLORS.orangeRed,
  'KPI-02': COLORS.teal,
  'KPI-03': COLORS.teal,
  'KPI-04': COLORS.teal,
  'KPI-05': COLORS.tealLight,
  'KPI-06': COLORS.slateMuted,
  'KPI-07': COLORS.teal,
  'KPI-08': COLORS.amber,
  'KPI-09': COLORS.amber,
};

function KpiCompacto({ indicador, corte, tooltip }) {
  const numero = toNumberOrNull(corte[indicador.campo]);

  return (
    <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs px-3 py-2.5" title={tooltip}>
      <div className="text-[11px] font-semibold text-slate-600 leading-tight truncate">
        {indicador.nombreCorto ?? indicador.nombre}
      </div>
      <div className="mt-1 text-base font-extrabold text-slate-900 leading-none">
        {formatPercentNumber(corte[indicador.campo])}
        {numero !== null && (
          <span className="ml-0.5 text-[10px] font-semibold text-slate-500">{indicador.unidad}</span>
        )}
      </div>
      <div
        className="mt-1 text-[11px] leading-[1.2] text-slate-600 line-clamp-2"
        title={indicador.mide ?? indicador.descripcion}
      >
        {indicador.mide ?? indicador.descripcion}
      </div>
    </div>
  );
}

/**
 * Reutilizado para las cuatro tarjetas principales y para la franja compacta
 * de rentabilidad y eficiencia (`ids` + `compacta`).
 */
export default function KpiSummaryGrid({
  corte,
  indicadores,
  periodo,
  fuente,
  bandasPorKpi = {},
  ids = null,
  compacta = false,
}) {
  const lista = (ids?.length ? ids : (indicadores ?? []).map((item) => item.id))
    .map((id) => (indicadores ?? []).find((item) => item.id === id))
    .filter(Boolean);

  if (!corte) {
    return compacta ? null : (
      <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 text-xs text-slate-500">
        El corte {formatMonth(periodo)} no tiene observaciones de KPIs. No se imputan valores ausentes.
      </div>
    );
  }

  const detalleIndicador = (indicador) => {
    const banda = bandasPorKpi[indicador.id];
    const numero = toNumberOrNull(corte[indicador.campo]);
    const umbral = toNumberOrNull(banda?.umbral_regulatorio_min_pct);
    const minimo = toNumberOrNull(banda?.min_2025_pct);
    const maximo = toNumberOrNull(banda?.max_2025_pct);
    let umbralBanda = null;

    if (indicador.id === 'KPI-04' && umbral !== null) {
      umbralBanda = `Umbral regulatorio documentado: superior a ${formatPercent(umbral, 0)}.`;
    } else if (minimo !== null && maximo !== null) {
      umbralBanda = `Banda observada en 2025: ${formatPercent(minimo)} – ${formatPercent(maximo)}. Referencia histórica, no meta.`;
    }

    return {
      significado: indicador.mide ?? indicador.descripcion,
      interpretacion: indicador.lectura ?? indicador.interpretacion,
      utilidad: indicador.evalua,
      formula: indicador.formula,
      fuente: indicador.fuente ?? fuente,
      umbralBanda,
      sinValor: numero === null,
    };
  };

  const tooltipDe = (detalle) => [
    `Significado: ${detalle.significado}`,
    `Interpretación: ${detalle.interpretacion}`,
    `Utilidad financiera: ${detalle.utilidad}`,
    `Fórmula: ${detalle.formula}`,
    `Fuente: ${detalle.fuente}`,
    detalle.umbralBanda,
    detalle.sinValor ? 'Valor no publicado en este corte: no se imputa.' : null,
  ].filter(Boolean).join('\n');

  /** Alerta breve y permanente: hoy solo NICAP tiene umbral regulatorio documentado. */
  const alertaDe = (indicador) => {
    if (indicador.id !== 'KPI-04') return null;
    const umbral = toNumberOrNull(bandasPorKpi[indicador.id]?.umbral_regulatorio_min_pct);
    if (umbral === null) return null;
    const numero = toNumberOrNull(corte[indicador.campo]);
    const textoUmbral = `Umbral regulatorio > ${formatPercent(umbral, 0)}`;
    return numero !== null && numero < umbral ? `Bajo ${textoUmbral}` : textoUmbral;
  };

  return (
    <>
      {!compacta && (
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
          <span>
            <span className="font-semibold text-slate-600">Corte:</span>{' '}
            {formatMonth(corte.periodo_ym ?? periodo)}
          </span>
          {fuente && (
            <span>
              <span className="font-semibold text-slate-600">Fuente:</span> {fuente}
            </span>
          )}
        </div>
      )}

      <div
        className={
          compacta
            ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2'
            : 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3'
        }
      >
        {lista.map((indicador) => {
          const detalle = detalleIndicador(indicador);
          if (compacta) {
            return (
              <KpiCompacto
                key={indicador.id}
                indicador={indicador}
                corte={corte}
                tooltip={tooltipDe(detalle)}
              />
            );
          }

          return (
            <KpiCard
              key={indicador.id}
              accentColor={COLOR_POR_KPI[indicador.id]}
              nombre={indicador.nombreCorto ?? indicador.nombre}
              valor={formatPercentNumber(corte[indicador.campo])}
              unidad={indicador.unidad}
              descripcion={detalle.significado}
              alerta={alertaDe(indicador)}
              detalle={detalle}
            />
          );
        })}
      </div>

      {!compacta && (
        <p className="mt-2 text-[10px] text-slate-400">
          Las referencias históricas y el umbral regulatorio de NICAP se detallan en el ícono (i) de
          cada tarjeta; no son metas.
        </p>
      )}
    </>
  );
}
