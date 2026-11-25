"""Pasos 11–15: pipeline real, conciliación, reproducibilidad y manejo de errores."""

import csv
from dataclasses import replace
from decimal import Decimal
import json
import shutil

import pytest

import cnbv_etl
import fonacot_etl
import run_etl
from common import EtlError, sha256_file, verify_manifest
from validations import validate_fonacot

SALIDAS = ['cnbv_sector_mes.csv', 'cnbv_institucion_trim.csv', 'cnbv_total_trim.csv', 'fonacot.csv', 'sniiv.csv',
           'rechazos_cnbv.csv', 'rechazos_fonacot.csv', 'rechazos_sniiv.csv']


def rows(path):
    with open(path, encoding='utf-8', newline='') as stream:
        return list(csv.DictReader(stream))


def test_todas_las_validaciones_sin_fallas(manifest):
    for fuente in ('cnbv', 'fonacot', 'sniiv'):
        v = manifest['fuentes'][fuente]['validaciones']
        assert not [p for p in v['pruebas'] if p.startswith('falla')], fuente
        assert v['ok'] + len(v['advertencias']) == v['total']


def test_reproducible_dos_ejecuciones(runs):
    a, b = runs
    for name in SALIDAS + [run_etl.MANIFIESTO]:
        assert sha256_file(a / name) == sha256_file(b / name), name


def test_originales_intactos(settings):
    assert len(verify_manifest(settings)) == 19


def test_manifiesto_describe_salidas(manifest, runs):
    for fuente, sec in manifest['fuentes'].items():
        assert all(e['sha256'] and e['archivo'].startswith('data/raw/') for e in sec['entradas'])
        for o in sec['salidas']:
            assert o['sha256'] == sha256_file(runs[0] / o['archivo'])
            assert o['grano'] and o['columnas'] and o['unidades'] and o['tabla_destino']
            assert o['filas'] == len(rows(runs[0] / o['archivo']))


def test_cnbv_series_y_kpi(runs):
    sector = rows(runs[0] / 'cnbv_sector_mes.csv')
    assert len(sector) == 26 * 23
    v = {(r['mes'], int(r['fila_series'])): r for r in sector}
    activo = v[('2025-03-01', 5)]
    assert (activo['valor_origen'], activo['valor']) == ('294888.150735', '294888150735')
    assert v[('2024-02-01', 5)]['celda'] == 'EG5'  # ventana incluye 2024-02 para KPI de 2025-01
    imor = Decimal(v[('2025-03-01', 17)]['valor']) / Decimal(v[('2025-03-01', 9)]['valor']) * 100
    assert round(imor, 10) == Decimal('4.2361948375')
    assert v[('2025-03-01', 202)]['valor'] == '9545210'  # conteo: no se escala


def test_cnbv_institucional(runs):
    inst = rows(runs[0] / 'cnbv_institucion_trim.csv')
    cpm = {r['mes']: r for r in inst if r['clave_seis'] == '029056'}
    q1 = cpm['2025-03-01']
    assert q1['nombre_boletin'] == 'Caja Popular Mexicana' and q1['estado_reporte'] == 'publicado'
    assert q1['activo_mxn'] == '114228216874' and q1['disponibilidades_mxn'] == '1739002836'
    assert q1['captacion_total_mxn'] == '95561938234' and q1['categoria_nicap'] == '1'
    assert Decimal(q1['tasa_activa_pct']).quantize(Decimal('1e-8')) == Decimal('17.62499647')
    # Q3 tiene columnas desplazadas: la lectura por encabezado da los mismos campos
    assert cpm['2025-09-01']['socios'] == '3814457'
    # n.d./n.a. se conservan como NULL con su marca, nunca como cero
    nd = [r for r in inst if r['estado_reporte'] != 'publicado']
    assert nd and all(r['marcas_origen'] for r in nd)
    assert not any(r['activo_mxn'] == '0' for r in nd)
    total = {r['mes']: r for r in rows(runs[0] / 'cnbv_total_trim.csv')}
    assert total['2025-03-01']['nicap_pct'] == '312.29'


