"""Paso 12: extracción y transformación FONACOT (ancho → largo) sin base de datos.

Cada trimestre tiene dos CSV: «trabajadores» (el diccionario PDF lo define como número de
créditos otorgados, no personas distintas) e «importe» (monto ejercido en pesos). Se
emparejan por (mes, entidad/canal, género); APP MOVIL es canal, no entidad federativa.
"""

from datetime import date
from io import StringIO
import logging
from pathlib import Path
import re

import pandas as pd

from common import EtlError, Output, SourceResult, norm, parse_csv_number, write_csv

log = logging.getLogger('etl.fonacot')

MESES = {'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
         'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12}
COLUMNA = re.compile(r'([A-Za-z]{3})_(mujeres|hombres)')
CANONICOS = {'VERACRUZ': 'VERACRUZ DE IGNACIO DE LA LLAVE'}
CANAL = 'APP MOVIL'
COLUMNAS = ['mes', 'trimestre', 'tipo_ambito', 'ambito_canonico', 'genero', 'creditos', 'monto_mxn',
            'etiqueta_creditos_original', 'etiqueta_monto_original', 'columna_original',
            'archivo_creditos', 'archivo_monto']


def quarter(entry):
    match = re.match(r'(\d{4})-Q([1-4])', entry['periodo'])
    if not match:
        raise EtlError('Periodo trimestral no reconocido: ' + entry['archivo'])
    return int(match.group(1)), int(match.group(2))


def kind(path):
    name = norm(Path(path).name)
    if 'trabajadores' in name:
        return 'creditos'
    if 'importe' in name:
        return 'monto'
    raise EtlError('CSV FONACOT sin tipo reconocible: ' + path)


def read(settings, archivo, result):
    raw = settings.raw(archivo).read_bytes()
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        text = raw.decode('cp1252')
    df = pd.read_csv(StringIO(text), dtype=str, keep_default_na=False, header=0)
    first = df.columns[0]
    if norm(first).replace('_', ' ') != 'entidad federativa':
        raise EtlError('Primera columna inesperada en ' + archivo)
    data_cols = {}
    for c in df.columns[1:]:
        m = COLUMNA.fullmatch(c.strip())
        if m and m.group(1).lower() in MESES:
            data_cols[c] = (MESES[m.group(1).lower()], m.group(2))
        elif c.startswith('Unnamed') or not c.strip():
            # Columnas traseras sin encabezado: deben estar vacías para descartarse.
            if (df[c].str.strip() != '').any():
                raise EtlError(f'Columna sin encabezado con datos en {archivo}')
        else:
            raise EtlError(f'Columna no reconocida «{c}» en {archivo}')
    records = []
    for i, row in df.iterrows():
        label = row[first].strip()
        line = i + 2
        if not label:
            if any(row[c].strip() for c in data_cols):
                result.reject(archivo, 'fila con datos sin entidad: descartada', fila=line)
            continue
        canon = CANONICOS.get(label.upper(), label.upper())
        tipo = 'canal' if canon == CANAL else 'entidad'
        for c, (month, gender) in data_cols.items():
            records.append(dict(label=label, canon=canon, tipo=tipo, month=month, gender=gender,
                                column=c.strip(), value=parse_csv_number(row[c]), line=line))
    return records


def run(settings, files, out_dir):
    entries = sorted((f for f in files.values() if f['fuente'] == 'fonacot' and f['formato'] == 'csv'),
                     key=lambda f: f['archivo'])
    if len(entries) != 8:
        raise EtlError('Se esperaban 8 CSV FONACOT')
    result = SourceResult('fonacot', [f['archivo'] for f in entries], [])
    pairs = {}
    for f in entries:
        key = quarter(f)
        slot = pairs.setdefault(key, {})
        k = kind(f['archivo'])
        if k in slot:
            raise EtlError(f'Dos archivos de {k} para {key}')
        slot[k] = f['archivo']
    out, sums = [], {}
    for (year, q), slot in sorted(pairs.items()):
        if set(slot) != {'creditos', 'monto'}:
            raise EtlError(f'Trimestre {year}-Q{q} sin pareja créditos/monto')
        months = {3 * (q - 1) + 1, 3 * (q - 1) + 2, 3 * (q - 1) + 3}
        merged = {}
        for k, archivo in slot.items():
            seen = set()
            for rec in read(settings, archivo, result):
                if rec['month'] not in months:
                    raise EtlError(f'Mes fuera del trimestre en {archivo}: {rec["column"]}')
                key = (rec['month'], rec['tipo'], rec['canon'], rec['gender'])
                if key in seen:
                    raise EtlError(f'Clave duplicada {key} en {archivo}')
                seen.add(key)
                if k == 'creditos' and rec['value'] is not None:
                    if rec['value'] != rec['value'].to_integral_value() or rec['value'] < 0:
                        raise EtlError(f'Créditos no enteros o negativos en {archivo} fila {rec["line"]}')
                    rec['value'] = int(rec['value'])
                if rec['value'] is None:
                    result.reject(archivo, 'celda vacía: se conserva como NULL', fila=rec['line'],
                                  columna=rec['column'])
                m = merged.setdefault(key, dict(
                    mes=date(year, rec['month'], 1).isoformat(), trimestre=f'{year}-Q{q}', tipo_ambito=rec['tipo'],
                    ambito_canonico=rec['canon'], genero=rec['gender'], columna_original=rec['column'],
                    creditos=None, monto_mxn=None, etiqueta_creditos_original=None, etiqueta_monto_original=None,
                    archivo_creditos=None, archivo_monto=None))
                field = 'creditos' if k == 'creditos' else 'monto_mxn'
                m[field] = rec['value']
                m['etiqueta_' + ('creditos' if k == 'creditos' else 'monto') + '_original'] = rec['label']
                m['archivo_' + ('creditos' if k == 'creditos' else 'monto')] = archivo
                s = sums.setdefault((year, q, k), 0)
                sums[(year, q, k)] = s + (rec['value'] or 0)
        for key, m in merged.items():
            if m['archivo_creditos'] is None or m['archivo_monto'] is None:
                result.reject(slot['creditos'] if m['archivo_creditos'] is None else slot['monto'],
                              'clave sin pareja en el otro CSV del trimestre', columna=m['columna_original'],
                              valor=f'{m["ambito_canonico"]} {m["genero"]}')
        out.extend(merged.values())
        result.conciliacion[f'{year}-Q{q}'] = dict(
            archivos=slot, filas=len(merged),
            ambitos=len({(m['tipo_ambito'], m['ambito_canonico']) for m in merged.values()}),
            creditos=sums[(year, q, 'creditos')], monto_mxn=str(sums[(year, q, 'monto')]),
            sin_pareja=sum(m['archivo_creditos'] is None or m['archivo_monto'] is None for m in merged.values()))
        log.info('FONACOT %s-Q%s: %s filas, créditos %s, monto %s', year, q, len(merged),
                 sums[(year, q, 'creditos')], sums[(year, q, 'monto')])
    out.sort(key=lambda r: (r['mes'], r['tipo_ambito'] != 'entidad', r['ambito_canonico'], r['genero']))
    write_csv(out_dir / 'fonacot.csv', COLUMNAS, out)
    result.salidas.append(Output(
        'fonacot', 'fonacot.csv', ['mes', 'tipo_ambito', 'ambito_canonico', 'genero'], COLUMNAS,
        {'creditos': 'conteo mensual de créditos ejercidos (no personas únicas)',
         'monto_mxn': 'pesos mexicanos, flujo mensual'},
        len(out), 'hecho_fonacot_mes (+ dim_ambito_fonacot, dim_genero_fonacot)'))
    return result
