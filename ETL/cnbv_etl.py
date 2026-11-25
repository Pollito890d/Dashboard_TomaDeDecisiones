"""Paso 11: extracción y transformación CNBV (sector mensual, institución y total trimestral).

Sin carga a base de datos. Las columnas de los boletines se resuelven por texto de
encabezado y fecha de corte, nunca por letra fija (Q2 y Q3 tienen desplazamientos).
"""

from datetime import date, datetime
from decimal import Decimal
import logging
from pathlib import Path
import re

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

from common import EtlError, Output, SourceResult, norm, to_decimal, write_csv

log = logging.getLogger('etl.cnbv')

SERIES = 'data/raw/cnbv/SH_SOCAPS.xlsm'
BOLETIN = re.compile(r'BE_SOCAPS_(\d{4})(\d{2})\.xlsx$')
MESES = ('enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
         'septiembre', 'octubre', 'noviembre', 'diciembre')
MILLONES, MILES = Decimal(1_000_000), Decimal(1_000)
# Marcas de los boletines: n.d. = no envió información; n.a. = no operaba o ya no opera
# (notas al pie de cada hoja); n.c. aparece sin definición en el archivo. Todas → NULL.
MARCAS = ('n.d.', 'n.a.', 'n.c.')

# Mismas 26 filas aprobadas en dim_concepto_cnbv (ETL/load_catalogs.py, paso 09).
ROWS = {5:'saldo', 6:'saldo', 9:'saldo', 13:'saldo', 17:'saldo', 21:'saldo',
        35:'saldo', 46:'saldo', 141:'flujo_12m', 145:'flujo_12m', 153:'flujo_12m',
        177:'porcentaje', 185:'porcentaje', 193:'porcentaje', 194:'saldo', 195:'saldo',
        196:'porcentaje', 198:'porcentaje', 202:'conteo', 203:'conteo', 204:'conteo',
        210:'porcentaje', 212:'saldo', 213:'saldo', 217:'porcentaje', 224:'porcentaje'}

SECTOR_COLUMNAS = ['mes', 'fila_series', 'codigo_original', 'concepto', 'naturaleza', 'unidad_origen',
                   'unidad_normalizada', 'valor_origen', 'valor', 'archivo', 'hoja', 'celda']

# (campo de salida, hoja, prefijo de grupo, selector de subcolumna, escala)
# selector: 'corte' = fecha actual; 'trim' = flujo del trimestre; 'participacion'; None = columna única.
CAMPOS = [
    ('socios', 'Instituciones (1)', 'numero de socios', 'corte', None),
    ('sucursales', 'Instituciones (1)', 'numero de sucursales', 'corte', None),
    ('activo_mxn', 'Instituciones (1)', 'activo total', 'corte', MILES),
    ('participacion_activo_pct', 'Instituciones (1)', 'activo total', 'participacion', None),
    ('cartera_vigente_mxn', 'Instituciones (2)', 'cartera vigente', 'corte', MILES),
    ('cartera_vencida_mxn', 'Instituciones (2)', 'cartera vencida', 'corte', MILES),
    ('imor_pct', 'Instituciones (2)', 'imor', 'corte', None),
    ('nicap_pct', 'Capitalizacion', 'nivel de capitalizacion', 'corte', None),
    ('categoria_nicap', 'Capitalizacion', 'categoria del nivel de capitalizacion', 'corte', 'texto'),
    ('ingresos_intereses_trim_mxn', 'TI', 'ingresos por intereses', 'trim', MILES),
    ('tasa_activa_pct', 'TI', 'tasa implicita de cartera vigente', None, None),
    ('captacion_total_mxn', 'TI', 'captacion total', 'corte', MILES),
    ('gastos_intereses_trim_mxn', 'TI', 'gastos por intereses captacion total', 'trim', MILES),
    ('tasa_pasiva_total_pct', 'TI', 'tasa implicita de captacion total', None, None),
    ('captacion_tradicional_mxn', 'TI', 'captacion tradicional', 'corte', MILES),
    ('tasa_pasiva_tradicional_pct', 'TI', 'tasa implicita de captacion tradicional', None, None),
]
# Filas de la hoja EF (concepto × sociedad), localizadas por etiqueta exacta.
EF_CAMPOS = [('disponibilidades_mxn', 'disponibilidades'),
             ('estimacion_mxn', 'estimacion preventiva para riesgos crediticios')]
