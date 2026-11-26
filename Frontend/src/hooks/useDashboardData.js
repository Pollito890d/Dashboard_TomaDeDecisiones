import { useEffect, useMemo, useState } from 'react';
import { esCancelacion, loadDashboardData } from '../services/dashboardApi';

/**
 * Estado reutilizable del tablero oficial.
 *
 * Acepta parámetros reales del contrato (preparados para los filtros del paso
 * 26). Cada cambio cancela la carga anterior; un desmontaje o el doble efecto
 * de StrictMode también aborta la solicitud. Las cancelaciones intencionales
 * no se convierten en errores ni actualizan el estado.
 */
export function useDashboardData(parametros = {}) {
  const claveParametros = JSON.stringify(parametros ?? {});
  const parametrosEstables = useMemo(() => JSON.parse(claveParametros), [claveParametros]);
  const [revision, setRevision] = useState(0);
  const [estado, setEstado] = useState({ data: null, error: null, loading: true });

  useEffect(() => {
    const controlador = new AbortController();
    let activo = true;

    setEstado((anterior) => ({ ...anterior, loading: true, error: null }));

    loadDashboardData(parametrosEstables, { signal: controlador.signal })
      .then((payload) => {
        if (!activo) return;
        setEstado({ data: payload, error: null, loading: false });
      })
      .catch((fallo) => {
        if (!activo || esCancelacion(fallo)) return;
        setEstado({ data: null, error: fallo, loading: false });
      });

    return () => {
      activo = false;
      controlador.abort();
    };
  }, [claveParametros, revision, parametrosEstables]);

  return {
    data: estado.data,
    error: estado.error,
    loading: estado.loading,
    seleccion: estado.data?.seleccion ?? null,
    catalogos: estado.data?.catalogos ?? null,
    recargar: () => setRevision((valor) => valor + 1),
  };
}

export default useDashboardData;
