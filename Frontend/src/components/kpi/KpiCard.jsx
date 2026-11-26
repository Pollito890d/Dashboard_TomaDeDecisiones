import { formatNoDisponible } from '../../utils/formatters';

/**
 * Tarjeta oficial: mantiene el marcado original (barra superior de 4 px,
 * padding y jerarquía tipográfica) y añade corte, fuente y descripción.
 * La cifra llega sin símbolo de unidad; aquí se añade `unidad` una sola vez
 * (por ejemplo, `% anual` en los indicadores anualizados).
 */
export default function KpiCard({
  accentColor,
  id,
  nombre,
  valor,
  unidad,
  descripcion,
  detalle,
  corte,
  fuente,
}) {
  return (
    <article className="bg-white rounded-md border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
      <div className="h-[4px] w-full" style={{ backgroundColor: accentColor }} />
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">{nombre}</span>
          {id && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-[#0E7C7B] whitespace-nowrap">
              {id}
            </span>
          )}
        </div>
        <div className="mt-2 text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-none">
          {valor}
          {valor !== formatNoDisponible() && unidad && (
            <span className="ml-1 text-sm font-semibold text-slate-500">{unidad}</span>
          )}
        </div>
        <div className="mt-3 text-[11px] font-medium text-slate-500">{descripcion}</div>
        {detalle && (
          <div className="mt-1.5 text-[10px] text-slate-400">{detalle}</div>
        )}
        <div className="mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400 space-y-0.5">
          <div>Corte: {corte}</div>
          <div>Fuente: {fuente}</div>
        </div>
      </div>
    </article>
  );
}
