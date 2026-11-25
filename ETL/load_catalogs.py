"""Paso 09: carga atómica de catálogos, sin insertar hechos ni ejecuciones ETL."""

from collections import Counter, defaultdict
import csv
from datetime import date, datetime, timedelta
import hashlib
import json
from pathlib import Path
import re
import sys

from dotenv import dotenv_values
from openpyxl import load_workbook
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]
SERIES = 'data/raw/cnbv/SH_SOCAPS.xlsm'
FACTS = ('hecho_cnbv_sector_mes', 'hecho_cnbv_institucion_trim',
         'hecho_cnbv_total_trim', 'hecho_fonacot_mes', 'hecho_sniiv_mes')
TABLES = ('archivo_fuente', 'dim_mes', 'dim_institucion', 'dim_concepto_cnbv',
          'dim_ambito_fonacot', 'dim_genero_fonacot', 'ejecucion_etl', 'ejecucion_archivo') + FACTS
# Filas aprobadas: componentes, contrastes oficiales y total de socios contextual.
ROWS = {5:'saldo', 6:'saldo', 9:'saldo', 13:'saldo', 17:'saldo', 21:'saldo',
        35:'saldo', 46:'saldo', 141:'flujo_12m', 145:'flujo_12m', 153:'flujo_12m',
        177:'porcentaje', 185:'porcentaje', 193:'porcentaje', 194:'saldo', 195:'saldo',
        196:'porcentaje', 198:'porcentaje', 202:'conteo', 203:'conteo', 204:'conteo',
        210:'porcentaje', 212:'saldo', 213:'saldo', 217:'porcentaje', 224:'porcentaje'}
CATEGORIES = ('organismo', 'modalidad', 'destino', 'tipo', 'sexo', 'edad_rango', 'ingresos_rango', 'vivienda_valor')


def verified_manifest():
    manifest = json.loads((ROOT / 'data/raw/manifest.json').read_text(encoding='utf-8'))
    files = [f for f in manifest['archivos'] if f['estado'] == 'validado']
    if len(files) != 19 or len({f['archivo'] for f in files}) != 19:
        raise ValueError('El manifiesto no contiene 19 archivos válidos distintos')
    for f in files:
        path = (ROOT / f['archivo']).resolve()
        if not path.is_relative_to(ROOT / 'data/raw'):
            raise ValueError('Ruta del manifiesto fuera de data/raw')
        digest = hashlib.sha256()
        with path.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                digest.update(chunk)
        if path.stat().st_size != f['tamano_bytes'] or digest.hexdigest() != f['sha256']:
            raise ValueError('Hash o tamaño incorrecto: ' + f['archivo'])
    return files


def period(f):
    p = f['periodo']
    match = re.search(r'(\d{4})-Q([1-4])', p)
    if match:
        y, q = map(int, match.groups())
        start = (q - 1) * 3 + 1
        return date(y, start, 1), date(y, start + 3, 1) if q < 4 else date(y + 1, 1, 1)
    if f['archivo'] == SERIES:
        return date(2013, 1, 1), date(2026, 10, 1)
    if f['fuente'] == 'sniiv' and f['formato'] in ('csv', 'json', 'xlsx') and '2025' in p:
        return date(2025, 1, 1), date(2026, 1, 1)
    return None, None