EF_CONTRASTE = [('activo_mxn', 'activo'), ('cartera_vigente_mxn', 'cartera de credito vigente'),
                ('cartera_vencida_mxn', 'cartera de credito vencida'),
                ('captacion_tradicional_mxn', 'captacion tradicional')]
MEDIDAS = ['socios', 'sucursales', 'activo_mxn', 'disponibilidades_mxn', 'cartera_vigente_mxn',
           'cartera_vencida_mxn', 'estimacion_mxn', 'captacion_total_mxn', 'captacion_tradicional_mxn',
           'ingresos_intereses_trim_mxn', 'gastos_intereses_trim_mxn', 'imor_pct', 'nicap_pct',
           'participacion_activo_pct', 'categoria_nicap', 'tasa_activa_pct', 'tasa_pasiva_total_pct',
           'tasa_pasiva_tradicional_pct']
INST_COLUMNAS = (['mes', 'clave_seis', 'clave_boletin', 'nombre_boletin', 'estado_reporte'] + MEDIDAS
                 + ['marcas_origen', 'archivo'])
TOTAL_COLUMNAS = ['mes', 'activo_mxn', 'cartera_vigente_mxn', 'captacion_total_mxn', 'imor_pct',
                  'icor_pct', 'nicap_pct', 'roa_pct', 'archivo']
# Filas de la hoja Indicadores (columna Total, fecha actual).
INDICADORES = [('imor_pct', 'indice de morosidad'), ('icor_pct', 'indice de cobertura'),
               ('roa_pct', 'rendimiento sobre los activos'), ('nicap_pct', 'nivel de capitalizacion')]
TOTALES = {'total', 'total del sector', 'total general'}


def cell(col, row):
    return f'{get_column_letter(col + 1)}{row}'


# --------------------------------------------------------------------------- Series

