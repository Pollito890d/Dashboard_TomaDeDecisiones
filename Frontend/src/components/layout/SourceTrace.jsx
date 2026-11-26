/** Trazabilidad leída de la fuente de fuentes; el detalle queda en el tooltip. */
export default function SourceTrace({ fuentes, error, estadoApi, contratoVersion }) {
  const porFuente = fuentes?.porFuente ?? [];

  if (error || fuentes?.sinDatos || !porFuente.length) {
    return (
      <span title={error ?? 'La respuesta oficial no incluyó detalle de trazabilidad.'}>
        Fuentes oficiales · detalle no disponible
      </span>
    );
  }

  const detalle = [
    ...porFuente.map((fila) =>
      `${fila.nombre}: ${fila.total} archivo(s)${fila.hashCorto ? ` · SHA-256 ${fila.hashCorto}…` : ''}`),
    contratoVersion ? `Contrato de datos ${contratoVersion}` : null,
    estadoApi?.database ? `Base de datos operativa: ${estadoApi.database}` : null,
  ].filter(Boolean).join(' | ');

  return (
    <span title={detalle}>
      Fuentes oficiales verificadas · {fuentes.total} archivos
    </span>
  );
}
