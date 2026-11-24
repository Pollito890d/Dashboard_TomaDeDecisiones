/**
 * Dataset sintético y adaptador de API para el Dashboard Caja de Ahorro y Préstamo.
 *
 * Respeta fielmente:
 * 1. Los valores exactos del Wireframe de Figma en la vista por defecto ("Últimas 8 semanas" + "Todas las sucursales"):
 *    - Liquidez disponible: $ 1,250,000 (+ 6.8% vs. semana anterior)
 *    - Colocación vs. ahorro: 73.4% (Meta de referencia: 80%)
 *    - Tasa de morosidad: 8.2% (Alerta: revisar préstamos vencidos)
 *    - Recuperación de cartera: 67.5% (+ 3.1 pp vs. mes anterior)
 *    - Evolución semanal S1..S8 (Liquidez vs. Obligaciones)
 *    - Préstamos por estado: Vigentes (82), Vencidos (37), Liquidados (55)
 *    - Cartera vencida por tipo: Personal, Negocio, Emergencia
 *    - Tabla de préstamos con cuotas vencidas: Socio 001 ($18,400, 21 días), Socio 002 ($12,700, 14 días), Socio 003 ($8,250, 8 días), + desglose completo de socios para priorizar los top 10.
 * 2. El modelo relacional PostgreSQL (15 tablas: Posicion_Semanal, Sucursal, Socio, Prestamo, Cuota_Prestamo, Tipo_Prestamo, Ref_Credito_Fonacot, etc.).
 * 3. El 8° indicador de contexto externo (Ref_Credito_Fonacot): Participación de mujeres socias de la caja frente a trabajadoras con crédito FONACOT por entidad federativa.
 */

export const SUCURSALES = [
  { id: 'ALL', nombre: 'Todas las sucursales', entidad: 'Consolidado (3 Estados)', clave_inegi: '00' },
  { id: '1', nombre: 'Sucursal Centro (CDMX)', entidad: 'Ciudad de México', clave_inegi: '09' },
  { id: '2', nombre: 'Sucursal Norte (Jalisco)', entidad: 'Jalisco', clave_inegi: '14' },
  { id: '3', nombre: 'Sucursal Bajío (Querétaro)', entidad: 'Querétaro', clave_inegi: '22' },
];

export const PERIODOS = [
  { id: '8w', label: 'Últimas 8 semanas', weeksCount: 8 },
  { id: '4w', label: 'Últimas 4 semanas', weeksCount: 4 },
  { id: '12w', label: 'Últimas 12 semanas (Trimestre)', weeksCount: 12 },
];

/**
 * Datos por sucursal basados en las tablas del modelo:
 * - Posicion_Semanal (12 semanas generadas con corte dominical)
 * - Prestamo + Tipo_Prestamo + Cuota_Prestamo + Socio
 * - Ref_Credito_Fonacot (4T 2025)
 */
