import { Users } from 'lucide-react';
import ContextMetric from '../layout/ContextMetric';
import EstadoSeccion from '../layout/EstadoSeccion';
import {
  formatCompactCurrency,
  formatInteger,
  formatNoDisponible,
  formatPercent,
  formatQuarter,
} from '../../utils/formatters';

/**
 * Contexto externo M-03: FONACOT, separado del universo SOCAP.
 * Los filtros de entidad y género se aplican sobre el desglose oficial
 * (`por_ambito`) recibido en la misma respuesta; nunca se reutiliza el total
 * nacional como si correspondiera a un filtro.
 */
export default function FonacotContextStrip({
  datos,
  trimestre,
  fuente,
  error,
  sinDatos,
  desglose,
  entidad,
  genero,
  loading,
  onReintentar,
}) {
  const filaEntidad = entidad
    ? (desglose ?? []).find(
        (fila) => fila?.tipo_ambito === 'entidad' && fila?.ambito_canonico === entidad,
      ) ?? null
    : null;
  const entidadSinFila = Boolean(entidad) && !filaEntidad;
  const mujeres = genero === 'mujeres';
  const hombres = genero === 'hombres';

  const creditos = filaEntidad
    ? mujeres ? filaEntidad.creditos_mujeres : hombres ? filaEntidad.creditos_hombres : filaEntidad.creditos_totales
    : mujeres ? datos?.creditos_mujeres_nacional : hombres ? datos?.creditos_hombres_nacional : datos?.creditos_totales_nacional;
  const monto = filaEntidad
    ? mujeres ? filaEntidad.monto_mujeres_mxn : hombres ? filaEntidad.monto_hombres_mxn : filaEntidad.monto_total_mxn
    : mujeres ? datos?.monto_mujeres_nacional_mxn : hombres ? datos?.monto_hombres_nacional_mxn : datos?.monto_total_nacional_mxn;

  // Estas participaciones y el ticket son cocientes calculados por la fuente
  // para el ámbito completo; no se fabrican versiones filtradas por género.
  const participacionCreditos = genero
    ? null
    : (filaEntidad?.m03_participacion_femenina_creditos_pct ?? datos?.m03_participacion_femenina_creditos_pct);
  const participacionMonto = genero
    ? null
    : (filaEntidad?.m03_participacion_femenina_monto_pct ?? datos?.m03_participacion_femenina_monto_pct);
  const ticket = genero
    ? null
    : (filaEntidad?.m03_ticket_promedio_mxn ?? datos?.m03_ticket_promedio_nacional_mxn);
  const appMovil = !filaEntidad && !genero ? datos?.creditos_canal_app_movil : null;
  const appMovilMonto = !filaEntidad && !genero ? datos?.monto_canal_app_movil_mxn : null;

  const alcance = entidadSinFila
    ? `Sin desglose para ${entidad}`
    : filaEntidad
      ? `Entidad ${filaEntidad.ambito_canonico}`
      : 'Total nacional';
  const generoTexto = mujeres ? ' · mujeres' : hombres ? ' · hombres' : '';

  const contenido = (
    <>
      {entidadSinFila ? (
        <div className="text-xs text-slate-500">
          El desglose oficial no contiene la entidad {entidad} para el corte {formatQuarter(trimestre)}.
          No se sustituye por el total nacional.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <ContextMetric etiqueta="Créditos ejercidos" valor={formatInteger(creditos)} />
          <ContextMetric etiqueta="Monto total" valor={formatCompactCurrency(monto)} />
          <ContextMetric
            etiqueta="Participación femenina en créditos"
            valor={formatPercent(participacionCreditos)}
          />
          <ContextMetric
            etiqueta="Participación femenina en monto"
            valor={formatPercent(participacionMonto)}
          />
          <ContextMetric etiqueta="Ticket promedio" valor={formatCompactCurrency(ticket)} />
          <ContextMetric
            etiqueta="Canal APP MOVIL"
            valor={formatInteger(appMovil)}
            nota={appMovil === null
              ? 'No disponible para este filtro'
              : formatCompactCurrency(appMovilMonto)}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#0E7C7B]" aria-hidden="true" />
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
      <p className="text-[10px] text-slate-400 mb-2">
        Granularidad: trimestral · Alcance: {alcance}{generoTexto} · filtros locales sobre el desglose oficial recibido
      </p>

      <EstadoSeccion
        cargando={loading}
        error={error}
        onReintentar={onReintentar}
        mensajeCarga="Consultando el contexto FONACOT…"
      >
        {sinDatos && !datos ? (
          <div className="text-xs text-slate-500">
            HTTP 200 sin datos: FONACOT no publica información para el corte {formatQuarter(trimestre)}.
          </div>
        ) : entidadSinFila ? (
          contenido
        ) : datos ? (
          contenido
        ) : (
          <div className="text-xs text-slate-500">{formatNoDisponible()}</div>
        )}
      </EstadoSeccion>

      <div className="mt-auto pt-3 text-[10px] text-slate-400 space-y-1">
        <div>
          Los créditos contabilizan operaciones, no personas únicas. APP MOVIL es un canal, no una
          entidad federativa: solo se muestra en el total nacional sin filtro de género.
        </div>
        {(genero || entidad) && (
          <div>
            Con filtro aplicado, las participaciones, el ticket y el canal APP MOVIL se muestran como
            «No disponible» cuando la respuesta no publica ese desglose específico.
          </div>
        )}
        <div>Fuente: {fuente}</div>
      </div>
    </div>
  );
}
