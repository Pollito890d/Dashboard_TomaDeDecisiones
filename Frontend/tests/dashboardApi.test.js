import assert from 'node:assert/strict';
import test from 'node:test';

import {
  construirCatalogos,
  construirSeleccionInicial,
} from '../src/services/dashboardApi.js';
import { crearSecuenciaRespuestas } from '../src/utils/respuestasRecientes.js';

const meses = [
  ...Array.from({ length: 12 }, (_, indice) => `2025-${String(12 - indice).padStart(2, '0')}`),
  ...Array.from({ length: 11 }, (_, indice) => `2024-${String(12 - indice).padStart(2, '0')}`),
];
const cortes = ['2025-12', '2025-09', '2025-06', '2025-03'];
const trimestresFonacot = ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4'];

const periodos = {
  cnbv_sectorial: { periodos: meses },
  cnbv_institucional: { periodos: cortes },
  fonacot: {
    periodos: Array.from({ length: 12 }, (_, indice) =>
      `2025-${String(12 - indice).padStart(2, '0')}`),
  },
  sniiv: { periodos: ['2025-12'] },
};

const ranking = {
  corte: '2025-12',
  trimestre: '2025-Q4',
  total_devueltos: 10,
  limitado: true,
  instituciones: Array.from({ length: 10 }, (_, indice) => ({
    clave_seis: String(indice + 1).padStart(6, '0'),
    institucion_nombre: `Cooperativa ranking ${indice + 1}`,
    periodo_ym: '2025-12',
    trimestre: '2025-Q4',
  })),
};

const catalogoInstituciones = {
  total: 155,
  instituciones: Array.from({ length: 155 }, (_, indice) => ({
    institucion_id: indice + 1,
    clave_seis: String(indice + 1).padStart(6, '0'),
    clave_boletin: String(indice + 1),
    clave_catalogo: null,
    nombre: `Cooperativa ${indice + 1}`,
  })),
};

const dashboard = {
  periodo_solicitado: '2025-12',
  serie_anual: Array.from({ length: 12 }, (_, indice) => ({
    periodo_ym: `2025-${String(indice + 1).padStart(2, '0')}`,
  })),
};
const fonacot = { resumen_trimestral: [] };
const sniiv = { resumen_anual: [{ anio: 2025 }] };
const respuestas = { dashboard, instituciones: ranking, fonacot, sniiv };

test('los catálogos cubren todos los períodos observados por fuente', () => {
  const catalogos = construirCatalogos({
    ...respuestas,
    periodos,
    catalogoInstituciones,
  });

  assert.equal(catalogos.periodosMensuales.length, 23);
  assert.equal(catalogos.periodosMensuales[0].value, '2025-12');
  assert.equal(catalogos.periodosMensuales.at(-1).value, '2024-02');
  assert.deepEqual(
    catalogos.periodosInstitucionales.map((item) => item.value),
    cortes,
  );
  assert.deepEqual(
    catalogos.trimestresFonacot.map((item) => item.value),
    [...trimestresFonacot].reverse(),
  );
  assert.deepEqual(catalogos.aniosSniiv.map((item) => item.value), [2025]);
});

test('el selector usa el catálogo completo aunque el ranking traiga una sola ficha', () => {
  const rankingFiltrado = {
    ...ranking,
    instituciones: [ranking.instituciones[0]],
    total_devueltos: 1,
  };
  const catalogos = construirCatalogos({
    ...respuestas,
    instituciones: rankingFiltrado,
    periodos,
    catalogoInstituciones,
  });

  assert.equal(catalogos.instituciones.length, 155);
  assert.equal(catalogos.totalInstitucionesDevueltas, 155);
  assert.equal(catalogos.limitadoInstituciones, false);
  assert.equal(catalogos.catalogoInstitucionesIndependiente, true);
  assert.ok(catalogos.instituciones.every((fila) => fila.corte === null));

  const sinCatalogo = construirCatalogos({ ...respuestas, periodos });
  assert.equal(sinCatalogo.instituciones.length, 10);
});

test('la selección inicial respeta overrides sin borrar la clave institucional', () => {
  const inicial = construirSeleccionInicial(respuestas, {}, periodos);
  assert.equal(inicial.periodo, '2025-12');
  assert.equal(inicial.periodoInstitucional, '2025-12');

  const conClave = construirSeleccionInicial(
    respuestas,
    { claveSeis: '029056', periodoInstitucional: '2025-09' },
    periodos,
  );
  assert.equal(conClave.claveSeis, '029056');
  assert.equal(conClave.periodoInstitucional, '2025-09');

  const mesAnterior = construirSeleccionInicial(
    respuestas,
    { periodo: '2024-02' },
    periodos,
  );
  assert.equal(mesAnterior.periodo, '2024-02');
});

test('la secuencia descarta respuestas que dejaron de ser vigentes', () => {
  const secuencia = crearSecuenciaRespuestas();
  const primero = secuencia.siguiente();
  const segundo = secuencia.siguiente();

  assert.equal(secuencia.esActual(primero), false);
  assert.equal(secuencia.esActual(segundo), true);
});