const DATA_BY_BRANCH = {
  ALL: {
    resumen: {
      liquidez_disponible: 1250000,
      obligaciones_corto_plazo: 1090000,
      ahorro_total: 4280000,
      razon_liquidez_pct: 114.7,
      variacion_liquidez_pct: 6.8,
      colocacion_vs_ahorro_pct: 73.4,
      meta_colocacion_pct: 80.0,
      capital_cartera_activa: 3030000,
      tasa_morosidad_pct: 8.2,
      umbral_morosidad_pct: 5.0,
      capital_cartera_vencida: 248460,
      recuperacion_cartera_pct: 67.5,
      variacion_recuperacion_pp: 3.1,
    },
    // Serie de 12 semanas; las últimas 8 (S1..S8) coinciden exactamente con la curva del wireframe
    evolucion_12w: [
      { semana: 'S-3', fecha_corte: '2026-09-06', liquidez: 980000, obligaciones: 820000 },
      { semana: 'S-2', fecha_corte: '2026-09-13', liquidez: 1010000, obligaciones: 840000 },
      { semana: 'S-1', fecha_corte: '2026-09-20', liquidez: 1045000, obligaciones: 855000 },
      { semana: 'S0',  fecha_corte: '2026-09-27', liquidez: 1030000, obligaciones: 865000 },
      { semana: 'S1',  fecha_corte: '2026-10-04', liquidez: 1060000, obligaciones: 880000 },
      { semana: 'S2',  fecha_corte: '2026-10-11', liquidez: 1125000, obligaciones: 910000 },
      { semana: 'S3',  fecha_corte: '2026-10-18', liquidez: 1095000, obligaciones: 935000 },
      { semana: 'S4',  fecha_corte: '2026-10-25', liquidez: 1185000, obligaciones: 950000 },
      { semana: 'S5',  fecha_corte: '2026-11-01', liquidez: 1160000, obligaciones: 985000 },
      { semana: 'S6',  fecha_corte: '2026-11-08', liquidez: 1225000, obligaciones: 1020000 },
      { semana: 'S7',  fecha_corte: '2026-11-15', liquidez: 1170000, obligaciones: 1055000 },
      { semana: 'S8',  fecha_corte: '2026-11-22', liquidez: 1250000, obligaciones: 1090000 },
    ],
    prestamos_por_estado: [
      { estado: 'Vigentes', conteo: 82, capital: 2781540, color: '#0E7C7B', tipo_alerta: 'saludable' },
      { estado: 'Vencidos', conteo: 37, capital: 248460, color: '#D95D2E', tipo_alerta: 'riesgo' },
      { estado: 'Liquidados', conteo: 55, capital: 1420000, color: '#149B98', tipo_alerta: 'saludable' },
    ],
    cartera_vencida_por_tipo: [
      { tipo: 'Personal', monto: 128400, creditos: 19, pct: 51.7, tasa_base: 24.0, color: '#D95D2E', tipo_alerta: 'riesgo' },
      { tipo: 'Negocio', monto: 78600, creditos: 11, pct: 31.6, tasa_base: 18.5, color: '#0E7C7B', tipo_alerta: 'saludable' },
      { tipo: 'Emergencia', monto: 41460, creditos: 7, pct: 16.7, tasa_base: 15.0, color: '#0E7C7B', tipo_alerta: 'saludable' },
    ],
    fonacot_comparativa: {
      pct_socias_caja: 54.2,
      pct_mujeres_fonacot: 46.8,
      brecha_pp: +7.4,
      total_socias_activas: 312,
      trabajadores_fonacot_estado: 148520,
      monto_promedio_fonacot: 26400,
      trimestre_fuente: '4T 2025 (Datos Abiertos FONACOT)',
      detalle_estados: [
        { entidad: 'Ciudad de México', socias_caja_pct: 56.4, mujeres_fonacot_pct: 48.1 },
        { entidad: 'Jalisco', socias_caja_pct: 52.8, mujeres_fonacot_pct: 45.9 },
        { entidad: 'Querétaro', socias_caja_pct: 51.9, mujeres_fonacot_pct: 44.7 },
      ]
    }
  },
  '1': {
    resumen: {
      liquidez_disponible: 540000,
      obligaciones_corto_plazo: 495000,
      ahorro_total: 1920000,
      razon_liquidez_pct: 109.1,
      variacion_liquidez_pct: 4.9,
      colocacion_vs_ahorro_pct: 76.8,
      meta_colocacion_pct: 80.0,
      capital_cartera_activa: 1380000,
      tasa_morosidad_pct: 9.4,
      umbral_morosidad_pct: 5.0,
      capital_cartera_vencida: 129720,
      recuperacion_cartera_pct: 64.2,
      variacion_recuperacion_pp: 1.8,
    },
    evolucion_12w: [
      { semana: 'S-3', fecha_corte: '2026-09-06', liquidez: 430000, obligaciones: 380000 },
      { semana: 'S-2', fecha_corte: '2026-09-13', liquidez: 445000, obligaciones: 390000 },
      { semana: 'S-1', fecha_corte: '2026-09-20', liquidez: 455000, obligaciones: 398000 },
      { semana: 'S0',  fecha_corte: '2026-09-27', liquidez: 450000, obligaciones: 405000 },
      { semana: 'S1',  fecha_corte: '2026-10-04', liquidez: 465000, obligaciones: 412000 },
      { semana: 'S2',  fecha_corte: '2026-10-11', liquidez: 492000, obligaciones: 425000 },
      { semana: 'S3',  fecha_corte: '2026-10-18', liquidez: 480000, obligaciones: 438000 },
      { semana: 'S4',  fecha_corte: '2026-10-25', liquidez: 515000, obligaciones: 445000 },
      { semana: 'S5',  fecha_corte: '2026-11-01', liquidez: 505000, obligaciones: 460000 },
      { semana: 'S6',  fecha_corte: '2026-11-08', liquidez: 530000, obligaciones: 472000 },
      { semana: 'S7',  fecha_corte: '2026-11-15', liquidez: 515000, obligaciones: 485000 },
      { semana: 'S8',  fecha_corte: '2026-11-22', liquidez: 540000, obligaciones: 495000 },
    ],
    prestamos_por_estado: [
      { estado: 'Vigentes', conteo: 36, capital: 1250280, color: '#0E7C7B', tipo_alerta: 'saludable' },
      { estado: 'Vencidos', conteo: 18, capital: 129720, color: '#D95D2E', tipo_alerta: 'riesgo' },
      { estado: 'Liquidados', conteo: 24, capital: 620000, color: '#149B98', tipo_alerta: 'saludable' },
    ],
    cartera_vencida_por_tipo: [
      { tipo: 'Personal', monto: 71200, creditos: 10, pct: 54.9, tasa_base: 24.0, color: '#D95D2E', tipo_alerta: 'riesgo' },
      { tipo: 'Negocio', monto: 38400, creditos: 5, pct: 29.6, tasa_base: 18.5, color: '#0E7C7B', tipo_alerta: 'saludable' },
      { tipo: 'Emergencia', monto: 20120, creditos: 3, pct: 15.5, tasa_base: 15.0, color: '#0E7C7B', tipo_alerta: 'saludable' },
    ],
    fonacot_comparativa: {
      pct_socias_caja: 56.4,
      pct_mujeres_fonacot: 48.1,
      brecha_pp: +8.3,
      total_socias_activas: 142,
      trabajadores_fonacot_estado: 84310,
      monto_promedio_fonacot: 28150,
      trimestre_fuente: '4T 2025 · Ciudad de México (09)',
      detalle_estados: [
        { entidad: 'Ciudad de México', socias_caja_pct: 56.4, mujeres_fonacot_pct: 48.1 },
      ]
    }
  },
  '2': {
    resumen: {
      liquidez_disponible: 420000,
      obligaciones_corto_plazo: 355000,
      ahorro_total: 1390000,
      razon_liquidez_pct: 118.3,
      variacion_liquidez_pct: 8.1,
      colocacion_vs_ahorro_pct: 71.2,
      meta_colocacion_pct: 80.0,
      capital_cartera_activa: 970000,
      tasa_morosidad_pct: 7.6,
      umbral_morosidad_pct: 5.0,
      capital_cartera_vencida: 73720,
      recuperacion_cartera_pct: 70.1,
      variacion_recuperacion_pp: 4.2,
    },
    evolucion_12w: [
      { semana: 'S-3', fecha_corte: '2026-09-06', liquidez: 325000, obligaciones: 260000 },
      { semana: 'S-2', fecha_corte: '2026-09-13', liquidez: 332000, obligaciones: 268000 },
      { semana: 'S-1', fecha_corte: '2026-09-20', liquidez: 345000, obligaciones: 274000 },
      { semana: 'S0',  fecha_corte: '2026-09-27', liquidez: 340000, obligaciones: 278000 },
      { semana: 'S1',  fecha_corte: '2026-10-04', liquidez: 350000, obligaciones: 285000 },
      { semana: 'S2',  fecha_corte: '2026-10-11', liquidez: 375000, obligaciones: 295000 },
      { semana: 'S3',  fecha_corte: '2026-10-18', liquidez: 365000, obligaciones: 304000 },
      { semana: 'S4',  fecha_corte: '2026-10-25', liquidez: 395000, obligaciones: 310000 },
      { semana: 'S5',  fecha_corte: '2026-11-01', liquidez: 388000, obligaciones: 322000 },
      { semana: 'S6',  fecha_corte: '2026-11-08', liquidez: 410000, obligaciones: 335000 },
      { semana: 'S7',  fecha_corte: '2026-11-15', liquidez: 389000, obligaciones: 345000 },
      { semana: 'S8',  fecha_corte: '2026-11-22', liquidez: 420000, obligaciones: 355000 },
    ],
    prestamos_por_estado: [
      { estado: 'Vigentes', conteo: 27, capital: 896280, color: '#0E7C7B', tipo_alerta: 'saludable' },
      { estado: 'Vencidos', conteo: 12, capital: 73720, color: '#D95D2E', tipo_alerta: 'riesgo' },
      { estado: 'Liquidados', conteo: 18, capital: 485000, color: '#149B98', tipo_alerta: 'saludable' },
    ],
    cartera_vencida_por_tipo: [
      { tipo: 'Personal', monto: 36800, creditos: 6, pct: 49.9, tasa_base: 24.0, color: '#D95D2E', tipo_alerta: 'riesgo' },
      { tipo: 'Negocio', monto: 24100, creditos: 4, pct: 32.7, tasa_base: 18.5, color: '#0E7C7B', tipo_alerta: 'saludable' },
      { tipo: 'Emergencia', monto: 12820, creditos: 2, pct: 17.4, tasa_base: 15.0, color: '#0E7C7B', tipo_alerta: 'saludable' },
    ],
    fonacot_comparativa: {
      pct_socias_caja: 52.8,
      pct_mujeres_fonacot: 45.9,
      brecha_pp: +6.9,
      total_socias_activas: 104,
      trabajadores_fonacot_estado: 41890,
      monto_promedio_fonacot: 25100,
      trimestre_fuente: '4T 2025 · Jalisco (14)',
      detalle_estados: [
        { entidad: 'Jalisco', socias_caja_pct: 52.8, mujeres_fonacot_pct: 45.9 },
      ]
    }
  },
  '3': {
    resumen: {
      liquidez_disponible: 290000,
      obligaciones_corto_plazo: 240000,
      ahorro_total: 970000,
      razon_liquidez_pct: 120.8,
      variacion_liquidez_pct: 8.6,
      colocacion_vs_ahorro_pct: 70.1,
      meta_colocacion_pct: 80.0,
      capital_cartera_activa: 680000,
      tasa_morosidad_pct: 6.6,
      umbral_morosidad_pct: 5.0,
      capital_cartera_vencida: 45020,
      recuperacion_cartera_pct: 71.4,
      variacion_recuperacion_pp: 3.9,
    },
    evolucion_12w: [
      { semana: 'S-3', fecha_corte: '2026-09-06', liquidez: 225000, obligaciones: 180000 },
      { semana: 'S-2', fecha_corte: '2026-09-13', liquidez: 233000, obligaciones: 182000 },
      { semana: 'S-1', fecha_corte: '2026-09-20', liquidez: 245000, obligaciones: 183000 },
      { semana: 'S0',  fecha_corte: '2026-09-27', liquidez: 240000, obligaciones: 182000 },
      { semana: 'S1',  fecha_corte: '2026-10-04', liquidez: 245000, obligaciones: 183000 },
      { semana: 'S2',  fecha_corte: '2026-10-11', liquidez: 258000, obligaciones: 190000 },
      { semana: 'S3',  fecha_corte: '2026-10-18', liquidez: 250000, obligaciones: 193000 },
      { semana: 'S4',  fecha_corte: '2026-10-25', liquidez: 275000, obligaciones: 195000 },
      { semana: 'S5',  fecha_corte: '2026-11-01', liquidez: 267000, obligaciones: 203000 },
      { semana: 'S6',  fecha_corte: '2026-11-08', liquidez: 285000, obligaciones: 213000 },
      { semana: 'S7',  fecha_corte: '2026-11-15', liquidez: 266000, obligaciones: 225000 },
      { semana: 'S8',  fecha_corte: '2026-11-22', liquidez: 290000, obligaciones: 240000 },
    ],
    prestamos_por_estado: [
      { estado: 'Vigentes', conteo: 19, capital: 634980, color: '#0E7C7B', tipo_alerta: 'saludable' },
      { estado: 'Vencidos', conteo: 7, capital: 45020, color: '#D95D2E', tipo_alerta: 'riesgo' },
      { estado: 'Liquidados', conteo: 13, capital: 315000, color: '#149B98', tipo_alerta: 'saludable' },
    ],
    cartera_vencida_por_tipo: [
      { tipo: 'Personal', monto: 20400, creditos: 3, pct: 45.3, tasa_base: 24.0, color: '#D95D2E', tipo_alerta: 'riesgo' },
      { tipo: 'Negocio', monto: 16100, creditos: 2, pct: 35.8, tasa_base: 18.5, color: '#0E7C7B', tipo_alerta: 'saludable' },
      { tipo: 'Emergencia', monto: 8520, creditos: 2, pct: 18.9, tasa_base: 15.0, color: '#0E7C7B', tipo_alerta: 'saludable' },
    ],
    fonacot_comparativa: {
      pct_socias_caja: 51.9,
      pct_mujeres_fonacot: 44.7,
      brecha_pp: +7.2,
      total_socias_activas: 66,
      trabajadores_fonacot_estado: 22320,
      monto_promedio_fonacot: 24900,
      trimestre_fuente: '4T 2025 · Querétaro (22)',
      detalle_estados: [
        { entidad: 'Querétaro', socias_caja_pct: 51.9, mujeres_fonacot_pct: 44.7 },
      ]
    }
  }
};

