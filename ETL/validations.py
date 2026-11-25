"""Paso 15: validaciones de calidad y conciliación de las salidas locales del ETL.

Cada prueba devuelve `ok`, `falla` o `advertencia`. Una falla impide publicar la salida.
Los valores esperados provienen de docs/perfil_datos.md y docs/catalogo_kpis.md.
"""

import csv
from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal
from pathlib import Path

from common import decimals

TOL_PP = Decimal('1e-9')  # tolerancia en puntos porcentuales al recomputar ratios publicados

ESPERADO = {
    # docs/perfil_datos.md §4 y catalogo_kpis.md M-03
    'fonacot': {'2025-Q1': (503416, Decimal('15525525836.55')), '2025-Q2': (510842, Decimal('15838163285.81')),
                '2025-Q3': (601649, Decimal('18517548812.57')), '2025-Q4': (561561, Decimal('16889088475.45'))},
    'fonacot_mujeres_q1': Decimal('40.969496'),
    # docs/perfil_datos.md §5 y catalogo_kpis.md M-04
    'sniiv': dict(filas=325649, acciones=998745, monto=Decimal('617246458236.39'), sin_sexo_filas=399,
                  sin_sexo_acciones=4),
    # catalogo_kpis.md §2 (2025-03, 10 decimales)
    'kpi_2025_03': {'imor': Decimal('4.2361948375'), 'icor': Decimal('125.5267605593'),
                    'liquidez': Decimal('37.6929816952'), 'nicap': Decimal('306.5197159872'),
                    'tasa_activa': Decimal('18.1688146566'), 'tasa_pasiva': Decimal('5.8022194344'),
                    'capital_activo': Decimal('18.0284996299'), 'roa': Decimal('2.5445223519'),
                    'colocacion_captacion': Decimal('68.8889316436'), 'mujeres': Decimal('54.1876615945')},
    # catalogo_kpis.md §3.1: Caja Popular Mexicana (029056)
    'cpm': {'2025-03-01': dict(socios=3692848, imor=Decimal('3.2047661254'), icor=Decimal('149.12378737')),
            '2025-12-01': dict(socios=3873780, imor=Decimal('2.8122274044'), icor=Decimal('158.96528814'))},
    'coloc_inst': {'2025-03-01': Decimal('68.63738028'), '2025-12-01': Decimal('68.92611693')},
}
# Escalas del esquema (Database/01_schema.sql): MXN numeric(30,6), porcentajes numeric(20,10).
ESCALA_MXN, ESCALA_PCT = 6, 10


def read(path):
    with Path(path).open(encoding='utf-8', newline='') as stream:
        reader = csv.DictReader(stream)
        return reader.fieldnames, list(reader)


class Checks:
    def __init__(self, fuente):
        self.fuente, self.items = fuente, []

    def add(self, prueba, ok, detalle='', nivel='falla'):
        self.items.append(dict(fuente=self.fuente, prueba=prueba,
                               resultado='ok' if ok else nivel, detalle=str(detalle)))

    def close(self, prueba, observado, esperado, tol):
        diff = abs(Decimal(observado) - Decimal(esperado))
        self.add(prueba, diff <= tol, f'observado={observado} esperado={esperado} dif={diff}')


def dec(v):
    return None if v in ('', None) else Decimal(v)


def check_contract(c, out_dir, output):
    path = Path(out_dir) / output.archivo
    c.add(f'{output.nombre}: archivo existe', path.is_file(), output.archivo)
    if not path.is_file():
        return []
    header, rows = read(path)
    c.add(f'{output.nombre}: columnas del contrato', header == output.columnas, header)
    c.add(f'{output.nombre}: filas declaradas', len(rows) == output.filas, f'{len(rows)} vs {output.filas}')
    keys = Counter(tuple(r[k] for k in output.grano) for r in rows)
    dups = sum(n for n in keys.values() if n > 1)
    c.add(f'{output.nombre}: grano único {output.grano}', dups == 0, f'{dups} filas duplicadas')
    return rows


