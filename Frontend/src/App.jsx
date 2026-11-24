import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  AlertTriangle,
  ArrowUpDown,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Database,
  Eye,
  Filter,
  Info,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  SUCURSALES,
  PERIODOS,
  fetchDashboardData,
} from './data/mockDashboardData';

/**
 * Paleta Semántica Accesible (Sección 6 del Storytelling - Checklist de Validación y UX):
 * - Verde azulado (Teal #0E7C7B): Indicadores saludables, liquidez disponible, préstamos vigentes y negocio/emergencia.
 * - Naranja rojizo (#D95D2E): Compromisos, obligaciones financieras, tasa de morosidad, préstamos vencidos / personales y días de atraso.
 * - Ámbar (#D97706): Métricas en seguimiento (Recuperación de cartera / atrasos medios).
 * Este par cromático evita el conflicto verde-rojo puro para usuarios con daltonismo (deuteranopía o protanopía).
 */
const COLORS = {
  teal: '#0E7C7B',
  tealLight: '#149B98',
  orangeRed: '#D95D2E',
  amber: '#D97706',
  slateText: '#1E293B',
  slateMuted: '#64748B',
  gridLine: '#E2E8F0',
};

const formatCurrencyFull = (value) => {
  return '$ ' + Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const formatMillionsAxis = (value) => {
  const millions = value / 1000000;
  return `$${millions.toFixed(1)} M`;
};

/**
 * Tooltip personalizado para el Gráfico Central (Nivel 2: Evolución Semanal)
 */
const CustomLineTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const liq = payload.find((p) => p.dataKey === 'liquidez')?.value || 0;
  const obl = payload.find((p) => p.dataKey === 'obligaciones')?.value || 0;
  const brecha = liq - obl;
  const razon = obl > 0 ? ((liq / obl) * 100).toFixed(1) : '100.0';
  const fechaCorte = payload[0]?.payload?.fecha_corte;

  return (
    <div className="bg-white border border-slate-200 shadow-lg rounded-lg p-3.5 text-xs min-w-[230px]">
      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
        <span className="font-bold text-slate-800">Semana {label}</span>
        {fechaCorte && (
          <span className="text-[11px] text-slate-400">Corte: {fechaCorte}</span>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: COLORS.teal }} />
            Liquidez disponible:
          </span>
          <span className="font-bold text-slate-900">{formatCurrencyFull(liq)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: COLORS.orangeRed }} />
            Obligaciones C.P.:
          </span>
          <span className="font-bold text-slate-900">{formatCurrencyFull(obl)}</span>
        </div>
        <div className="pt-1.5 mt-1.5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-slate-500">Margen / Razón:</span>
          <span className="font-semibold text-[#0E7C7B]">
            +{formatCurrencyFull(brecha)} ({razon}%)
          </span>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [periodoId, setPeriodoId] = useState('8w');
  const [sucursalId, setSucursalId] = useState('ALL');
  const [dashboardData, setDashboardData] = useState(null);

  // Estado para la tabla de detalle operativo (Zona 04)
  // Wireframe mode shows the exact 3 rows of the Figma wireframe by default, with toggle to see all 10 overdue records
  const [tableViewMode, setTableViewMode] = useState('wireframe'); // 'wireframe' | 'top10'
  const [sortBy, setSortBy] = useState('wireframe_order'); // 'wireframe_order' | 'dias_desc' | 'monto_desc'
  const [selectedTipoFilter, setSelectedTipoFilter] = useState(null);
  const [showContextModal, setShowContextModal] = useState(false);

  useEffect(() => {
    fetchDashboardData({ periodoId, sucursalId }).then((data) => {
      setDashboardData(data);
    });
  }, [periodoId, sucursalId]);

  const sortedAndFilteredCuotas = useMemo(() => {
    if (!dashboardData) return [];
    let list = [...dashboardData.cuotas_vencidas];

    if (selectedTipoFilter) {
      list = list.filter((item) => item.tipo_prestamo === selectedTipoFilter);
    }

    if (tableViewMode === 'wireframe' && sucursalId === 'ALL' && !selectedTipoFilter) {
      list = list.slice(0, 3);
    }

    if (sortBy === 'dias_desc') {
      list.sort((a, b) => b.dias_atraso - a.dias_atraso || b.saldo_pendiente - a.saldo_pendiente);
    } else if (sortBy === 'monto_desc') {
      list.sort((a, b) => b.saldo_pendiente - a.saldo_pendiente || b.dias_atraso - a.dias_atraso);
    }

    return list;
  }, [dashboardData, tableViewMode, sortBy, sucursalId, selectedTipoFilter]);

  if (!dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F5F8] text-slate-600 text-sm font-medium">
        Cargando tablero gerencial...
      </div>
    );
  }

  const {
    resumen,
    evolucion_semanal,
    prestamos_por_estado,
    cartera_vencida_por_tipo,
    fonacot_comparativa,
  } = dashboardData;

  const maxConteoEstado = Math.max(...prestamos_por_estado.map((d) => d.conteo), 1);
  const maxMontoTipo = Math.max(...cartera_vencida_por_tipo.map((d) => d.monto), 1);

  return (
    <div className="min-h-screen bg-[#ECEFF4] py-5 px-4 sm:px-6 lg:px-8 text-slate-800">
      {/* Contenedor Principal estilo Monitor de Escritorio (Patrón Z / F del Wireframe Figma) */}
      <div className="max-w-[1240px] mx-auto bg-[#F5F7FA] border border-slate-300/90 rounded-md shadow-sm p-6 sm:p-8">
        
        {/* =====================================================================
            ENCABEZADO SUPERIOR Y FILTROS GLOBALES
            ===================================================================== */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-[22px] sm:text-2xl font-extrabold tracking-tight text-slate-900">
                Caja de Ahorro y Préstamo
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-[#0E7C7B] border border-teal-200/70">
                CNBV · CONDUSEF
              </span>
            </div>
            <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5 font-medium">
              Panel de liquidez, cartera y recuperación · Vista gerencial
            </p>
          </div>

          {/* Dos filtros globales únicos (Interactividad Proporcional - Sección 6) */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filtro 1: Período */}
            <div className="relative">
              <label htmlFor="select-periodo" className="sr-only">Período</label>
              <select
                id="select-periodo"
                value={periodoId}
                onChange={(e) => setPeriodoId(e.target.value)}
                className="appearance-none bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-md pl-3.5 pr-8 py-2 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/20 focus:border-[#0E7C7B] cursor-pointer transition"
              >
                {PERIODOS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Filtro 2: Sucursal */}
            <div className="relative">
              <label htmlFor="select-sucursal" className="sr-only">Sucursal</label>
              <select
                id="select-sucursal"
                value={sucursalId}
                onChange={(e) => {
                  setSucursalId(e.target.value);
                  if (e.target.value !== 'ALL') {
                    setTableViewMode('top10');
                  } else {
                    setTableViewMode('wireframe');
                  }
                }}
                className="appearance-none bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-md pl-3.5 pr-8 py-2 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#0E7C7B]/20 focus:border-[#0E7C7B] cursor-pointer transition"
              >
                {SUCURSALES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Botón discreto para ver detalles de fórmulas SQL y 8 KPIs */}
            <button
              type="button"
              onClick={() => setShowContextModal(!showContextModal)}
              title="Ver ficha técnica de los 8 KPIs y modelo PostgreSQL"
              className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md text-xs font-semibold border transition ${
                showContextModal
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Ficha de KPIs (8)</span>
            </button>
          </div>
        </header>

        {/* Panel desplegable opcional con la matriz técnica de los 8 KPIs para la exposición con el profesor */}
        {showContextModal && (
          <div className="mt-4 bg-white border border-slate-200 rounded-md p-4 shadow-xs text-xs text-slate-700">
            <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#0E7C7B]" />
                <span className="font-bold text-slate-900">
                  Mapeo de los 8 Indicadores (Sección 5.5.2 Visualización Efectiva + Storytelling)
                </span>
              </div>
              <button
                onClick={() => setShowContextModal(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold"
              >
                Cerrar ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="font-bold text-[#0E7C7B]">KPI 1 · Liquidez vs. Obligaciones:</span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  <code>ahorro_total - capital_cartera_activa</code> frente a obligaciones a 30 días. Razón actual: <strong>{resumen.razon_liquidez_pct}%</strong>.
                </p>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="font-bold text-[#0E7C7B]">KPI 2 · Índice Colocación vs. Ahorro:</span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  <code>SUM(Prestamo.monto_autorizado) / SUM(Cuenta_Ahorro.saldo)</code>. Límite de alerta: <strong>80%</strong>.
                </p>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="font-bold text-[#D95D2E]">KPI 3 · Tasa de Morosidad (%):</span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Proporción de cartera vencida (<code>Prestamo.estado = 'Vencido'</code>) sobre cartera activa total.
                </p>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="font-bold text-[#D97706]">KPI 4 · Recuperación de Cartera (%):</span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  <code>SUM(Cuota_Prestamo.monto_pagado) / SUM(Cuota_Prestamo.monto_esperado)</code> en cuotas vencidas.
                </p>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="font-bold text-slate-800">KPI 5 · Evolución Semanal (S1-S8):</span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Doble serie temporal desde tabla de hechos <code>Posicion_Semanal</code> con corte dominical.
                </p>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="font-bold text-slate-800">KPI 6 · Préstamos por Estado y Tipo:</span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Causa raíz de morosidad por estado (Vigentes, Vencidos, Liquidados) y modalidad (Personal, Negocio, Emergencia).
                </p>
              </div>
              <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                <span className="font-bold text-slate-800">KPI 7 · Priorización de Cobranza:</span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Ranking operativo de socios por antigüedad de atraso (días) y saldo pendiente en <code>Cuota_Prestamo</code>.
                </p>
              </div>
              <div className="p-2.5 rounded bg-teal-50/50 border border-teal-200/60">
                <span className="font-bold text-[#0E7C7B]">KPI 8 · Referencia Externa FONACOT:</span>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Cruce de <code>Socio.genero = 'M'</code> vs. <code>Ref_Credito_Fonacot</code> por <code>Entidad_Federativa</code>.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            ZONA SUPERIOR — 01 / RESUMEN EJECUTIVO (EL GANCHO Y EL CONFLICTO)
            ===================================================================== */}
        <section className="mt-5" aria-labelledby="heading-resumen">
          <div className="flex items-center justify-between mb-2.5">
            <h2
              id="heading-resumen"
              className="text-[11px] font-bold uppercase tracking-wider text-slate-500"
            >
              01 / RESUMEN EJECUTIVO
            </h2>
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Corte dominical: 22/11/2026 · Razón de liquidez: <strong className="text-slate-600">{resumen.razon_liquidez_pct}%</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tarjeta KPI 1: Liquidez disponible */}
            <article className="bg-white rounded-md border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
              <div className="h-[4px] w-full" style={{ backgroundColor: COLORS.teal }} />
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Liquidez disponible
                  </span>
                  <span
                    title={`Obligaciones a corto plazo: ${formatCurrencyFull(resumen.obligaciones_corto_plazo)}`}
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-[#0E7C7B]"
                  >
                    Razón {resumen.razon_liquidez_pct}%
                  </span>
                </div>
                <div className="mt-2 text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-none">
                  {formatCurrencyFull(resumen.liquidez_disponible)}
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#0E7C7B]">
                    + {resumen.variacion_liquidez_pct}% vs. semana anterior
                  </span>
                </div>
              </div>
            </article>

            {/* Tarjeta KPI 2: Colocación vs. ahorro */}
            <article className="bg-white rounded-md border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
              <div className="h-[4px] w-full" style={{ backgroundColor: COLORS.teal }} />
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Colocación vs. ahorro
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    Ahorro: ${(resumen.ahorro_total / 1000000).toFixed(2)}M
                  </span>
                </div>
                <div className="mt-2 text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-none">
                  {resumen.colocacion_vs_ahorro_pct}%
                </div>
                <div className="mt-3 text-[11px] font-medium text-slate-500">
                  Meta de referencia: {resumen.meta_colocacion_pct}%
                </div>
              </div>
            </article>

            {/* Tarjeta KPI 3: Tasa de morosidad */}
            <article className="bg-white rounded-md border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
              <div className="h-[4px] w-full" style={{ backgroundColor: COLORS.orangeRed }} />
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Tasa de morosidad
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-50 text-[#D95D2E]">
                    Mora: {formatCurrencyFull(resumen.capital_cartera_vencida)}
                  </span>
                </div>
                <div className="mt-2 text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-none">
                  {resumen.tasa_morosidad_pct}%
                </div>
                <div className="mt-3 text-[11px] font-semibold text-[#D95D2E]">
                  Alerta: revisar préstamos vencidos
                </div>
              </div>
            </article>

            {/* Tarjeta KPI 4: Recuperación de cartera */}
            <article className="bg-white rounded-md border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col justify-between">
              <div className="h-[4px] w-full" style={{ backgroundColor: COLORS.amber }} />
              <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Recuperación de cartera
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                    Seguimiento
                  </span>
                </div>
                <div className="mt-2 text-2xl sm:text-[28px] font-extrabold text-slate-900 tracking-tight leading-none">
                  {resumen.recuperacion_cartera_pct}%
                </div>
                <div className="mt-3 text-[11px] font-semibold text-[#0E7C7B]">
                  + {resumen.variacion_recuperacion_pp} pp vs. mes anterior
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* =====================================================================
            ZONA CENTRAL — 02 / TENDENCIAS Y COMPARATIVA (KPI 5)
            ===================================================================== */}
        <section className="mt-6" aria-labelledby="heading-tendencias">
          <h2
            id="heading-tendencias"
            className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5"
          >
            02 / TENDENCIAS Y COMPARATIVA
          </h2>

          <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">
                  Evolución semanal de liquidez frente a obligaciones
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Comparación de montos disponibles y compromisos por cubrir
                </p>
              </div>

              {/* Leyenda limpia idéntica al wireframe */}
              <div className="flex items-center gap-5 text-xs font-medium text-slate-600">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-2 rounded-xs inline-block"
                    style={{ backgroundColor: COLORS.teal }}
                  />
                  <span>Liquidez</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-2 rounded-xs inline-block"
                    style={{ backgroundColor: COLORS.orangeRed }}
                  />
                  <span>Obligaciones</span>
                </div>
              </div>
            </div>

            {/* Gráfico de líneas: solo líneas guía horizontales tenues, sin verticales (Sección 6 UX) */}
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={evolucion_semanal}
                  margin={{ top: 10, right: 24, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    horizontal={true}
                    vertical={false}
                    stroke="#E2E8F0"
                    strokeDasharray="0"
                  />
                  <XAxis
                    dataKey="semana"
                    axisLine={{ stroke: '#E2E8F0' }}
                    tickLine={false}
                    tick={{ fill: '#64748B', fontSize: 11, fontWeight: 500 }}
                    dy={8}
                  />
                  <YAxis
                    domain={
                      sucursalId === 'ALL'
                        ? [800000, 1400000]
                        : ['auto', 'auto']
                    }
                    ticks={
                      sucursalId === 'ALL'
                        ? [800000, 1000000, 1200000, 1400000]
                        : undefined
                    }
                    tickFormatter={formatMillionsAxis}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748B', fontSize: 11, fontWeight: 500 }}
                    width={52}
                  />
                  <Tooltip content={<CustomLineTooltip />} />
                  <Line
                    type="linear"
                    dataKey="liquidez"
                    name="Liquidez"
                    stroke={COLORS.teal}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: COLORS.teal, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: COLORS.teal, stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Line
                    type="linear"
                    dataKey="obligaciones"
                    name="Obligaciones"
                    stroke={COLORS.orangeRed}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: COLORS.orangeRed, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: COLORS.orangeRed, stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* =====================================================================
            ZONA INFERIOR — NIVEL 3 (03 / CAUSA RAÍZ) Y NIVEL 4 (04 / DETALLE OPERATIVO)
            ===================================================================== */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* ZONA INFERIOR IZQUIERDA: 03 / CAUSA RAÍZ (7 columnas en escritorio) */}
          <section className="lg:col-span-7 flex flex-col" aria-labelledby="heading-causa-raiz">
            <h2
              id="heading-causa-raiz"
              className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5"
            >
              03 / CAUSA RAÍZ
            </h2>

            <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-bold text-slate-900">
                    ¿Dónde se concentra la cartera vencida?
                  </h3>
                  {selectedTipoFilter && (
                    <button
                      type="button"
                      onClick={() => setSelectedTipoFilter(null)}
                      className="text-[11px] font-semibold text-[#D95D2E] hover:underline"
                    >
                      Quitar filtro ({selectedTipoFilter}) ✕
                    </button>
                  )}
                </div>

                {/* Dos gráficos de barras horizontales lado a lado como en el Wireframe */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1">
                  
                  {/* Sub-gráfico 6A: Préstamos por estado */}
                  <div>
                    <h4 className="text-xs font-medium text-slate-500 mb-3.5">
                      Préstamos por estado
                    </h4>
                    <div className="space-y-4">
                      {prestamos_por_estado.map((item) => {
                        const widthPct = Math.round((item.conteo / maxConteoEstado) * 100);
                        return (
                          <div key={item.estado} className="group">
                            <div className="flex items-center gap-3">
                              <span className="w-20 text-xs font-medium text-slate-600 shrink-0">
                                {item.estado}
                              </span>
                              <div className="flex-1 flex items-center gap-2.5">
                                <div
                                  className="h-3.5 rounded-sm transition-all duration-300"
                                  style={{
                                    width: `${Math.max(widthPct, 12)}%`,
                                    backgroundColor: item.color,
                                  }}
                                  title={`${item.estado}: ${item.conteo} préstamos (${formatCurrencyFull(item.capital)})`}
                                />
                                <span
                                  className={`text-xs font-bold ${
                                    item.tipo_alerta === 'riesgo'
                                      ? 'text-[#D95D2E]'
                                      : 'text-slate-700'
                                  }`}
                                >
                                  {item.conteo}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sub-gráfico 6B: Cartera vencida por tipo */}
                  <div>
                    <div className="flex items-center justify-between mb-3.5">
                      <h4 className="text-xs font-medium text-slate-500">
                        Cartera vencida por tipo
                      </h4>
                      <span className="text-[10px] text-slate-400">
                        Clic para filtrar tabla
                      </span>
                    </div>
                    <div className="space-y-4">
                      {cartera_vencida_por_tipo.map((item) => {
                        const widthPct = Math.round((item.monto / maxMontoTipo) * 100);
                        const isSelected = selectedTipoFilter === item.tipo;
                        return (
                          <button
                            key={item.tipo}
                            type="button"
                            onClick={() =>
                              setSelectedTipoFilter(isSelected ? null : item.tipo)
                            }
                            className={`w-full text-left group rounded px-1 -mx-1 py-0.5 transition ${
                              isSelected ? 'bg-orange-50/70 ring-1 ring-[#D95D2E]/30' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-20 text-xs font-medium text-slate-600 shrink-0">
                                {item.tipo}
                              </span>
                              <div className="flex-1 flex items-center gap-2">
                                <div
                                  className="h-3.5 rounded-sm transition-all duration-300"
                                  style={{
                                    width: `${Math.max(widthPct, 16)}%`,
                                    backgroundColor: item.color,
                                  }}
                                />
                                <span
                                  className={`text-[11px] font-bold whitespace-nowrap ${
                                    item.tipo_alerta === 'riesgo'
                                      ? 'text-[#D95D2E]'
                                      : 'text-slate-700'
                                  }`}
                                >
                                  ${(item.monto / 1000).toFixed(1)}k
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloque integrado del 8° Indicador (Datos Abiertos FONACOT - Página 2, 8 y 15 del PDF) */}
              <div className="mt-6 pt-4 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-slate-50/90 border border-slate-200/70 rounded-md px-3.5 py-2.5">
                  <div className="flex items-start sm:items-center gap-2.5">
                    <Users className="w-4 h-4 text-[#0E7C7B] shrink-0 mt-0.5 sm:mt-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-800">
                          Contexto Externo FONACOT (Equidad y Participación Femenina)
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-teal-50 text-[#0E7C7B] rounded border border-teal-200/60">
                          +{fonacot_comparativa.brecha_pp} pp vs. mercado
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Socias en la Caja: <strong className="text-[#0E7C7B]">{fonacot_comparativa.pct_socias_caja}%</strong> ({fonacot_comparativa.total_socias_activas} socias) vs. Mujeres con crédito FONACOT: <strong className="text-slate-700">{fonacot_comparativa.pct_mujeres_fonacot}%</strong> ({fonacot_comparativa.trimestre_fuente})
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ZONA INFERIOR DERECHA: 04 / DETALLE OPERATIVO (5 columnas en escritorio) */}
          <section className="lg:col-span-5 flex flex-col" aria-labelledby="heading-detalle">
            <h2
              id="heading-detalle"
              className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2.5"
            >
              04 / DETALLE OPERATIVO
            </h2>

            <div className="bg-white rounded-md border border-slate-200/90 shadow-2xs p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900">
                      Préstamos con cuotas vencidas
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Orden sugerido: mayor atraso y saldo pendiente
                    </p>
                  </div>

                  {/* Controles ligeros para alternar entre las 3 filas del wireframe o los Top 10 socios */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (sortBy === 'wireframe_order') {
                          setSortBy('dias_desc');
                          setTableViewMode('top10');
                        } else if (sortBy === 'dias_desc') {
                          setSortBy('monto_desc');
                        } else {
                          setSortBy('wireframe_order');
                          setTableViewMode('wireframe');
                        }
                      }}
                      title="Cambiar criterio de ordenamiento (Vista Wireframe / Mayor Atraso / Mayor Saldo)"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition"
                    >
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      <span>
                        {sortBy === 'wireframe_order'
                          ? 'Wireframe'
                          : sortBy === 'dias_desc'
                          ? 'Por Días'
                          : 'Por Monto'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Tabla de préstamos con cuotas vencidas */}
                <div className="overflow-x-auto max-h-[245px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs text-[11px] font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-2.5 rounded-tl">Socio</th>
                        <th className="py-2 px-2.5">Vencimiento</th>
                        <th className="py-2 px-2.5 text-right">Pendiente</th>
                        <th className="py-2 px-2.5 text-right rounded-tr">Días</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {sortedAndFilteredCuotas.map((row) => (
                        <tr
                          key={row.id_cuota}
                          className="hover:bg-slate-50/90 transition-colors group"
                          title={`${row.nombre_socio} · Préstamo ${row.tipo_prestamo} (Cuota ${row.num_cuota}) · Tel: ${row.telefono}`}
                        >
                          <td className="py-2.5 px-2.5 font-medium text-slate-800">
                            <div>{row.codigo_socio}</div>
                            {tableViewMode === 'top10' && (
                              <div className="text-[10px] text-slate-400 truncate max-w-[125px]">
                                {row.nombre_socio} · {row.tipo_prestamo}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-2.5 text-slate-600 font-medium">
                            {row.fecha_vencimiento}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-bold text-slate-800">
                            {formatCurrencyFull(row.saldo_pendiente)}
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-extrabold text-[#D95D2E]">
                            {row.dias_atraso}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pie de la tabla con acción rápida para ver los 10 socios de cobranza prioritaria */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">
                  Mostrando <strong>{sortedAndFilteredCuotas.length}</strong> de{' '}
                  <strong>{dashboardData.cuotas_vencidas.length}</strong> casos prioritarios
                </span>
                {sucursalId === 'ALL' && !selectedTipoFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode = tableViewMode === 'wireframe' ? 'top10' : 'wireframe';
                      setTableViewMode(nextMode);
                      if (nextMode === 'wireframe') {
                        setSortBy('wireframe_order');
                      }
                    }}
                    className="font-semibold text-[#0E7C7B] hover:underline"
                  >
                    {tableViewMode === 'wireframe'
                      ? 'Ver Top 10 socios en mora →'
                      : '← Volver a vista Wireframe (3)'}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* =====================================================================
            PIE DE PÁGINA ACADÉMICO (IDÉNTICO AL WIREFRAME DE FIGMA)
            ===================================================================== */}
        <footer className="mt-5 pt-3 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-slate-400 font-medium">
          <div>
            WIREFRAME ACADÉMICO · Datos y valores ilustrativos, no registros reales · Versión 12/11/2026
          </div>
          <div>
            Equipo &ldquo;Los Menchos Victoria&rdquo; · PostgreSQL 15 + FastAPI + React &amp; Recharts
          </div>
        </footer>
      </div>
    </div>
  );
}
