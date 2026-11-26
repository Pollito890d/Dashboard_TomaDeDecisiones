import { Users } from 'lucide-react';

export default function FonacotContextStrip({ fonacotComparativa }) {
  // Bloque integrado del 8° Indicador (Datos Abiertos FONACOT - Página 2, 8 y 15 del PDF)
  return (
    <div className="mt-6 pt-4 border-t border-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/90 border border-slate-200/70 rounded-md px-3.5 py-2.5">
        <div className="flex items-start sm:items-center gap-2.5">
          <Users className="w-4 h-4 text-[#0E7C7B] shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-800">
                Contexto Externo FONACOT (Equidad y Participación Femenina)
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-teal-50 text-[#0E7C7B] rounded border border-teal-200/60">
                +{fonacotComparativa.brecha_pp} pp vs. mercado
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Socias en la Caja: <strong className="text-[#0E7C7B]">{fonacotComparativa.pct_socias_caja}%</strong> ({fonacotComparativa.total_socias_activas} socias) vs. Mujeres con crédito FONACOT: <strong className="text-slate-700">{fonacotComparativa.pct_mujeres_fonacot}%</strong> ({fonacotComparativa.trimestre_fuente})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