/**
 * Registros de Préstamos con Cuotas Vencidas (Nivel 4: Detalle Operativo)
 * Las primeras 3 filas corresponden exactamente a los valores del Wireframe (Figura 1):
 * - Socio 001 | 05/11/2026 | $ 18,400 | 21 días
 * - Socio 002 | 12/11/2026 | $ 12,700 | 14 días
 * - Socio 003 | 18/11/2026 | $ 8,250  | 8 días
 */
export const CUOTAS_VENCIDAS_DATA = [
  {
    id_cuota: 1041,
    id_prestamo: 301,
    id_socio: 1,
    codigo_socio: 'Socio 001',
    nombre_socio: 'María Elena Morales Vega',
    genero: 'M',
    id_sucursal: '1',
    sucursal: 'Sucursal Centro (CDMX)',
    tipo_prestamo: 'Personal',
    num_cuota: '4/12',
    fecha_vencimiento: '05/11/2026',
    fecha_iso: '2026-11-05',
    monto_esperado: 21500,
    monto_pagado: 3100,
    saldo_pendiente: 18400,
    dias_atraso: 21,
    estado_cuota: 'Vencida',
    telefono: '55-4821-9034'
  },
  {
    id_cuota: 1089,
    id_prestamo: 314,
    id_socio: 2,
    codigo_socio: 'Socio 002',
    nombre_socio: 'Roberto Carlos Mendoza Ríos',
    genero: 'H',
    id_sucursal: '2',
    sucursal: 'Sucursal Norte (Jalisco)',
    tipo_prestamo: 'Negocio',
    num_cuota: '6/18',
    fecha_vencimiento: '12/11/2026',
    fecha_iso: '2026-11-12',
    monto_esperado: 12700,
    monto_pagado: 0,
    saldo_pendiente: 12700,
    dias_atraso: 14,
    estado_cuota: 'Vencida',
    telefono: '33-1904-7721'
  },
  {
    id_cuota: 1102,
    id_prestamo: 329,
    id_socio: 3,
    codigo_socio: 'Socio 003',
    nombre_socio: 'Ana Sofía Domínguez Lara',
    genero: 'M',
    id_sucursal: '1',
    sucursal: 'Sucursal Centro (CDMX)',
    tipo_prestamo: 'Personal',
    num_cuota: '3/12',
    fecha_vencimiento: '18/11/2026',
    fecha_iso: '2026-11-18',
    monto_esperado: 10250,
    monto_pagado: 2000,
    saldo_pendiente: 8250,
    dias_atraso: 8,
    estado_cuota: 'Parcial',
    telefono: '55-8392-1140'
  },
  {
    id_cuota: 998,
    id_prestamo: 287,
    id_socio: 4,
    codigo_socio: 'Socio 004',
    nombre_socio: 'Jorge Luis Castañeda Ruiz',
    genero: 'H',
    id_sucursal: '1',
    sucursal: 'Sucursal Centro (CDMX)',
    tipo_prestamo: 'Personal',
    num_cuota: '7/12',
    fecha_vencimiento: '19/10/2026',
    fecha_iso: '2026-10-19',
    monto_esperado: 24800,
    monto_pagado: 0,
    saldo_pendiente: 24800,
    dias_atraso: 38,
    estado_cuota: 'Vencida',
    telefono: '55-6712-4509'
  },
  {
    id_cuota: 1015,
    id_prestamo: 294,
    id_socio: 5,
    codigo_socio: 'Socio 005',
    nombre_socio: 'Claudia Patricia Herrera Soto',
    genero: 'M',
    id_sucursal: '2',
    sucursal: 'Sucursal Norte (Jalisco)',
    tipo_prestamo: 'Negocio',
    num_cuota: '5/24',
    fecha_vencimiento: '26/10/2026',
    fecha_iso: '2026-10-26',
    monto_esperado: 19600,
    monto_pagado: 3200,
    saldo_pendiente: 16400,
    dias_atraso: 31,
    estado_cuota: 'Parcial',
    telefono: '33-4501-8832'
  },
  {
    id_cuota: 1029,
    id_prestamo: 299,
    id_socio: 6,
    codigo_socio: 'Socio 006',
    nombre_socio: 'Fernando Guadalupe Silva Ochoa',
    genero: 'H',
    id_sucursal: '3',
    sucursal: 'Sucursal Bajío (Querétaro)',
    tipo_prestamo: 'Personal',
    num_cuota: '4/12',
    fecha_vencimiento: '31/10/2026',
    fecha_iso: '2026-10-31',
    monto_esperado: 15200,
    monto_pagado: 0,
    saldo_pendiente: 15200,
    dias_atraso: 26,
    estado_cuota: 'Vencida',
    telefono: '442-319-6045'
  },
  {
    id_cuota: 1054,
    id_prestamo: 308,
    id_socio: 7,
    codigo_socio: 'Socio 007',
    nombre_socio: 'Gabriela Alejandra Trejo Navarro',
    genero: 'M',
    id_sucursal: '3',
    sucursal: 'Sucursal Bajío (Querétaro)',
    tipo_prestamo: 'Negocio',
    num_cuota: '8/18',
    fecha_vencimiento: '08/11/2026',
    fecha_iso: '2026-11-08',
    monto_esperado: 16100,
    monto_pagado: 2400,
    saldo_pendiente: 13700,
    dias_atraso: 18,
    estado_cuota: 'Parcial',
    telefono: '442-890-1277'
  },
  {
    id_cuota: 1077,
    id_prestamo: 311,
    id_socio: 8,
    codigo_socio: 'Socio 008',
    nombre_socio: 'Héctor Daniel Espinosa Cruz',
    genero: 'H',
    id_sucursal: '1',
    sucursal: 'Sucursal Centro (CDMX)',
    tipo_prestamo: 'Emergencia',
    num_cuota: '2/6',
    fecha_vencimiento: '10/11/2026',
    fecha_iso: '2026-11-10',
    monto_esperado: 11850,
    monto_pagado: 0,
    saldo_pendiente: 11850,
    dias_atraso: 16,
    estado_cuota: 'Vencida',
    telefono: '55-2390-7612'
  },
  {
    id_cuota: 1094,
    id_prestamo: 320,
    id_socio: 9,
    codigo_socio: 'Socio 009',
    nombre_socio: 'Verónica Leticia Aguilar Pineda',
    genero: 'M',
    id_sucursal: '2',
    sucursal: 'Sucursal Norte (Jalisco)',
    tipo_prestamo: 'Emergencia',
    num_cuota: '3/6',
    fecha_vencimiento: '15/11/2026',
    fecha_iso: '2026-11-15',
    monto_esperado: 9400,
    monto_pagado: 0,
    saldo_pendiente: 9400,
    dias_atraso: 11,
    estado_cuota: 'Vencida',
    telefono: '33-7812-5498'
  },
  {
    id_cuota: 1115,
    id_prestamo: 334,
    id_socio: 10,
    codigo_socio: 'Socio 010',
    nombre_socio: 'Ricardo Arturo Cervantes Meza',
    genero: 'H',
    id_sucursal: '3',
    sucursal: 'Sucursal Bajío (Querétaro)',
    tipo_prestamo: 'Emergencia',
    num_cuota: '1/6',
    fecha_vencimiento: '20/11/2026',
    fecha_iso: '2026-11-20',
    monto_esperado: 6820,
    monto_pagado: 0,
    saldo_pendiente: 6820,
    dias_atraso: 6,
    estado_cuota: 'Vencida',
    telefono: '442-512-3390'
  }
];

