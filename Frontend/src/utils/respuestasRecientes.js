/**
 * Guarda de secuencia para respuestas asíncronas.
 *
 * Cada solicitud registra un turno; solo se aplica la respuesta cuyo turno
 * sigue siendo el último. Así, un cambio rápido de filtros no puede presentar
 * cifras de una consulta obsoleta aunque el navegador resuelva fuera de orden.
 */
export function crearSecuenciaRespuestas() {
  let ultimo = 0;
  return {
    siguiente() {
      ultimo += 1;
      return ultimo;
    },
    esActual(turno) {
      return turno === ultimo;
    },
  };
}