def scale(c, rows, columns, limit, name):
    over = sum(1 for r in rows for col in columns if r[col] and decimals(r[col]) > limit)
    c.add(f'{name}: ≤{limit} decimales', over == 0,
          f'{over} valores exceden la escala del esquema; PostgreSQL los redondearía', 'advertencia')


# --------------------------------------------------------------------------- CNBV

def validate_cnbv(out_dir, result, settings):
    c = Checks('cnbv')
    outs = {o.nombre: o for o in result.salidas}
    sector = check_contract(c, out_dir, outs['cnbv_sector_mes'])
    inst = check_contract(c, out_dir, outs['cnbv_institucion_trim'])
    total = check_contract(c, out_dir, outs['cnbv_total_trim'])

    from cnbv_etl import ROWS, MILLONES
    months = sorted({r['mes'] for r in sector})
    c.add('sector: 26 conceptos aprobados', {int(r['fila_series']) for r in sector} == set(ROWS))
    c.add('sector: meses consecutivos de la ventana configurada',
          months[0] == settings.cnbv_mes_desde.isoformat() and months[-1] == settings.cnbv_mes_hasta.isoformat()
          and len(months) * len(ROWS) == len(sector), f'{months[0]}…{months[-1]}, {len(months)} meses')
    bad_scale = [r for r in sector if r['valor'] and r['unidad_normalizada'] == 'mxn'
                 and Decimal(r['valor']) != Decimal(r['valor_origen']) * MILLONES]
    bad_scale += [r for r in sector if r['valor'] and r['unidad_normalizada'] != 'mxn' and r['valor'] != r['valor_origen']]
    c.add('sector: escala millones→MXN exacta; conteos y % sin escalar', not bad_scale, f'{len(bad_scale)} filas')
    nulls = sum(1 for r in sector if r['valor'] == '')
    c.add('sector: sin nulos en la ventana', nulls == 0, f'{nulls} nulos', 'advertencia')
    scale(c, sector, ['valor'], ESCALA_MXN, 'sector valor')

    v = defaultdict(dict)
    for r in sector:
        if r['valor_origen']:
            v[r['mes']][int(r['fila_series'])] = Decimal(r['valor_origen'])

    def prom12(mes, fila):
        i = months.index(mes)
        window = months[i - 11:i + 1]
        if i < 11 or any(fila not in v[m] for m in window):
            return None
        return sum(v[m][fila] for m in window) / 12

    # Recomputar KPIs con los valores exportados y compararlos con las filas publicadas en Series.
    formulas = {
        'imor': (lambda m: v[m][17] / v[m][9] * 100, 177),
        'icor': (lambda m: abs(v[m][21]) / v[m][17] * 100, 185),
        'liquidez': (lambda m: v[m][194] / v[m][195] * 100, 193),
        'nicap': (lambda m: v[m][212] / v[m][213] * 100, 210),
        'capital_activo': (lambda m: v[m][46] / v[m][5] * 100, 198),
        'roa': (lambda m: v[m][141] / prom12(m, 5) * 100, 196),
        'tasa_activa': (lambda m: v[m][145] / prom12(m, 13) * 100, 217),
        'tasa_pasiva': (lambda m: v[m][153] / prom12(m, 35) * 100, 224),
        'colocacion_captacion': (lambda m: v[m][13] / v[m][35] * 100, None),
        'mujeres': (lambda m: v[m][203] / (v[m][203] + v[m][204]) * 100, None),
    }
    year_2025 = [m for m in months if m.startswith('2025-')]
    for name, (f, published) in formulas.items():
        if published is not None:
            diffs = [abs(f(m) - v[m][published]) for m in year_2025]
            c.add(f'KPI {name}: recomputado = publicado (fila {published}), 12 meses 2025',
                  len(diffs) == 12 and max(diffs) <= TOL_PP, f'dif máx {max(diffs):.3E} pp')
        c.close(f'KPI {name} 2025-03 vs catalogo_kpis.md', f('2025-03-01'),
                ESPERADO['kpi_2025_03'][name], Decimal('1e-10'))

    # Institucional
    by_month = Counter(r['mes'] for r in inst)
    c.add('institucional: 155 sociedades por corte', set(by_month.values()) == {155}, dict(by_month))
    c.add('institucional: cortes trimestrales 2025', sorted(by_month) ==
          ['2025-03-01', '2025-06-01', '2025-09-01', '2025-12-01'])
    c.add('institucional: clave_seis de 6 dígitos y = 0+clave_boletin',
          all(len(r['clave_seis']) == 6 and r['clave_seis'].isdigit() and r['clave_seis'] == r['clave_boletin'].zfill(6)
              for r in inst))
    c.add('institucional: 155 claves distintas en la unión', len({r['clave_seis'] for r in inst}) == 155)
    c.add('institucional: sin filas de total', not any(r['nombre_boletin'].strip().lower() in
                                                      ('total', 'total del sector', 'total general') for r in inst))
    c.add('institucional: estado_reporte en dominio',
          {r['estado_reporte'] for r in inst} <= {'publicado', 'parcial', 'no_reportado'})
    from cnbv_etl import MEDIDAS
    c.add('institucional: "publicado" sin nulos y nulos con marca de origen',
          all(all(r[m] for m in MEDIDAS) for r in inst if r['estado_reporte'] == 'publicado')
          and all(r['marcas_origen'] for r in inst if r['estado_reporte'] != 'publicado'))
    c.add('institucional: categoría NICAP en {1,2,3,4} o NULL', {r['categoria_nicap'] for r in inst} <= {'', '1', '2', '3', '4'},
          sorted({r['categoria_nicap'] for r in inst}))
    c.add('institucional: conteos enteros', all(r[k] == '' or r[k].isdigit() for r in inst for k in ('socios', 'sucursales')))
    scale(c, inst, [m for m in MEDIDAS if m.endswith('_mxn')], ESCALA_MXN, 'institucional MXN')
    scale(c, inst, [m for m in MEDIDAS if m.endswith('_pct')], ESCALA_PCT, 'institucional %')
    for mes, exp in ESPERADO['cpm'].items():
        r = next(r for r in inst if r['mes'] == mes and r['clave_seis'] == '029056')
        c.add(f'CPM {mes}: socios', int(r['socios']) == exp['socios'], r['socios'])
        c.close(f'CPM {mes}: IMOR publicado', r['imor_pct'], exp['imor'], Decimal('1e-10'))
        icor = abs(Decimal(r['estimacion_mxn'])) / Decimal(r['cartera_vencida_mxn']) * 100
        c.close(f'CPM {mes}: ICOR derivado (EF/Instituciones (2))', icor, exp['icor'], Decimal('1e-8'))

    # Total publicado
    c.add('total: 4 cortes', len(total) == 4)
    for r in total:
        if r['mes'] in ESPERADO['coloc_inst']:
            ratio = Decimal(r['cartera_vigente_mxn']) / Decimal(r['captacion_total_mxn']) * 100
            c.close(f'total {r["mes"]}: colocación/captación institucional', ratio,
                    ESPERADO['coloc_inst'][r['mes']], Decimal('1e-8'))
    for r in total:
        activo = sum(Decimal(i['activo_mxn']) for i in inst if i['mes'] == r['mes'] and i['activo_mxn'])
        diff = abs(activo - Decimal(r['activo_mxn']))
        c.add(f'total {r["mes"]}: Σ activo de sociedades = TOTAL publicado (±1 MXN)', diff <= 1,
              f'dif {diff} MXN', 'advertencia')
    return c.items


