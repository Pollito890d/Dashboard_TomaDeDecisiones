import { useState, useEffect } from 'react';
import { fetchDashboardData } from '../services/dashboardApi';

/**
 * Estado y efecto originales del tablero, extraídos de App.jsx sin introducir
 * estados nuevos, cancelación de peticiones ni lógica de integración definitiva.
 */
export function useDashboardData({ periodoId, sucursalId }) {
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    fetchDashboardData({ periodoId, sucursalId }).then((data) => {
      setDashboardData(data);
    });
  }, [periodoId, sucursalId]);

  return dashboardData;
}
