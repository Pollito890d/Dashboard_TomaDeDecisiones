import { Building2 } from 'lucide-react';
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
  const promedio = genero ? null : (filaEntidad?.promedio_por_accion_mxn ?? datos?.m04_promedio_por_accion_mxn);
  const participacionAcciones = genero
    ? null
    : (filaEntidad?.m04_participacion_mujeres_acciones_pct ?? datos?.m04_participacion_mujeres_acciones_pct);
  const participacionMonto = genero
    ? null
    : (filaEntidad?.m04_participacion_mujeres_monto_pct ?? datos?.m04_participacion_mujeres_monto_pct);
  const infonavit = genero ? null : (filaEntidad?.acciones_infonavit ?? datos?.acciones_infonavit);
  const participacionInfonavit = genero
    ? null
    : (filaEntidad?.m04_participacion_infonavit_acciones_pct ?? datos?.m04_participacion_infonavit_acciones_pct);
  const sinSexo = filaEntidad?.acciones_sin_sexo ?? datos?.filas_sin_sexo;

  const nombreEntidad = entidadSinFila
    ? `sin desglose para ${entidad}`
    : filaEntidad
      ? `${filaEntidad.cve_ent} · ${filaEntidad.entidad_nombre ?? 'Entidad'}`
      : 'Total nacional';
  const generoTexto = mujeres ? ' · mujeres' : hombres ? ' · hombres' : '';

  const contenido = (
    <>
      {entidadSinFila ? (
        <div className="text-xs text-slate-500">
          El desglose oficial no contiene la entidad {entidad} para el año {formatYear(anio)}.
          No se sustituye por el resumen nacional.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <ContextMetric etiqueta="Acciones de financiamiento" valor={formatInteger(acciones)} />
          <ContextMetric etiqueta="Monto total" valor={formatCompactCurrency(monto)} />
          <ContextMetric etiqueta="Promedio por acción" valor={formatCompactCurrency(promedio)} />
          <ContextMetric
            etiqueta="Participación femenina en acciones"
            valor={formatPercent(participacionAcciones)}
          />
          <ContextMetric
            etiqueta="Participación femenina en monto"
            valor={formatPercent(participacionMonto)}
          />
          <ContextMetric
            etiqueta="Participación INFONAVIT"
            valor={formatPercent(participacionInfonavit)}
            nota={infonavit === null ? 'No disponible para este filtro' : `${formatInteger(infonavit)} acciones`}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 flex flex-col">
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#0E7C7B]" aria-hidden="true" />
          <h3 className="text-[15px] font-bold text-slate-900">
            Contexto externo · SNIIV (M-04)
          </h3>
        </div>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-[#0E7C7B] whitespace-nowrap">
          Anual {formatYear(anio)}
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Financiamientos de vivienda · corte anual, no mezclado con las SOCAP
      </p>
      <p className="text-[10px] text-slate-400 mb-2">
        Granularidad: anual · Alcance: {nombreEntidad}{generoTexto} · filtros locales sobre el desglose oficial recibido
      </p>

      <EstadoSeccion
        cargando={loading}
        error={error}
        onReintentar={onReintentar}
        mensajeCarga="Consultando el contexto SNIIV…"
      >
        {sinDatos && !datos ? (
          <div className="text-xs text-slate-500">
            HTTP 200 sin datos: SNIIV no publica información para el año {formatYear(anio)}.
          </div>
        ) : datos || entidadSinFila ? (
          contenido
        ) : (
          <div className="text-xs text-slate-500">{formatNoDisponible()}</div>
        )}
      </EstadoSeccion>

      <div className="mt-auto pt-3 text-[10px] text-slate-400 space-y-1">
        <div>
          Cobertura anual disponible: solo 2025 en el contrato vigente; no se muestran años
          inventados. Las acciones son operaciones de financiamiento, no personas únicas. Las filas
          sin sexo se conservan en el total y se excluyen solo del denominador de género (
          {formatInteger(sinSexo)} {filaEntidad ? 'acciones' : 'filas'}).
        </div>
        {(genero || entidad) && (
          <div>
            Con filtro aplicado, los cocientes, promedios y la participación INFONAVIT se muestran
            como «No disponible» cuando la respuesta no publica ese desglose específico.
          </div>
        )}
        <div>Fuente: {fuente}</div>
      </div>
    </div>
  );
}
