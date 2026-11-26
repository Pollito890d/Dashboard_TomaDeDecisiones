import { Building2 } from 'lucide-react';
import ContextMetric from '../layout/ContextMetric';
import {
  formatCompactCurrency,
  formatInteger,
  formatPercent,
  formatYear,
} from '../../utils/formatters';

/** Contexto externo M-04: SNIIV, con granularidad anual y universo propio. */
export default function SniivContextStrip({ datos, anio, fuente }) {
  return (
    <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#0E7C7B]" />
          <h3 className="text-[15px] font-bold text-slate-900">
            Contexto externo · SNIIV (M-04)
          </h3>
        </div>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-[#0E7C7B] whitespace-nowrap">
          Anual {formatYear(anio)}
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Financiamientos de vivienda · corte anual, no mezclado con las SOCAP
      </p>

      {!datos ? (
        <div className="text-xs text-slate-500">Sin información oficial disponible para el año solicitado.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <ContextMetric etiqueta="Acciones de financiamiento" valor={formatInteger(datos.m04_acciones_totales)} />
          <ContextMetric etiqueta="Monto total" valor={formatCompactCurrency(datos.m04_monto_total_mxn)} />
          <ContextMetric
            etiqueta="Promedio por acción"
            valor={formatCompactCurrency(datos.m04_promedio_por_accion_mxn)}
          />
          <ContextMetric
            etiqueta="Participación femenina en acciones"
            valor={formatPercent(datos.m04_participacion_mujeres_acciones_pct)}
          />
          <ContextMetric
            etiqueta="Participación femenina en monto"
            valor={formatPercent(datos.m04_participacion_mujeres_monto_pct)}
          />
          <ContextMetric
            etiqueta="Participación INFONAVIT"
            valor={formatPercent(datos.m04_participacion_infonavit_acciones_pct)}
            nota={`${formatInteger(datos.acciones_infonavit)} acciones`}
          />
        </div>
      )}

      <div className="mt-auto pt-3 text-[10px] text-slate-400 space-y-1">
        <div>
          Las acciones son operaciones de financiamiento, no personas únicas. Las filas sin sexo
          se conservan en el total y se excluyen solo del denominador de género
          ({formatInteger(datos?.filas_sin_sexo)} filas).
        </div>
        <div>Fuente: {fuente}</div>
      </div>
    </div>
  );
}
