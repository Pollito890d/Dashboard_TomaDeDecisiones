import ContextMetric from '../layout/ContextMetric';
import EstadoSeccion from '../layout/EstadoSeccion';
import {
  formatCompactCurrency,
  formatInteger,
  formatNoDisponible,
  formatPercent,
  formatYear,
} from '../../utils/formatters';

/**
 * Contexto externo M-04: SNIIV anual, separado del universo SOCAP.
 * El desglose por entidad se filtra localmente sobre `por_entidad`; el filtro
 * de género usa solo columnas publicadas, sin reutilizar agregados nacionales.
 */
export default function SniivContextStrip({
  datos,
  anio,
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
    ? (desglose ?? []).find((fila) => String(fila?.cve_ent) === String(entidad)) ?? null
    : null;
  const entidadSinFila = Boolean(entidad) && !filaEntidad;
  const mujeres = genero === 'mujeres';
  const hombres = genero === 'hombres';

  const acciones = filaEntidad
    ? mujeres ? filaEntidad.acciones_mujeres : hombres ? filaEntidad.acciones_hombres : filaEntidad.acciones_totales
    : mujeres ? datos?.acciones_mujeres : hombres ? datos?.acciones_hombres : datos?.m04_acciones_totales;

  // El desglose por entidad publica acciones por género, pero no montos ni
  // promedios por género: esos valores se marcan como no disponibles.
  const monto = filaEntidad
    ? genero ? null : filaEntidad.monto_total_mxn
    : mujeres ? datos?.monto_mujeres_mxn : hombres ? datos?.monto_hombres_mxn : datos?.m04_monto_total_mxn;
  // Con entidad seleccionada solo se usan columnas publicadas en ese renglón:
  // un nulo estatal se muestra como no disponible, nunca se toma del total nacional.
  const promedio = genero
    ? null
    : filaEntidad
      ? filaEntidad.promedio_por_accion_mxn
      : datos?.m04_promedio_por_accion_mxn;
  const participacionAcciones = genero
    ? null
    : filaEntidad
      ? filaEntidad.m04_participacion_mujeres_acciones_pct
      : datos?.m04_participacion_mujeres_acciones_pct;
  const participacionMonto = genero
    ? null
    : filaEntidad
      ? filaEntidad.m04_participacion_mujeres_monto_pct
      : datos?.m04_participacion_mujeres_monto_pct;
  const infonavit = genero
    ? null
    : filaEntidad
      ? filaEntidad.acciones_infonavit
      : datos?.acciones_infonavit;
  const participacionInfonavit = genero
    ? null
    : filaEntidad
      ? filaEntidad.m04_participacion_infonavit_acciones_pct
      : datos?.m04_participacion_infonavit_acciones_pct;
  const sinSexo = filaEntidad ? filaEntidad.acciones_sin_sexo : datos?.filas_sin_sexo;

  const nombreEntidad = entidadSinFila
    ? `sin desglose para ${entidad}`
    : filaEntidad
      ? `${filaEntidad.cve_ent} · ${filaEntidad.entidad_nombre ?? 'Entidad'}`
      : 'Total nacional';
  const generoTexto = mujeres ? ' · mujeres' : hombres ? ' · hombres' : '';

  return (
    <EstadoSeccion
      cargando={loading}
      error={error}
      onReintentar={onReintentar}
      mensajeCarga="Consultando el contexto SNIIV…"
    >
      {sinDatos && !datos ? (
        <p className="text-xs text-slate-500">
          SNIIV no publica información para el año {formatYear(anio)}. No se imputan valores ausentes.
        </p>
      ) : datos || entidadSinFila ? (
        entidadSinFila ? (
          <p className="text-xs text-slate-500">
            La fuente no publica desglose para {entidad} en {formatYear(anio)}; no se sustituye por el resumen nacional.
          </p>
        ) : (
          <>
            <p className="text-[11px] text-slate-500 mb-2">
              Alcance: {nombreEntidad}{generoTexto} · {formatYear(anio)}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <ContextMetric etiqueta="Acciones de financiamiento" valor={formatInteger(acciones)} />
              <ContextMetric etiqueta="Monto total" valor={formatCompactCurrency(monto)} />
              <ContextMetric
                etiqueta="Participación femenina en acciones"
                valor={formatPercent(participacionAcciones)}
              />
            </div>

            <details className="mt-3 text-[11px] text-slate-500">
              <summary className="cursor-pointer font-semibold text-[#0E7C7B]">
                Ver métricas adicionales
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2">
                <ContextMetric etiqueta="Promedio por acción" valor={formatCompactCurrency(promedio)} />
                <ContextMetric
                  etiqueta="Participación femenina en el monto"
                  valor={formatPercent(participacionMonto)}
                />
                <ContextMetric
                  etiqueta="Participación INFONAVIT"
                  valor={formatPercent(participacionInfonavit)}
                  nota={infonavit === null ? 'No disponible para este filtro' : `${formatInteger(infonavit)} acciones`}
                />
              </div>
              <p className="mt-2 text-[10px] text-slate-400">
                Las acciones son operaciones de financiamiento, no personas únicas. Las filas sin sexo
                se conservan en el total y se excluyen solo del denominador de género (
                {formatInteger(sinSexo)} {filaEntidad ? 'acciones' : 'filas'}). Con filtro aplicado, los
                cocientes no publicados se muestran como «No disponible». Fuente: {fuente}
              </p>
            </details>
          </>
        )
      ) : (
        <p className="text-xs text-slate-500">{formatNoDisponible()}</p>
      )}
    </EstadoSeccion>
  );
}
