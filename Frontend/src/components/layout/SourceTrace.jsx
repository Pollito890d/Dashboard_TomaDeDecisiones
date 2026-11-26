/** Trazabilidad leída de /api/fuentes; no contiene valores financieros. */
export default function SourceTrace({ fuentes, error, estadoApi }) {
  if (error) {
    return <span className="text-amber-700">Trazabilidad no disponible: {error}</span>;
  }

  const porFuente = fuentes?.porFuente ?? [];
  if (fuentes?.sinDatos) {
    return <span>HTTP 200 sin datos en /api/fuentes</span>;
  }
  if (!porFuente.length) {
    return <span>Sin trazabilidad disponible en /api/fuentes</span>;
  }

  const detalle = porFuente
    .map((fila) => `${fila.nombre}: ${fila.total} archivo(s)${fila.hashCorto ? ` · SHA-256 ${fila.hashCorto}…` : ''}`)
    .join(' | ');

  return (
    <span title={detalle}>
      Trazabilidad /api/fuentes: {fuentes.total} archivos ·{' '}
      {porFuente.map((fila) => `${fila.nombre} ${fila.total}`).join(' · ')}
      {estadoApi?.database ? ` · PostgreSQL ${estadoApi.database}` : ''}
    </span>
  );
}