# --------------------------------------------------------------------------- FONACOT

def validate_fonacot(out_dir, result, settings):
    c = Checks('fonacot')
    rows = check_contract(c, out_dir, result.salidas[0])
    c.add('fonacot: 792 filas (12 meses × 33 ámbitos × 2 géneros)', len(rows) == 792, len(rows))
    per_month = defaultdict(set)
    for r in rows:
        per_month[r['mes']].add((r['tipo_ambito'], r['ambito_canonico']))
    c.add('fonacot: 33 ámbitos por mes (32 entidades + APP MOVIL)',
          all(len(s) == 33 and sum(t == 'canal' for t, _ in s) == 1 for s in per_month.values()) and len(per_month) == 12)
    c.add('fonacot: APP MOVIL solo como canal',
          all((r['tipo_ambito'] == 'canal') == (r['ambito_canonico'] == 'APP MOVIL') for r in rows))
    c.add('fonacot: Veracruz canonizado', not any(r['ambito_canonico'] == 'VERACRUZ' for r in rows))
    c.add('fonacot: géneros mujeres/hombres', {r['genero'] for r in rows} == {'mujeres', 'hombres'})
    c.add('fonacot: ambos archivos y etiquetas presentes',
          all(r['archivo_creditos'] and r['archivo_monto'] and r['etiqueta_creditos_original']
              and r['etiqueta_monto_original'] for r in rows))
    c.add('fonacot: créditos enteros ≥0', all(r['creditos'].isdigit() for r in rows if r['creditos']))
    nulls = sum(1 for r in rows if not r['creditos'] or not r['monto_mxn'])
    c.add('fonacot: sin celdas vacías', nulls == 0, f'{nulls} nulos', 'advertencia')
    scale(c, rows, ['monto_mxn'], 2, 'fonacot monto')
    for q, (cred, monto) in ESPERADO['fonacot'].items():
        qr = [r for r in rows if r['trimestre'] == q]
        c.add(f'fonacot {q}: Σ créditos = CSV', sum(int(r['creditos']) for r in qr) == cred, cred)
        c.add(f'fonacot {q}: Σ monto = CSV', sum(Decimal(r['monto_mxn']) for r in qr) == monto, monto)
    q1 = [r for r in rows if r['trimestre'] == '2025-Q1']
    muj = sum(int(r['creditos']) for r in q1 if r['genero'] == 'mujeres') / Decimal(sum(int(r['creditos']) for r in q1)) * 100
    c.close('fonacot Q1: participación femenina de créditos', muj, ESPERADO['fonacot_mujeres_q1'], Decimal('5e-7'))
    return c.items


