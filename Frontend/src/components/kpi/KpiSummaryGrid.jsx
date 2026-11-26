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

export default function KpiSummaryGrid({ corte, indicadores, periodo, fuente, bandasPorKpi }) {
  if (!corte) {
    return (
      <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 text-xs text-slate-500">
        Sin observación de KPIs sectoriales para el corte {periodo}. No se imputan valores ausentes.
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {indicadores.map((indicador) => {
          const banda = bandasPorKpi[indicador.id];
          const numero = toNumberOrNull(corte[indicador.campo]);
          const minimo = toNumberOrNull(banda?.min_2025_pct);
          const maximo = toNumberOrNull(banda?.max_2025_pct);
          const umbral = toNumberOrNull(banda?.umbral_regulatorio_min_pct);
          const alertas = [];

          if (indicador.id === 'KPI-04' && umbral !== null) {
            alertas.push({ texto: `Umbral regulatorio > ${formatPercent(umbral, 0)}`, tono: 'regulatorio' });
            if (numero !== null) {
              alertas.push({
                texto: numero > umbral ? 'Sobre el umbral regulatorio' : 'Bajo el umbral regulatorio',
                tono: numero > umbral ? 'regulatorio' : 'atencion',
              });
            }
          } else if (minimo !== null && maximo !== null) {
            alertas.push({ texto: 'Banda observada 2025 · no regulatoria', tono: 'observado' });
            if (numero !== null && (numero < minimo || numero > maximo)) {
              alertas.push({ texto: 'Fuera de banda observada 2025', tono: 'atencion' });
            }
          }
          if (numero === null) {
            alertas.push({ texto: 'Valor no disponible', tono: 'ausente' });
          }

          let detalle = '';
          if (indicador.id === 'KPI-04' && banda?.umbral_regulatorio_min_pct) {
            detalle = `Umbral regulatorio: superior a ${formatPercent(banda.umbral_regulatorio_min_pct)}`;
          } else if (banda?.tipo_umbral === 'observado_2025') {
            detalle = `Banda observada 2025: ${formatPercent(banda.min_2025_pct)} – ${formatPercent(banda.max_2025_pct)} (no regulatoria)`;
          }

          return (
            <KpiCard
              key={indicador.id}
              accentColor={COLOR_POR_KPI[indicador.id]}
              id={indicador.id}
              nombre={indicador.nombre}
              valor={formatPercentNumber(corte[indicador.campo])}
              unidad={indicador.unidad}
              descripcion={indicador.descripcion}
              detalle={detalle}
              alertas={alertas}
              corte={formatMonth(corte.periodo_ym ?? periodo)}
              fuente={indicador.fuente ?? fuente}
            />
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-slate-400">
        Bandas observadas en 2025: referencia histórica, no límites regulatorios ni metas. Solo
        NICAP cuenta con un umbral regulatorio documentado; las restantes lecturas son descriptivas.
      </p>
    </>
  );
}
