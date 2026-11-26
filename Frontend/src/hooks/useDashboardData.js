import { useState, useEffect } from 'react';
import { fetchDashboardData } from '../services/dashboardApi';

/**
 * Estado mínimo de la consulta oficial.
 *
 * Paso 24: se conserva el efecto original y se añade únicamente un estado de
 * error visible, exigido para no sustituir la información real por el mock.
 * El control de solicitudes obsoletas se completará en el paso 25.
 */
export function useDashboardData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData()
      .then((payload) => {
        setData(payload);
        setError(null);
      })
      .catch((fallo) => {
        setError(fallo);
        setData(null);
      });
  }, []);

  return { data, error };
}
