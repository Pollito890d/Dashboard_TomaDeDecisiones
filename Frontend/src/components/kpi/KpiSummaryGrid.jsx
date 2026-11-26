import KpiCard from './KpiCard';
import { COLORS } from '../../constants/dashboardTheme';
import { formatCurrencyFull } from '../../utils/formatters';

export default function KpiSummaryGrid({ resumen }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Tarjeta KPI 1: Liquidez disponible */}
      <KpiCard accentColor={COLORS.teal}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">
            Liquidez disponible
          </span>
          <span
            title={`Obligaciones a corto plazo: ${formatCurrencyFull(resumen.obligaciones_corto_plazo)}`}
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-[#0E7C7B]"
          >
            Razón {resumen.razon_liquidez_pct}%
          </span>
        </div>
        <div className="mt-2 text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-none">
          {formatCurrencyFull(resumen.liquidez_disponible)}
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="font-semibold text-[#0E7C7B]">
            + {resumen.variacion_liquidez_pct}% vs. semana anterior
          </span>
        </div>
      </KpiCard>

      {/* Tarjeta KPI 2: Colocación vs. ahorro */}
      <KpiCard accentColor={COLORS.teal}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">
            Colocación vs. ahorro
          </span>
          <span className="text-[10px] font-medium text-slate-400">
            Ahorro: ${(resumen.ahorro_total / 1000000).toFixed(2)}M
          </span>
        </div>
        <div className="mt-2 text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-none">
          {resumen.colocacion_vs_ahorro_pct}%
        </div>
        <div className="mt-3 text-[11px] font-medium text-slate-500">
          Meta de referencia: {resumen.meta_colocacion_pct}%
        </div>
      </KpiCard>

      {/* Tarjeta KPI 3: Tasa de morosidad */}
      <KpiCard accentColor={COLORS.orangeRed}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">
            Tasa de morosidad
          </span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-[#D95D2E]">
            Mora: {formatCurrencyFull(resumen.capital_cartera_vencida)}
          </span>
        </div>
        <div className="mt-2 text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-none">
          {resumen.tasa_morosidad_pct}%
        </div>
        <div className="mt-3 text-[11px] font-semibold text-[#D95D2E]">
          Alerta: revisar préstamos vencidos
        </div>
      </KpiCard>

      {/* Tarjeta KPI 4: Recuperación de cartera */}
      <KpiCard accentColor={COLORS.amber}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">
            Recuperación de cartera
          </span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
            Seguimiento
          </span>
        </div>
        <div className="mt-2 text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-none">
          {resumen.recuperacion_cartera_pct}%
        </div>
        <div className="mt-3 text-[11px] font-semibold text-[#0E7C7B]">
          + {resumen.variacion_recuperacion_pp} pp vs. mes anterior
        </div>
      </KpiCard>
    </div>
  );
}
