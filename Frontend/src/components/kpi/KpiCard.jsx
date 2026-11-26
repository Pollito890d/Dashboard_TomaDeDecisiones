import { useEffect, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';
import { formatNoDisponible } from '../../utils/formatters';

/**
 * Tarjeta compacta del resumen: cifra y una línea de contexto. Las definiciones
 * completas viven en el popover del ícono (i), para no repetir texto en las
 * cuatro tarjetas ni aumentar su altura.
 */
export default function KpiCard({
  accentColor,
  nombre,
  valor,
  unidad,
  descripcion,
  alerta = null,
  detalle = {},
}) {
  const [abierto, setAbierto] = useState(false);
  const articuloRef = useRef(null);
  const botonRef = useRef(null);
  const sinValor = valor === formatNoDisponible();

  useEffect(() => {
    if (!abierto) return undefined;

    const cerrarSiFuera = (evento) => {
      if (!articuloRef.current?.contains(evento.target)) setAbierto(false);
    };
    const cerrarConEscape = (evento) => {
      if (evento.key === 'Escape') {
        setAbierto(false);
        botonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', cerrarSiFuera);
    document.addEventListener('touchstart', cerrarSiFuera, { passive: true });
    document.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.removeEventListener('mousedown', cerrarSiFuera);
      document.removeEventListener('touchstart', cerrarSiFuera);
      document.removeEventListener('keydown', cerrarConEscape);
    };
  }, [abierto]);

  const secciones = [
    ['Significado:', detalle.significado],
    ['Interpretación:', detalle.interpretacion],
    ['Utilidad financiera:', detalle.utilidad],
    ['Fórmula:', detalle.formula],
    ['Fuente:', detalle.fuente],
    [null, detalle.umbralBanda],
    [null, detalle.sinValor ? 'Valor no publicado en este corte: no se imputa.' : null],
  ].filter(([, contenido]) => Boolean(contenido));

  return (
    <article ref={articuloRef} className="relative h-full rounded-md border border-slate-200/90 bg-white shadow-2xs">
      <div className="h-1 w-full rounded-t-md" style={{ backgroundColor: accentColor }} />
      <div className="p-3 sm:p-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-600 leading-tight">{nombre}</span>
          <button
            ref={botonRef}
            type="button"
            onClick={() => setAbierto((anterior) => !anterior)}
            aria-label={`Ver detalle de ${nombre}`}
            aria-expanded={abierto}
            aria-haspopup="dialog"
            className="shrink-0 rounded p-0.5 text-slate-400 hover:text-[#0E7C7B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B]"
          >
            <Info className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-1.5 text-[24px] font-extrabold text-slate-900 tracking-tight leading-none">
          {valor}
          {!sinValor && unidad && (
            <span className="ml-1 text-xs font-semibold text-slate-500">{unidad}</span>
          )}
        </div>

        <p className="mt-1.5 text-[11px] leading-snug text-slate-600" title={descripcion}>
          {descripcion}
        </p>

        {alerta && (
          <p className="mt-1.5 inline-block rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
            {alerta}
          </p>
        )}
      </div>

      {abierto && (
        <div
          role="dialog"
          aria-label={`Detalle de ${nombre}`}
          className="absolute right-2 top-7 z-30 w-[min(20rem,calc(100vw_-_2rem))] rounded-md border border-slate-200 bg-white p-3 text-left shadow-lg"
        >
          <div className="flex items-start justify-between gap-2">
            <h5 className="text-[11px] font-bold text-slate-900">{nombre}</h5>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar detalle"
              className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0E7C7B]"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          <dl className="mt-2 space-y-1.5 text-[10px] leading-snug text-slate-600">
            {secciones.map(([etiqueta, contenido], indice) => (
              <div key={etiqueta ?? `nota-${indice}`}>
                {etiqueta && <dt className="inline font-semibold text-slate-700">{etiqueta} </dt>}
                <dd className="inline">{contenido}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </article>
  );
}