def sector(settings, result, out_dir):
    path = settings.raw(SERIES)
    wb = load_workbook(path, read_only=True, data_only=True, keep_links=False)
    try:
        rows = list(wb['Series'].iter_rows(max_row=max(ROWS), values_only=True))
    finally:
        wb.close()
    if norm(rows[2][2]) != 'sistema socaps':
        raise EtlError('Series!C3 no es SISTEMA SOCAPS: la hoja no es el consolidado sectorial')
    columns = {}
    for i, v in enumerate(rows[3]):
        if isinstance(v, datetime):
            month = v.date().replace(day=1)
            if month in columns:
                raise EtlError('Fecha duplicada en Series fila 4: ' + str(month))
            columns[month] = i
    months = sorted(m for m in columns if settings.cnbv_mes_desde <= m <= settings.cnbv_mes_hasta)
    expected = []
    m = settings.cnbv_mes_desde
    while m <= settings.cnbv_mes_hasta:
        expected.append(m)
        m = date(m.year + m.month // 12, m.month % 12 + 1, 1)
    if months != expected:
        raise EtlError('Series no tiene todos los meses de la ventana configurada')
    out = []
    for fila, naturaleza in sorted(ROWS.items()):
        r = rows[fila - 1]
        label = r[2].strip() if isinstance(r[2], str) else None
        if not label:
            raise EtlError(f'Series fila {fila} sin etiqueta de concepto')
        origen, normalizada = (('conteo', 'conteo') if naturaleza == 'conteo' else
                               ('porcentaje', 'porcentaje') if naturaleza == 'porcentaje' else
                               ('millones_mxn_inferidos', 'mxn'))
        for month in months:
            col = columns[month]
            raw = r[col] if col < len(r) else None
            value = None
            if raw is None:
                result.reject(SERIES, 'celda vacía: se conserva como NULL', 'Series', fila, cell(col, fila))
            elif isinstance(raw, (int, float)) and not isinstance(raw, bool):
                value = to_decimal(raw)
            else:
                result.reject(SERIES, 'valor no numérico: se conserva como NULL', 'Series', fila,
                              cell(col, fila), str(raw))
            out.append(dict(mes=month.isoformat(), fila_series=fila,
                            codigo_original=None if r[0] is None else str(r[0]).strip(),
                            concepto=label, naturaleza=naturaleza, unidad_origen=origen,
                            unidad_normalizada=normalizada, valor_origen=value,
                            valor=None if value is None else value * MILLONES if normalizada == 'mxn' else value,
                            archivo=SERIES, hoja='Series', celda=cell(col, fila)))
    write_csv(out_dir / 'cnbv_sector_mes.csv', SECTOR_COLUMNAS, out)
    log.info('Series: %s conceptos × %s meses = %s filas', len(ROWS), len(months), len(out))
    return Output('cnbv_sector_mes', 'cnbv_sector_mes.csv', ['mes', 'fila_series'], SECTOR_COLUMNAS,
                  {'valor': 'MXN si unidad_normalizada=mxn (Series × 1,000,000, escala inferida); '
                            'conteo o puntos porcentuales en otro caso',
                   'valor_origen': 'millones de pesos inferidos / conteo / porcentaje, sin escalar'},
                  len(out), 'hecho_cnbv_sector_mes + dim_concepto_cnbv(fila_series)')


# --------------------------------------------------------------------------- Boletines

def sheet(wb, name):
    for title in wb.sheetnames:
        if norm(title) == norm(name):
            return list(wb[title].iter_rows(values_only=True))
    raise EtlError('Hoja no encontrada: ' + name)


def find_header(rows, text):
    for i, r in enumerate(rows):
        for j, v in enumerate(r):
            if norm(v) == text:
                return i, j
    raise EtlError('Encabezado no encontrado: ' + text)


def resolve(rows, hdr, prefix, selector, corte_label):
    """Columna dentro del grupo cuyo encabezado empieza con `prefix`."""
    header, sub = rows[hdr], rows[hdr + 1]
    groups = [(j, norm(v)) for j, v in enumerate(header) if v is not None]
    matches = [k for k, (j, t) in enumerate(groups) if t.startswith(prefix)]
    if len(matches) != 1:
        raise EtlError(f'Grupo de encabezado ambiguo o ausente: {prefix} ({len(matches)})')
    k = matches[0]
    start = groups[k][0]
    end = groups[k + 1][0] if k + 1 < len(groups) else len(header)
    span = range(start, end)
    if selector is None:
        if any(sub[j] is not None for j in span if j < len(sub)):
            raise EtlError('Se esperaba columna única sin subencabezado: ' + prefix)
        return start
    test = {'corte': lambda t: t == corte_label,
            'trim': lambda t: 'trim' in t,
            'participacion': lambda t: t.startswith('participacion %')}[selector]
    found = [j for j in span if j < len(sub) and test(norm(sub[j]))]
    if len(found) != 1:
        raise EtlError(f'Subcolumna {selector} no única en {prefix}: {found}')
    return found[0]


def numeric(result, archivo, hoja, row_number, col, raw, scale, notes, field):
    if raw is None:
        notes[field] = 'vacío'
        return None
    if isinstance(raw, str):
        marker = raw.replace(' ', '').lower()
        if marker in MARCAS:
            notes[field] = marker
            return None
        if scale == 'texto' and raw.strip():
            return raw.strip()
        result.reject(archivo, 'texto no numérico: se conserva como NULL', hoja, row_number, cell(col, row_number), raw)
        notes[field] = 'rechazado'
        return None
    if isinstance(raw, bool):
        raise EtlError('Booleano inesperado en ' + hoja)
    if scale == 'texto':
        value = to_decimal(raw)
        return str(int(value)) if value == value.to_integral_value() else str(value)
    value = to_decimal(raw)
    if field in ('socios', 'sucursales'):
        if value != value.to_integral_value():
            raise EtlError(f'Conteo no entero en {hoja}!{cell(col, row_number)}')
        return int(value)
    return value * scale if isinstance(scale, Decimal) else value


def clave(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)) or v != int(v) or v <= 0:
        return None
    return str(int(v))