# --------------------------------------------------------------------------- SNIIV

def validate_sniiv(out_dir, result, settings):
    c = Checks('sniiv')
    rows = check_contract(c, out_dir, result.salidas[0])
    e = ESPERADO['sniiv']
    acciones = sum(int(r['acciones']) for r in rows)
    monto = sum((Decimal(r['monto_mxn']) for r in rows), Decimal(0))
    sin_sexo = [r for r in rows if r['sexo'] == '']
    c.add('sniiv: 325,649 registros', len(rows) == e['filas'], len(rows))
    c.add('sniiv: 998,745 acciones', acciones == e['acciones'], acciones)
    c.add('sniiv: $617,246,458,236.39 MXN', monto == e['monto'], monto)
    c.add('sniiv: 399 filas sin sexo que suman 4 acciones',
          len(sin_sexo) == e['sin_sexo_filas'] and sum(int(r['acciones']) for r in sin_sexo) == e['sin_sexo_acciones'])
    c.add('sniiv: meses 2025-01…2025-12', {r['mes'] for r in rows} == {date(2025, m, 1).isoformat() for m in range(1, 13)})
    c.add('sniiv: cve_ent de 2 caracteres (ceros iniciales conservados)',
          all(len(r['cve_ent']) == 2 for r in rows if r['cve_ent']))
    c.add('sniiv: acciones enteras ≥0', all(r['acciones'].isdigit() for r in rows))
    scale(c, rows, ['monto_mxn'], 2, 'sniiv monto')
    c.add('sniiv: fila_origen única (sin duplicar registros)', len({r['fila_origen'] for r in rows}) == len(rows))
    return c.items


VALIDADORES = {'cnbv': validate_cnbv, 'fonacot': validate_fonacot, 'sniiv': validate_sniiv}