def catalog_data(files):
    wb = load_workbook(ROOT / SERIES, read_only=True, data_only=True, keep_links=False)
    try:
        names = {}
        for r in wb['Nombres'].iter_rows(min_row=2, values_only=True):
            if r[0] is not None:
                k = str(r[0]).strip()
                if k in names:
                    raise ValueError('Clave duplicada en Nombres: ' + k)
                names[k] = r
        casfim = {r[1] for r in wb['Catálogo'].iter_rows(values_only=True)
                  if isinstance(r[1], str) and re.fullmatch(r'\d{2}-\d{3}', r[1])}
        concepts = []
        months = []
        for i, r in enumerate(wb['Series'].iter_rows(values_only=True), 1):
            if i == 4:
                months = [v.date().replace(day=1) for v in r if isinstance(v, datetime)]
            if i in ROWS:
                nature = ROWS[i]
                origin, normalized = (('conteo', 'conteo') if nature == 'conteo' else
                                      ('porcentaje', 'porcentaje') if nature == 'porcentaje' else
                                      ('millones_mxn_inferidos', 'mxn'))
                if not isinstance(r[2], str) or not r[2].strip():
                    raise ValueError('Fila de concepto sin etiqueta: ' + str(i))
                concepts.append(dict(fila_series=i, codigo_original=None if r[0] is None else str(r[0]),
                                     nombre=r[2].strip(), naturaleza=nature, unidad_origen=origin,
                                     unidad_normalizada=normalized))
        if len(months) != len(set(months)) or len(concepts) != len(ROWS):
            raise ValueError('Fechas duplicadas o conceptos incompletos')
        if not all(date(y, m, 1) in months for y, ms in [(2024, range(2, 13)), (2025, range(1, 13))] for m in ms):
            raise ValueError('Falta ventana histórica 2024-02 a 2025-12')
    finally:
        wb.close()

    institutions = {}
    counts = {}
    for f in sorted((f for f in files if Path(f['archivo']).name.startswith('BE_SOCAPS_')), key=lambda f: f['archivo']):
        book = load_workbook(ROOT / f['archivo'], read_only=True, data_only=True, keep_links=False)
        try:
            columns = None
            seen = set()
            for r in book['Instituciones (1)'].iter_rows(values_only=True):
                if 'Clave de la Sociedad' in r and 'Nombre de la Sociedad' in r:
                    columns = (r.index('Clave de la Sociedad'), r.index('Nombre de la Sociedad'))
                    continue
                if columns is None:
                    continue
                k, label = r[columns[0]], r[columns[1]]
                if not isinstance(k, (int, float)) or isinstance(k, bool) or k != int(k) or not isinstance(label, str):
                    continue
                raw = str(int(k)); key = raw.zfill(6)
                if key in seen or key not in names:
                    raise ValueError('Clave institucional duplicada o ausente en Nombres: ' + key)
                entry = names[key]
                cat = str(entry[1]).strip()
                if cat not in casfim or not re.fullmatch(r'\d{2}-\d{3}', cat) or '0' + cat.replace('-', '') != key:
                    raise ValueError('Clave CASFIM no concilia: ' + key)
                seen.add(key)
                # El boletín más reciente disponible define nombre, sin borrar fuentes históricas.
                institutions[key] = dict(clave_seis=key, clave_boletin=raw, clave_catalogo=cat, nombre=label.strip())
            if columns is None or not seen:
                raise ValueError('Encabezado o sociedades no encontrados en ' + f['archivo'])
            counts[Path(f['archivo']).name] = len(seen)
        finally:
            book.close()

    scopes, genders = set(), set()
    fonfiles = [f for f in files if f['fuente'] == 'fonacot' and f['formato'] == 'csv']
    for f in fonfiles:
        raw = (ROOT / f['archivo']).read_bytes()
        try:
            content = raw.decode('utf-8-sig')
        except UnicodeDecodeError:
            content = raw.decode('cp1252')
        rows = list(csv.reader(content.splitlines()))
        if not rows:
            raise ValueError('CSV FONACOT vacío')
        header = rows[0]
        for cell in header:
            suffix = cell.strip().lower().split('_')[-1]
            if suffix in ('mujeres', 'hombres'):
                genders.add(suffix)
        for row in rows[1:]:
            if not row or not row[0].strip():
                continue
            label = row[0].strip().upper()
            if label == 'VERACRUZ':
                label = 'VERACRUZ DE IGNACIO DE LA LLAVE'
            scopes.add(('canal' if label == 'APP MOVIL' else 'entidad', label))
    if len(fonfiles) != 8 or len(scopes) != 33 or genders != {'mujeres', 'hombres'}:
        raise ValueError('Catálogos FONACOT incompletos o inesperados')
    return months, institutions, concepts, scopes, genders, counts


def validate_sniiv():
    wb = load_workbook(ROOT / 'data/raw/sniiv/diccionario_financiamiento.xlsx', read_only=True, data_only=True)
    try:
        codes = defaultdict(set)
        field = None
        for r in wb['Financiamientos'].iter_rows(min_row=2, values_only=True):
            if r[1]:
                field = str(r[1]).strip()
            if field in CATEGORIES and r[4] is not None:
                codes[field].add(str(r[4]).strip())
    finally:
        wb.close()
    if set(codes) != set(CATEGORIES):
        raise ValueError('Diccionario SNIIV incompleto')
    values = {k: Counter() for k in ('cve_ent', 'cve_mun') + CATEGORIES}
    labels = defaultdict(set)
    pairs = defaultdict(set)
    with (ROOT / 'data/raw/sniiv/financiamientos_2025.csv').open(encoding='cp1252', newline='') as stream:
        for row in csv.DictReader(stream):
            for field in values:
                values[field][row[field].strip()] += 1
            ent, mun = row['cve_ent'].strip(), row['cve_mun'].strip()
            if ent:
                labels[ent].add(row['entidad'].strip())
            if ent and mun:
                pairs[(ent, mun)].add(row['municipio'].strip())
    for field in CATEGORIES:
        unexpected = set(values[field]) - codes[field] - {''}
        if unexpected:
            raise ValueError('Código SNIIV fuera del diccionario: ' + field + ' ' + repr(sorted(unexpected)))
    for field, low, high in [('cve_ent', 1, 32), ('cve_mun', 0, 570)]:
        for code in values[field]:
            if code and (not code.isascii() or not code.isdigit() or not low <= int(code) <= high):
                raise ValueError('Código geográfico fuera del rango documental: ' + field)
    return values, codes, labels, pairs