def bulletin(settings, entry, result):
    archivo = entry['archivo']
    year, month = map(int, BOLETIN.search(archivo).groups())
    if month not in (3, 6, 9, 12):
        raise EtlError('Boletín sin cierre trimestral: ' + archivo)
    mes = date(year, month, 1)
    corte_label = f'{MESES[month - 1]} {year}'
    wb = load_workbook(settings.raw(archivo), read_only=True, data_only=True, keep_links=False)
    try:
        sheets = {n: sheet(wb, n) for n in ('Instituciones (1)', 'Instituciones (2)', 'Capitalizacion',
                                              'TI', 'EF', 'Indicadores')}
    finally:
        wb.close()

    institutions, totals, fields_by_sheet = {}, {}, {}
    for campo, hoja, prefix, selector, scale in CAMPOS:
        fields_by_sheet.setdefault(hoja, []).append((campo, prefix, selector, scale))
    for hoja, fields in fields_by_sheet.items():
        rows = sheets[hoja]
        hdr, kcol = find_header(rows, 'clave de la sociedad')
        ncol = next(j for j, v in enumerate(rows[hdr]) if norm(v) == 'nombre de la sociedad')
        cols = {campo: resolve(rows, hdr, prefix, selector, corte_label) for campo, prefix, selector, _ in fields}
        seen = set()
        for i in range(hdr + 2, len(rows)):
            r = rows[i]
            row_number = i + 1
            name = r[ncol] if ncol < len(r) else None
            key = clave(r[kcol]) if kcol < len(r) else None
            if key is None:
                if norm(name) in TOTALES:
                    # Subtotal publicado: se excluye del detalle institucional.
                    totals.setdefault(hoja, (row_number, r))
                continue
            if key in seen:
                raise EtlError(f'Clave duplicada {key} en {hoja} de {archivo}')
            seen.add(key)
            rec = institutions.setdefault(key, dict(mes=mes.isoformat(), clave_boletin=key,
                                                    clave_seis=key.zfill(6), archivo=archivo,
                                                    notes={}, hojas=set()))
            rec['hojas'].add(hoja)
            if hoja == 'Instituciones (1)':
                rec['nombre_boletin'] = name.strip() if isinstance(name, str) else None
            for campo, _, _, scale in fields:
                col = cols[campo]
                rec[campo] = numeric(result, archivo, hoja, row_number, col,
                                     r[col] if col < len(r) else None, scale, rec['notes'], campo)
        if hoja not in totals:
            raise EtlError(f'Fila de total no encontrada en {hoja} de {archivo}')

    universe = {k for k, v in institutions.items() if 'Instituciones (1)' in v['hojas']}
    extra = set(institutions) - universe
    for k in sorted(extra):
        result.reject(archivo, 'clave fuera de Instituciones (1): se descarta del detalle', columna='Clave', valor=k)
        del institutions[k]

    # EF: matriz concepto × sociedad, columna localizada por clave.
    ef = sheets['EF']
    hdr, kcol = find_header(ef, 'clave de la sociedad')
    _, lcol = find_header(ef, 'concepto')
    keys = {clave(v): j for j, v in enumerate(ef[hdr]) if j > kcol and clave(v)}
    label_rows = {}
    for i, r in enumerate(ef):
        t = norm(r[lcol]) if lcol < len(r) else ''
        label_rows.setdefault(t, i)
    for campo, label in EF_CAMPOS + EF_CONTRASTE:
        if label not in label_rows:
            raise EtlError(f'Fila EF no encontrada: {label}')
    ef_contrast = []
    for key, rec in institutions.items():
        col = keys.get(key)
        if col is None:
            for campo, _ in EF_CAMPOS:
                rec[campo] = None
                rec['notes'][campo] = 'sin_columna_ef'
            result.reject(archivo, 'sociedad sin columna en EF: disponibilidades/estimación NULL',
                          'EF', columna='Clave', valor=key)
            continue
        for campo, label in EF_CAMPOS:
            i = label_rows[label]
            raw = ef[i][col] if col < len(ef[i]) else None
            rec[campo] = numeric(result, archivo, 'EF', i + 1, col, raw, MILES, rec['notes'], campo)
        for campo, label in EF_CONTRASTE:
            i = label_rows[label]
            raw = ef[i][col] if col < len(ef[i]) else None
            if isinstance(raw, (int, float)) and not isinstance(raw, bool) and rec.get(campo) is not None:
                ef_contrast.append(abs(to_decimal(raw) * MILES - rec[campo]))

    out = []
    for key in sorted(institutions, key=lambda k: k.zfill(6)):
        rec = institutions[key]
        present = sum(rec.get(c) is not None for c in MEDIDAS)
        rec['estado_reporte'] = ('publicado' if present == len(MEDIDAS) else
                                 'no_reportado' if present == 0 else 'parcial')
        for campo in MEDIDAS:
            if campo not in rec and campo not in rec['notes']:
                rec['notes'][campo] = 'sin_fila'  # la sociedad no aparece en esa hoja
        rec['marcas_origen'] = ';'.join(f'{k}={v}' for k, v in sorted(rec['notes'].items())) or None
        out.append(rec)

    # Totales publicados (no se suman sociedades).
    def total(hoja, campo, prefix):
        rows = sheets[hoja]
        hdr, _ = find_header(rows, 'clave de la sociedad')
        col = resolve(rows, hdr, prefix, 'corte', corte_label)
        row_number, r = totals[hoja]
        return numeric(result, archivo, hoja, row_number, col, r[col], MILES, {}, campo)

    ind = sheets['Indicadores']
    hdr = next(i for i, r in enumerate(ind) if any(norm(v) == 'nivel de operacion iv' for v in r))
    tcol = resolve(ind, hdr, 'total', 'corte', corte_label)
    lcol = next(j for r in ind for j, v in enumerate(r) if norm(v) == 'numero de sociedades')
    tot = dict(mes=mes.isoformat(), archivo=archivo,
               activo_mxn=total('Instituciones (1)', 'activo_mxn', 'activo total'),
               cartera_vigente_mxn=total('TI', 'cartera_vigente_mxn', 'cartera vigente'),
               captacion_total_mxn=total('TI', 'captacion_total_mxn', 'captacion total'))
    for campo, label in INDICADORES:
        # Las notas al pie repiten el nombre del indicador, pero sin valor en la columna Total.
        found = [i for i, r in enumerate(ind) if lcol < len(r) and tcol < len(r)
                 and norm(r[lcol]).startswith(label) and r[tcol] is not None]
        if len(found) != 1:
            raise EtlError(f'Indicador no único en Indicadores: {label}')
        tot[campo] = numeric(result, archivo, 'Indicadores', found[0] + 1, tcol, ind[found[0]][tcol],
                             None, {}, campo)
    stats = dict(instituciones=len(out), excluidos_subtotal={h: f'fila {n}' for h, (n, _) in totals.items()},
                 estados={s: sum(r['estado_reporte'] == s for r in out) for s in ('publicado', 'parcial', 'no_reportado')},
                 ef_diferencia_max_mxn=str(max(ef_contrast)) if ef_contrast else None,
                 ef_comparaciones=len(ef_contrast))
    return out, tot, stats


