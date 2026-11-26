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
  // para el ámbito completo; no se fabrican versiones filtradas por género
  // ni se sustituye un valor estatal ausente por el agregado nacional.
  const participacionCreditos = genero
    ? null
    : filaEntidad
      ? filaEntidad.m03_participacion_femenina_creditos_pct
      : datos?.m03_participacion_femenina_creditos_pct;
  const participacionMonto = genero
    ? null
    : filaEntidad
      ? filaEntidad.m03_participacion_femenina_monto_pct
      : datos?.m03_participacion_femenina_monto_pct;
  const ticket = genero
    ? null
    : filaEntidad
      ? filaEntidad.m03_ticket_promedio_mxn
      : datos?.m03_ticket_promedio_nacional_mxn;
  const appMovil = !filaEntidad && !genero ? datos?.creditos_canal_app_movil : null;
  const appMovilMonto = !filaEntidad && !genero ? datos?.monto_canal_app_movil_mxn : null;

  const alcance = entidadSinFila
    ? `sin desglose para ${entidad}`
    : filaEntidad
      ? `Entidad ${filaEntidad.ambito_canonico}`
      : 'Total nacional';
  const generoTexto = mujeres ? ' · mujeres' : hombres ? ' · hombres' : '';

  return (
    <EstadoSeccion
      cargando={loading}
      error={error}
      onReintentar={onReintentar}
      mensajeCarga="Consultando el contexto FONACOT…"
    >
      {sinDatos && !datos ? (
        <p className="text-xs text-slate-500">
          FONACOT no publica información para el corte {formatQuarter(trimestre)}. No se imputan valores ausentes.
        </p>
      ) : entidadSinFila ? (
        <p className="text-xs text-slate-500">
          La fuente no publica desglose para {entidad} en {formatQuarter(trimestre)}; no se sustituye por el total nacional.
        </p>
      ) : datos ? (
        <>
          <p className="text-[11px] text-slate-500 mb-2">
            Alcance: {alcance}{generoTexto} · {formatQuarter(trimestre)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <ContextMetric etiqueta="Créditos ejercidos" valor={formatInteger(creditos)} />
            <ContextMetric etiqueta="Monto total" valor={formatCompactCurrency(monto)} />
            <ContextMetric
              etiqueta="Participación femenina en créditos"
              valor={formatPercent(participacionCreditos)}
            />
          </div>

          <details className="mt-3 text-[11px] text-slate-500">
            <summary className="cursor-pointer font-semibold text-[#0E7C7B]">
              Ver métricas adicionales
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2">
              <ContextMetric
                etiqueta="Participación femenina en el monto"
                valor={formatPercent(participacionMonto)}
              />
              <ContextMetric etiqueta="Ticket promedio" valor={formatCompactCurrency(ticket)} />
              <ContextMetric
                etiqueta="Canal móvil (solo total nacional)"
                valor={formatInteger(appMovil)}
                nota={appMovil === null
                  ? 'No disponible para este filtro'
                  : formatCompactCurrency(appMovilMonto)}
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-400">
              Los créditos contabilizan operaciones, no personas únicas. APP MÓVIL es un canal, no una
              entidad. Con filtro aplicado, los cocientes no publicados se muestran como
              «No disponible». Fuente: {fuente}
            </p>
          </details>
        </>
      ) : (
        <p className="text-xs text-slate-500">{formatNoDisponible()}</p>
      )}
    </EstadoSeccion>
  );
}
