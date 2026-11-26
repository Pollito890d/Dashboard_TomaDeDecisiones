import { Database } from 'lucide-react';

export default function KpiInfoPanel({ open, onClose, resumen }) {
  if (!open) return null;

  return (
    /* Panel desplegable opcional con la matriz técnica de los 8 KPIs para la exposición con el profesor */
    <div className="mt-4 bg-white border border-slate-200 rounded-md p-4 shadow-xs text-xs text-slate-700">
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#0E7C7B]" />
          <span className="font-bold text-slate-900">
            Mapeo de los 8 Indicadores (Sección 5.5.2 Visualización Efectiva + Storytelling)
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 font-semibold"
        >
          Cerrar ✕
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
          <span className="font-bold text-[#0E7C7B]">KPI 1 · Liquidez vs. Obligaciones:</span>
          <p className="text-[11px] text-slate-600 mt-0.5">
            <code>ahorro_total - capital_cartera_activa</code> frente a obligaciones a 30 días. Razón actual: <strong>{resumen.razon_liquidez_pct}%</strong>.
          </p>
        </div>
        <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
          <span className="font-bold text-[#0E7C7B]">KPI 2 · Índice Colocación vs. Ahorro:</span>
          <p className="text-[11px] text-slate-600 mt-0.5">
            <code>SUM(Prestamo.monto_autorizado) / SUM(Cuenta_Ahorro.saldo)</code>. Límite de alerta: <strong>80%</strong>.
          </p>
        </div>
        <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
          <span className="font-bold text-[#D95D2E]">KPI 3 · Tasa de Morosidad (%):</span>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Proporción de cartera vencida (<code>Prestamo.estado = 'Vencido'</code>) sobre cartera activa total.
          </p>
        </div>
        <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
          <span className="font-bold text-[#D97706]">KPI 4 · Recuperación de Cartera (%):</span>
          <p className="text-[11px] text-slate-600 mt-0.5">
            <code>SUM(Cuota_Prestamo.monto_pagado) / SUM(Cuota_Prestamo.monto_esperado)</code> en cuotas vencidas.
          </p>
        </div>
        <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
          <span className="font-bold text-slate-800">KPI 5 · Evolución Semanal (S1-S8):</span>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Doble serie temporal desde tabla de hechos <code>Posicion_Semanal</code> con corte dominical.
          </p>
        </div>
        <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
          <span className="font-bold text-slate-800">KPI 6 · Préstamos por Estado y Tipo:</span>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Causa raíz de morosidad por estado (Vigentes, Vencidos, Liquidados) y modalidad (Personal, Negocio, Emergencia).
          </p>
        </div>
        <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
          <span className="font-bold text-slate-800">KPI 7 · Priorización de Cobranza:</span>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Ranking operativo de socios por antigüedad de atraso (días) y saldo pendiente en <code>Cuota_Prestamo</code>.
          </p>
        </div>
        <div className="p-2.5 rounded bg-teal-50/50 border border-teal-200/60">
          <span className="font-bold text-[#0E7C7B]">KPI 8 · Referencia Externa FONACOT:</span>
          <p className="text-[11px] text-slate-600 mt-0.5">
            Cruce de <code>Socio.genero = 'M'</code> vs. <code>Ref_Credito_Fonacot</code> por <code>Entidad_Federativa</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
