import { buildDashboardMockData } from '../data/mockDashboardData';

/**
 * Único punto de ejecución de `fetch` en el frontend.
 *
 * Paso 23: se traslada aquí, sin cambios de comportamiento, la responsabilidad HTTP
 * que antes vivía en `mockDashboardData.js`. Se conservan la URL, los parámetros
 * `periodoId` / `sucursalId`, `VITE_API_URL`, la estructura devuelta y el fallback.
 *
 * NOTA TÉCNICA: el dataset sintético y su fallback son comportamiento heredado de
 * esta etapa intermedia; NO representan información real. Deberán retirarse durante
 * el paso 25, cuando la interfaz se conecte al contrato 1.0.0 de FastAPI.
 * En este paso NO se conecta todavía al contrato definitivo.
 */
export async function fetchDashboardData({ periodoId = '8w', sucursalId = 'ALL' } = {}) {
  const apiUrl = import.meta.env.VITE_API_URL;

  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl}/api/dashboard?periodo=${periodoId}&sucursal=${sucursalId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Fallback silencioso a datos sintéticos locales cuando el backend FastAPI aún no se levanta
    }
  }

  return buildDashboardMockData({ periodoId, sucursalId });
}
