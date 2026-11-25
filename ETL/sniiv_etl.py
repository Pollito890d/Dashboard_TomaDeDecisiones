"""Paso 13: extracción y transformación SNIIV (financiamientos 2025) sin base de datos.

El CSV es la única fuente de hechos. XLSX y JSON de la misma serie solo se usan como
contraste: nunca se suman. Los códigos se conservan como texto exacto del CSV (sin
rellenar ni quitar ceros) y las celdas vacías se conservan como NULL.
"""

from collections import defaultdict
from datetime import date
from decimal import Decimal
import json
import logging
import re

import pandas as pd
from openpyxl import load_workbook

from common import EtlError, Output, SourceResult, write_csv

log = logging.getLogger('etl.sniiv')

CSV = 'data/raw/sniiv/financiamientos_2025.csv'
DICCIONARIO = 'data/raw/sniiv/diccionario_financiamiento.xlsx'
JSON = 'data/raw/sniiv/financiamiento_2025_api.json'
ORIGEN = ['año', 'mes', 'cve_ent', 'entidad', 'cve_mun', 'municipio', 'organismo', 'modalidad', 'destino',
          'tipo', 'sexo', 'edad_rango', 'ingresos_rango', 'vivienda_valor', 'acciones', 'monto']
CATEGORIAS = ['organismo', 'modalidad', 'destino', 'tipo', 'sexo', 'edad_rango', 'ingresos_rango', 'vivienda_valor']
# Grano: año-mes (mes) + 10 códigos; entidad y municipio son etiquetas, no clave.
GRANO = ['mes', 'cve_ent', 'cve_mun'] + CATEGORIAS
COLUMNAS = ['mes', 'cve_ent', 'entidad', 'cve_mun', 'municipio'] + CATEGORIAS + ['acciones', 'monto_mxn', 'fila_origen']
ENTERO = re.compile(r'\d+')
MONTO = re.compile(r'-?\d+(?:\.\d+)?')
MESES_JSON = ('enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
              'septiembre', 'octubre', 'noviembre', 'diciembre')


def dictionary_codes(settings):
    wb = load_workbook(settings.raw(DICCIONARIO), read_only=True, data_only=True)
    try:
        codes, field = defaultdict(set), None
        for r in wb['Financiamientos'].iter_rows(min_row=2, values_only=True):
            if r[1]:
                field = str(r[1]).strip()
            if field in CATEGORIAS and r[4] is not None:
                codes[field].add(str(r[4]).strip())
    finally:
        wb.close()
    if set(codes) != set(CATEGORIAS):
        raise EtlError('Diccionario SNIIV incompleto')
    return codes


def json_contrast(settings):
    """Totales del JSON de la API, solo como contraste informativo (no se cargan)."""
    data = json.loads(settings.raw(JSON).read_text(encoding='utf-8'))
    api = {}
    for o in data:
        month = MESES_JSON.index(str(o['mes']).strip().lower()) + 1
        key = (month, str(o['clave_estado'] or '').strip(), str(o['organismo']).strip(), str(o['sexo'] or '').strip())
        api[key] = (int(o['acciones']), Decimal(str(o['monto'])))
    return dict(objetos_json=len(data),
                acciones_json=sum(v[0] for v in api.values()),
                monto_json=str(sum(v[1] for v in api.values())),
                nota='El JSON está agregado y no concilia con el CSV (ver perfil_datos.md §5); '
                     'no se carga ni se suma.')