def test_fonacot(runs):
    data = rows(runs[0] / 'fonacot.csv')
    ags = next(r for r in data if r['mes'] == '2025-01-01' and r['ambito_canonico'] == 'AGUASCALIENTES'
               and r['genero'] == 'mujeres')
    assert (ags['creditos'], ags['monto_mxn']) == ('1326', '32050929.75')
    ver = [r for r in data if r['trimestre'] == '2025-Q3' and r['ambito_canonico'].startswith('VERACRUZ')]
    assert {r['etiqueta_creditos_original'] for r in ver} == {'VERACRUZ'}
    assert {r['etiqueta_monto_original'] for r in ver} == {'VERACRUZ DE IGNACIO DE LA LLAVE'}


def test_sniiv_conserva_codigos_y_nulos(runs):
    with open(runs[0] / 'sniiv.csv', encoding='utf-8', newline='') as stream:
        first = next(csv.DictReader(stream))
    assert first['cve_ent'] == '' and first['sexo'] == ''  # NULL, no código inventado
    data = rows(runs[0] / 'sniiv.csv')
    row = next(r for r in data if r['fila_origen'] == '2')
    assert row['cve_ent'] == '01' and row['cve_mun'] == '1' and row['monto_mxn'] == '1475418.03'


def test_validador_detecta_alteracion(settings, tmp_path):
    files = verify_manifest(settings)
    result = fonacot_etl.run(settings, files, tmp_path)
    path = tmp_path / 'fonacot.csv'
    lines = path.read_text(encoding='utf-8').splitlines()
    lines[1] = lines[1].replace(',1847,', ',1848,')  # un crédito de más
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    checks = validate_fonacot(tmp_path, result, settings)
    assert any(c['resultado'] == 'falla' and '2025-Q1' in c['prueba'] for c in checks)


def test_error_de_archivo_no_reemplaza_salida_valida(settings, runs, tmp_path):
    # Copia del manifiesto sin los originales: debe fallar antes de escribir.
    raw = tmp_path / 'raw'
    raw.mkdir()
    shutil.copy(settings.manifest, raw / 'manifest.json')
    out = tmp_path / 'out'
    shutil.copytree(runs[0], out)
    before = {p.name: sha256_file(p) for p in out.iterdir() if p.is_file()}
    assert run_etl.run(['--salida', str(out)], replace(settings, raw_dir=raw)) == 1
    after = {p.name: sha256_file(p) for p in out.iterdir() if p.is_file()}
    assert before == after
    assert not [p for p in out.iterdir() if p.name.startswith('.staging')]
    log = json.loads(sorted((out / 'logs').glob('ejecucion_*.json'))[-1].read_text(encoding='utf-8'))
    assert log['estado'] == 'fallida' and 'Falta archivo original' in log['error']


def test_hash_alterado_detectado(settings, tmp_path):
    # Copia temporal de los originales con un byte añadido a un CSV: el ETL debe rechazarla.
    raw = tmp_path / 'raw'
    shutil.copytree(settings.raw_dir, raw)
    p = raw / 'fonacot' / 'trabajadores_genero_entidad_federativa.csv'
    p.write_bytes(p.read_bytes() + b'\n')
    with pytest.raises(EtlError, match='Hash o tamaño'):
        verify_manifest(replace(settings, raw_dir=raw))


def test_carga_sql_deshabilitada(settings, tmp_path):
    assert run_etl.run(['--cargar', '--salida', str(tmp_path)], settings) == 2
    with pytest.raises(NotImplementedError):
        run_etl.cargar_postgres()


def test_resolver_encabezado_ambiguo():
    rows_ = [('Clave de la Sociedad', 'Activo total A', 'Activo total B'), (None, 'Marzo 2025', 'Marzo 2025')]
    with pytest.raises(EtlError):
        cnbv_etl.resolve(rows_, 0, 'activo total', 'corte', 'marzo 2025')
