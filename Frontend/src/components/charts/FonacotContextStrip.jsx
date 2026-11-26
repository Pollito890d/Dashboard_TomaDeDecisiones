import { Users } from 'lucide-react';
import ContextMetric from '../layout/ContextMetric';
import {
  formatCompactCurrency,
  formatInteger,
  formatPercent,
  formatQuarter,
} from '../../utils/formatters';

/** Contexto externo M-03: FONACOT, separado del universo SOCAP. */
export default function FonacotContextStrip({ datos, trimestre, fuente }) {
  return (
    <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#0E7C7B]" />
          <h3 className="text-[15px] font-bold text-slate-900">
            Contexto externo · FONACOT (M-03)
          </h3>
        </div>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-[#0E7C7B] whitespace-nowrap">
          {formatQuarter(trimestre)}
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Crédito al trabajo · universo externo, no atribuible a una cooperativa
      </p>

      {!datos ? (
        <div className="text-xs text-slate-500">Sin información oficial disponible para el corte solicitado.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <ContextMetric etiqueta="Créditos ejercidos" valor={formatInteger(datos.creditos_totales_nacional)} />
          <ContextMetric etiqueta="Monto total" valor={formatCompactCurrency(datos.monto_total_nacional_mxn)} />
          <ContextMetric
            etiqueta="Participación femenina en créditos"
            valor={formatPercent(datos.m03_participacion_femenina_creditos_pct)}
          />
          <ContextMetric
            etiqueta="Participación femenina en monto"
            valor={formatPercent(datos.m03_participacion_femenina_monto_pct)}
          />
          <ContextMetric
            etiqueta="Ticket promedio"
            valor={formatCompactCurrency(datos.m03_ticket_promedio_nacional_mxn)}
          />
          <ContextMetric
            etiqueta="Canal APP MOVIL"
            valor={formatInteger(datos.creditos_canal_app_movil)}
            nota={formatCompactCurrency(datos.monto_canal_app_movil_mxn)}
          />
        </div>
      )}

      <div className="mt-auto pt-3 text-[10px] text-slate-400 space-y-1">
        <div>
          Los créditos contabilizan operaciones, no personas únicas. APP MOVIL es un canal, no una entidad federativa.
        </div>
        <div>Fuente: {fuente}</div>
      </div>
    </div>
  );
}
