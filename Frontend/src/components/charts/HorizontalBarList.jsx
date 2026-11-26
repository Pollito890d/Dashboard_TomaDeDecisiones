import { toNumberOrNull } from '../../utils/formatters';

/**
 * Barras horizontales reutilizables para comparativas institucionales.
 * Conserva el marcado y los anchos mínimos de las barras del wireframe.
 */
export default function HorizontalBarList({
  title,
  items,
  labelKey,
  valueKey,
  color,
  formatValue,
  descripcion,
}) {
  const valores = items.map((item) => toNumberOrNull(item[valueKey])).filter((v) => v !== null);
  const maximo = valores.length ? Math.max(...valores, 0) : 1;

  return (
    <div>
      <h4 className="text-sm font-bold text-slate-900 mb-1.5">{title}</h4>
      {descripcion && (
        <p className="text-[10px] text-slate-500 -mt-0.5 mb-3">{descripcion}</p>
      )}
      <div className="space-y-4">
        {items.map((item) => {
          const numero = toNumberOrNull(item[valueKey]);
          const etiqueta = item[labelKey] ?? 'No disponible';
          const ancho = numero === null ? 0 : Math.round((numero / maximo) * 100);
          const texto = formatValue(item[valueKey]);

          return (
            <div key={`${item.clave_seis}-${valueKey}`} className="group">
              <div className="flex items-center gap-3">
                <span
                  className="w-28 sm:w-36 text-xs font-medium text-slate-600 shrink-0 truncate"
                  title={String(etiqueta)}
                >
                  {etiqueta}
                </span>
                <div className="flex-1 flex items-center gap-2.5">
                  <div
                    className="h-3.5 rounded-sm transition-all duration-300"
                    style={{
                      width: `${numero === null ? 0 : Math.max(ancho, 12)}%`,
                      backgroundColor: numero === null ? '#E2E8F0' : color,
                    }}
                    title={texto}
                  />
                  <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                    {texto}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
