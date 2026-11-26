import BotonReintento from './BotonReintento';

/**
 * Estado uniforme de carga y error. Mientras carga, retira las cifras anteriores
 * para que nunca se lean como pertenecientes al corte recién solicitado.
 */
export default function EstadoSeccion({
  cargando,
  error,
  mensajeCarga = 'Consultando información oficial…',
  onReintentar,
  children,
}) {
  if (cargando) {
    return (
      <div
        className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 text-xs text-slate-500"
        role="status"
        aria-live="polite"
      >
        <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-[#0E7C7B] align-[-2px]" aria-hidden="true" />
        {mensajeCarga}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-5 text-xs text-[#B4472A]" role="alert">
        <p className="font-semibold">No fue posible consultar esta sección.</p>
        <p className="mt-1">{error}</p>
        {onReintentar && (
          <div className="mt-3">
            <BotonReintento onClick={onReintentar} etiqueta="Reintentar esta sección" />
          </div>
        )}
      </div>
    );
  }

  return children;
}