/**
 * Obtiene los datos del dashboard aplicando los filtros globales de período y sucursal.
 * Intenta consultar la API FastAPI si está configurada en VITE_API_URL; si no está activa,
 * responde con el modelo de datos sintético validado.
 */
export async function fetchDashboardData({ periodoId = '8w', sucursalId = 'ALL' }) {
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

  const branchData = DATA_BY_BRANCH[sucursalId] || DATA_BY_BRANCH.ALL;
  const periodoObj = PERIODOS.find((p) => p.id === periodoId) || PERIODOS[0];

  // Recortar serie de tiempo según período seleccionado
  const fullSeries = branchData.evolucion_12w;
  const evolucion = fullSeries.slice(fullSeries.length - periodoObj.weeksCount);

  // Filtrar tabla de préstamos con cuotas vencidas por sucursal
  const cuotasFiltradas = sucursalId === 'ALL'
    ? CUOTAS_VENCIDAS_DATA
    : CUOTAS_VENCIDAS_DATA.filter((item) => item.id_sucursal === sucursalId);

  return {
    resumen: branchData.resumen,
    evolucion_semanal: evolucion,
    prestamos_por_estado: branchData.prestamos_por_estado,
    cartera_vencida_por_tipo: branchData.cartera_vencida_por_tipo,
    cuotas_vencidas: cuotasFiltradas,
    fonacot_comparativa: branchData.fonacot_comparativa,
  };
}