def insert_checked(conn, table, data, key):
    columns = list(data)
    where = ' AND '.join(c + ' = :' + c for c in key)
    query = text(f"SELECT {', '.join(columns)} FROM {table} WHERE {where}")
    existing = conn.execute(query, data).mappings().one_or_none()
    if existing is not None:
        if any(existing[c] != data[c] for c in columns):
            raise ValueError('Conflicto de metadatos existentes en ' + table)
        return 0
    statement = (f"INSERT INTO {table} ({', '.join(columns)}) VALUES "
                 f"({', '.join(':' + c for c in columns)}) ON CONFLICT ({', '.join(key)}) DO NOTHING RETURNING 1")
    inserted = conn.execute(text(statement), data).scalar()
    existing = conn.execute(query, data).mappings().one()
    if any(existing[c] != data[c] for c in columns):
        raise ValueError('Conflicto de metadatos existentes en ' + table)
    return int(inserted is not None)


def main():
    files = verified_manifest()
    months, institutions, concepts, scopes, genders, counts = catalog_data(files)
    values, codes, labels, pairs = validate_sniiv()
    url = make_url(dotenv_values(ROOT / 'Backend/.env')['DATABASE_URL'])
    if (url.drivername != 'postgresql+psycopg' or url.host not in ('localhost', '127.0.0.1', '::1')
            or url.port not in (None, 5432) or url.database != 'dashboard_caja_ahorro' or url.username != 'dashboard_user'):
        raise ValueError('Destino de base no autorizado')
    engine = create_engine(url, connect_args={'connect_timeout': 5}, hide_parameters=True)
    added = Counter()
    try:
        with engine.begin() as conn:
            conn.execute(text('SELECT pg_advisory_xact_lock(81370609)'))
            if conn.execute(text('SELECT current_database()')).scalar_one() != 'dashboard_caja_ahorro':
                raise ValueError('Base inesperada')
            for table in FACTS:
                if conn.execute(text(f'SELECT EXISTS (SELECT 1 FROM {table})')).scalar_one():
                    raise ValueError('La tabla de hechos no está vacía: ' + table)
            for f in files:
                begin, end_exclusive = period(f)
                # El manifiesto publica fecha, no hora de descarga: no inventar timestamp.
                end = end_exclusive - timedelta(days=1) if end_exclusive else None
                role = ('diccionario' if f['formato'] == 'pdf' or 'diccionario' in f['archivo'].lower()
                        or 'Inventario' in f['archivo'] else 'validacion' if f['archivo'].endswith(('_api.json', 'financiamientos_2025.xlsx')) else 'hechos')
                data = dict(fuente=f['fuente'].upper(), ruta=f['archivo'], url=f.get('url'), sha256=f['sha256'],
                            tamano_bytes=f['tamano_bytes'], descargado_en=None, periodo_desde=begin, periodo_hasta=end, rol=role)
                added['archivo_fuente'] += insert_checked(conn, 'archivo_fuente', data, ('ruta', 'sha256'))
            archive_id = conn.execute(text('SELECT archivo_id FROM archivo_fuente WHERE ruta=:ruta AND sha256=:sha'),
                                      dict(ruta=SERIES, sha=next(f['sha256'] for f in files if f['archivo'] == SERIES))).scalar_one()
            for month in sorted(months):
                added['dim_mes'] += insert_checked(conn, 'dim_mes', {'mes_id':month}, ('mes_id',))
            for item in institutions.values():
                added['dim_institucion'] += insert_checked(conn, 'dim_institucion', item, ('clave_seis',))
            for item in concepts:
                item.update(archivo_id=archive_id, hoja='Series')
                added['dim_concepto_cnbv'] += insert_checked(conn, 'dim_concepto_cnbv', item, ('archivo_id', 'hoja', 'fila_series'))
            for kind, label in sorted(scopes):
                added['dim_ambito_fonacot'] += insert_checked(conn, 'dim_ambito_fonacot', dict(tipo=kind, nombre_canonico=label), ('tipo', 'nombre_canonico'))
            for gender in sorted(genders):
                added['dim_genero_fonacot'] += insert_checked(conn, 'dim_genero_fonacot', dict(etiqueta=gender), ('etiqueta',))
            totals = {table: conn.execute(text(f'SELECT count(*) FROM {table}')).scalar_one() for table in TABLES}
            if any(totals[t] for t in FACTS):
                raise ValueError('Se detectaron hechos durante la carga')
        print('Hashes y tamaños: 19/19; transacción confirmada')
        print('Meses fuente:', len(months), min(months), max(months))
        print('Instituciones por boletín:', counts)
        print('SNIIV valores no catalogados: 0; nulos:', {k: v[''] for k, v in values.items()})
        print('SNIIV catálogo códigos:', {k: len(v) for k, v in codes.items()})
        print('SNIIV etiquetas geográficas con variantes:', sum(len(v) > 1 for v in labels.values()), sum(len(v) > 1 for v in pairs.values()))
        for table in TABLES:
            print(f'{table}: total={totals[table]} nuevos={added[table]}')
    finally:
        engine.dispose()


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        # No imprimir errores del controlador: podrían incluir URL o credenciales.
        print('Carga cancelada por error de validación, lectura o base:', type(exc).__name__, file=sys.stderr)
        sys.exit(1)
