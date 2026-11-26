/**
 * Estructura común de las cuatro tarjetas del resumen ejecutivo.
 * El contenido interior se pasa como children para no alterar los badges,
 * textos secundarios ni jerarquías específicas de cada indicador.
 */
export default function KpiCard({ accentColor, children }) {
  return (
    <article className="bg-white rounded-md border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
      <div className="h-[4px] w-full" style={{ backgroundColor: accentColor }} />
      <div className="p-4 sm:p-5">{children}</div>
    </article>
  );
}
