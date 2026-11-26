-- =============================================================================
-- Fase IV — Paso 16: Punto de entrada consolidado de vistas SQL
-- Archivo: Database/03_views.sql
-- Descripción:
--   Script puente que carga en orden las vistas modulares de:
--     1. Database/views/01_vistas.sql (vistas base e instantánea activa)
--     2. Database/views/02_kpis.sql   (vistas analíticas de KPIs y métricas)
--   Ejecución desde la raíz del repositorio con psql:
--     psql -U dashboard_user -h localhost -p 5432 -d dashboard_caja_ahorro -v ON_ERROR_STOP=1 -f Database/03_views.sql
-- =============================================================================

\ir views/01_vistas.sql
\ir views/02_kpis.sql