def run(settings, files, out_dir):
    entradas = [SERIES] + sorted(f for f in files if BOLETIN.search(f))
    if len(entradas) != 5:
        raise EtlError('Se esperaban SH_SOCAPS.xlsm y 4 boletines CNBV')
    result = SourceResult('cnbv', entradas, [])
    result.salidas.append(sector(settings, result, out_dir))
    inst, totals = [], []
    for archivo in entradas[1:]:
        rows, tot, stats = bulletin(settings, files[archivo], result)
        inst.extend(rows)
        totals.append(tot)
        result.conciliacion[Path(archivo).name] = stats
        log.info('%s: %s sociedades, estados %s', Path(archivo).name, stats['instituciones'], stats['estados'])
    write_csv(out_dir / 'cnbv_institucion_trim.csv', INST_COLUMNAS, inst)
    write_csv(out_dir / 'cnbv_total_trim.csv', TOTAL_COLUMNAS, totals)
    result.salidas.append(Output(
        'cnbv_institucion_trim', 'cnbv_institucion_trim.csv', ['mes', 'clave_seis'], INST_COLUMNAS,
        {'*_mxn': 'MXN (boletín en miles × 1,000, escala declarada)', '*_pct': 'puntos porcentuales publicados',
         'socios, sucursales': 'conteo al cierre', '*_trim_mxn': 'flujo del trimestre en MXN'},
        len(inst), 'hecho_cnbv_institucion_trim (+ dim_institucion por clave_seis)'))
    result.salidas.append(Output(
        'cnbv_total_trim', 'cnbv_total_trim.csv', ['mes'], TOTAL_COLUMNAS,
        {'*_mxn': 'MXN (miles × 1,000)', '*_pct': 'puntos porcentuales publicados en Indicadores'},
        len(totals), 'hecho_cnbv_total_trim'))
    return result