def run(settings, files, out_dir):
    for archivo in (CSV, DICCIONARIO, JSON):
        if archivo not in files:
            raise EtlError('Archivo SNIIV ausente del manifiesto: ' + archivo)
    result = SourceResult('sniiv', [CSV, DICCIONARIO, JSON], [])
    df = pd.read_csv(settings.raw(CSV), encoding='cp1252', dtype=str, keep_default_na=False)
    if list(df.columns) != ORIGEN:
        raise EtlError('Encabezado SNIIV distinto al perfilado')
    df = df.apply(lambda s: s.str.strip())
    codes = dictionary_codes(settings)

    bad = []
    for c in ['año', 'mes']:
        bad += [(i, c) for i in df.index[~df[c].str.fullmatch(ENTERO.pattern)]]
    # El CSV publica acciones como «1.0»: se aceptan solo enteros con parte decimal cero.
    bad += [(i, 'acciones') for i in df.index[~df['acciones'].str.fullmatch(r'\d+(?:\.0+)?')]]
    bad += [(i, 'monto') for i in df.index[~df['monto'].str.fullmatch(MONTO.pattern)]]
    for c in ['cve_ent', 'cve_mun']:
        bad += [(i, c) for i in df.index[(df[c] != '') & ~df[c].str.fullmatch(ENTERO.pattern)]]
    for c in CATEGORIAS:
        bad += [(i, c) for i in df.index[(df[c] != '') & ~df[c].isin(codes[c])]]
    if bad:
        for i, c in bad[:50]:
            result.reject(CSV, 'valor fuera de formato o diccionario', fila=i + 2, columna=c, valor=df.at[i, c])
        raise EtlError(f'{len(bad)} celdas SNIIV fuera de formato o del diccionario')
    months = df['mes'].astype(int)
    if (df['año'] != '2025').any() or not months.between(1, 12).all():
        raise EtlError('Periodo SNIIV fuera de 2025-01…2025-12')
    df['acciones'] = df['acciones'].str.replace(r'\.0+$', '', regex=True)

    out = pd.DataFrame({
        'mes': [date(2025, m, 1).isoformat() for m in months],
        'cve_ent': df['cve_ent'], 'entidad': df['entidad'], 'cve_mun': df['cve_mun'], 'municipio': df['municipio'],
        **{c: df[c] for c in CATEGORIAS},
        'acciones': df['acciones'], 'monto_mxn': df['monto'], 'fila_origen': (df.index + 2).astype(str)})
    dup = out.duplicated(GRANO, keep=False)
    if dup.any():
        for i in out.index[dup][:50]:
            result.reject(CSV, 'clave de 12 dimensiones duplicada', fila=i + 2)
        raise EtlError(f'{int(dup.sum())} filas SNIIV con clave de 12 dimensiones duplicada')
    out = out.sort_values(GRANO + ['fila_origen'], kind='mergesort')
    records = out.to_dict('records')
    for r in records:
        for k, v in r.items():
            if v == '':
                r[k] = None  # NULL explícito: celda vacía en el CSV original
        # Monto: se conserva el texto decimal original sin pasar por float.
        r['monto_mxn'] = Decimal(r['monto_mxn'])
    write_csv(out_dir / 'sniiv.csv', COLUMNAS, records)

    acciones = df['acciones'].astype(int)
    monto = sum((Decimal(v) for v in df['monto']), Decimal(0))
    sin_sexo = df['sexo'] == ''
    result.conciliacion = dict(
        filas=len(df), acciones=int(acciones.sum()), monto_mxn=str(monto),
        sin_sexo_filas=int(sin_sexo.sum()), sin_sexo_acciones=int(acciones[sin_sexo].sum()),
        sin_sexo_monto_mxn=str(sum((Decimal(v) for v in df.loc[sin_sexo, 'monto']), Decimal(0))),
        nulos={c: int((df[c] == '').sum()) for c in ['cve_ent', 'cve_mun', 'municipio'] + CATEGORIAS},
        claves_unicas=int(len(out)), contraste_json=json_contrast(settings))
    log.info('SNIIV: %s filas, %s acciones, monto %s', len(df), result.conciliacion['acciones'], monto)
    result.salidas.append(Output(
        'sniiv', 'sniiv.csv', GRANO, COLUMNAS,
        {'acciones': 'conteo de financiamientos', 'monto_mxn': 'pesos mexicanos, 2 decimales del original',
         'códigos': 'texto exacto del CSV (diccionario_financiamiento.xlsx)'},
        len(records), 'hecho_sniiv_mes'))
    return result
