"""Integración Fase II ↔ Fase III: carga PostgreSQL de las cinco tablas de hechos.

El modo local de ``run_etl.py`` no cambia: este módulo solo se usa con ``--cargar``.
Lee las salidas verificadas de ``data/processed``, resuelve todas las FK contra las
dimensiones ya cargadas, inserta en una sola transacción y comprueba recuentos,
precisión, nulos y conciliación antes de marcar la ejecución como exitosa.

Los SHA-256 de las salidas se guardan en ``ejecucion_etl.observaciones``. Una
reejecución con las mismas salidas se omite (idempotencia) sin insertar hechos.
No se emiten sentencias DELETE/TRUNCATE/DROP sobre tablas permanentes.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
import csv
import io
import json
from pathlib import Path
import sys

from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from common import EtlError, fmt, sha256_file, verify_manifest
from config import ROOT, VERSION_PROCESO, load_settings
from validations import ESPERADO

MANIFIESTO = 'etl_manifest.json'
INTEGRACION = 'etl-postgres-fase4-1.0'
LOCK_CARGA = 81370610
DESTINO = dict(driver='postgresql+psycopg', host=('localhost', '127.0.0.1', '::1'),
               port=(None, 5432), database='dashboard_caja_ahorro', username='dashboard_user')
TOL_MXN = Decimal('1e-6')  # numeric(30,6): medio centavo de micro-peso como máximo
TOL_PCT = Decimal('1e-10')  # numeric(20,10)


@dataclass(frozen=True)
class FactSpec:
    salida: str
    tabla: str
    filas: int
    fijas: tuple  # (columna, tipo SQL)
    medidas: dict  # columna -> clase de precisión
    grano: tuple
    temp: str


SPECS = (
    FactSpec(
        salida='cnbv_sector_mes.csv', tabla='hecho_cnbv_sector_mes', filas=598,
        fijas=(('ejecucion_id', 'bigint'), ('archivo_id', 'bigint'),
               ('mes_id', 'date'), ('concepto_id', 'bigint')),
        medidas={'valor': 'mxn6'},
        grano=('ejecucion_id', 'mes_id', 'concepto_id'), temp='st_carga_sector',
    ),
    FactSpec(
        salida='cnbv_institucion_trim.csv', tabla='hecho_cnbv_institucion_trim', filas=620,
        fijas=(('ejecucion_id', 'bigint'), ('archivo_id', 'bigint'), ('mes_id', 'date'),
               ('institucion_id', 'bigint'), ('estado_reporte', 'text')),
        medidas={
            'socios': 'entero', 'sucursales': 'entero',
            'activo_mxn': 'mxn6', 'disponibilidades_mxn': 'mxn6',
            'cartera_vigente_mxn': 'mxn6', 'cartera_vencida_mxn': 'mxn6',
            'estimacion_mxn': 'mxn6', 'captacion_total_mxn': 'mxn6',
            'captacion_tradicional_mxn': 'mxn6',
            'ingresos_intereses_trim_mxn': 'mxn6', 'gastos_intereses_trim_mxn': 'mxn6',
            'imor_pct': 'pct10', 'nicap_pct': 'pct10', 'participacion_activo_pct': 'pct10',
            'categoria_nicap': 'texto', 'tasa_activa_pct': 'pct10',
            'tasa_pasiva_total_pct': 'pct10', 'tasa_pasiva_tradicional_pct': 'pct10',
        },
        grano=('ejecucion_id', 'mes_id', 'institucion_id'), temp='st_carga_institucion',
    ),
    FactSpec(
        salida='cnbv_total_trim.csv', tabla='hecho_cnbv_total_trim', filas=4,
        fijas=(('ejecucion_id', 'bigint'), ('archivo_id', 'bigint'), ('mes_id', 'date')),
        medidas={'activo_mxn': 'mxn6', 'cartera_vigente_mxn': 'mxn6',
                 'captacion_total_mxn': 'mxn6', 'imor_pct': 'pct10', 'icor_pct': 'pct10',
                 'nicap_pct': 'pct10', 'roa_pct': 'pct10'},
        grano=('ejecucion_id', 'mes_id'), temp='st_carga_total',
    ),
    FactSpec(
        salida='fonacot.csv', tabla='hecho_fonacot_mes', filas=792,
        fijas=(('ejecucion_id', 'bigint'), ('archivo_creditos_id', 'bigint'),
               ('archivo_monto_id', 'bigint'), ('mes_id', 'date'),
               ('ambito_id', 'bigint'), ('genero_id', 'bigint'),
               ('etiqueta_creditos_original', 'text'), ('etiqueta_monto_original', 'text')),
        medidas={'creditos': 'entero', 'monto_mxn': 'mxn6'},
        grano=('ejecucion_id', 'mes_id', 'ambito_id', 'genero_id'), temp='st_carga_fonacot',
    ),
    FactSpec(
        salida='sniiv.csv', tabla='hecho_sniiv_mes', filas=325649,
        fijas=(('ejecucion_id', 'bigint'), ('archivo_id', 'bigint'), ('mes_id', 'date'),
               ('cve_ent', 'text'), ('cve_mun', 'text'), ('entidad', 'text'),
               ('municipio', 'text'), ('organismo', 'text'), ('modalidad', 'text'),
               ('destino', 'text'), ('tipo', 'text'), ('sexo', 'text'),
               ('edad_rango', 'text'), ('ingresos_rango', 'text'),
               ('vivienda_valor', 'text')),
        medidas={'acciones': 'entero', 'monto_mxn': 'mxn6'},
        grano=('ejecucion_id', 'mes_id', 'cve_ent', 'cve_mun', 'organismo', 'modalidad',
               'destino', 'tipo', 'sexo', 'edad_rango', 'ingresos_rango', 'vivienda_valor'),
        temp='st_carga_sniiv',
    ),
)

FUENTE_SALIDA = {'cnbv_sector_mes.csv': 'cnbv', 'cnbv_institucion_trim.csv': 'cnbv',
                 'cnbv_total_trim.csv': 'cnbv', 'fonacot.csv': 'fonacot', 'sniiv.csv': 'sniiv'}


@dataclass
class LoadResult:
    estado: str
    ejecucion_id: int
    filas: dict
    observaciones: str = ''


class Contexto:
    """Dimensiones resueltas dentro de la transacción de carga."""

    def __init__(self, conn, ejecucion_id):
        self.conn, self.ejecucion_id = conn, ejecucion_id
        self.archivos = {(r['ruta'], r['sha256']): r['archivo_id'] for r in conn.execute(
            text('SELECT archivo_id, ruta, sha256 FROM archivo_fuente')).mappings()}
        self.meses = {str(r['mes_id']): r['mes_id'] for r in conn.execute(
            text('SELECT mes_id FROM dim_mes')).mappings()}
        self.conceptos = {(r['archivo_id'], r['hoja'], r['fila_series']): r for r in conn.execute(
            text('SELECT concepto_id, archivo_id, hoja, fila_series, nombre, naturaleza, '
                 'unidad_origen, unidad_normalizada FROM dim_concepto_cnbv')).mappings()}
        self.instituciones = {r['clave_seis']: r for r in conn.execute(
            text('SELECT institucion_id, clave_seis, clave_boletin FROM dim_institucion')).mappings()}
        self.ambitos = {(r['tipo'], r['nombre_canonico']): r['ambito_id'] for r in conn.execute(
            text('SELECT ambito_id, tipo, nombre_canonico FROM dim_ambito_fonacot')).mappings()}
        self.generos = {r['etiqueta']: r['genero_id'] for r in conn.execute(
            text('SELECT genero_id, etiqueta FROM dim_genero_fonacot')).mappings()}

    def archivo(self, ruta, files):
        entrada = files.get(ruta)
        if entrada is None:
            raise EtlError('La ruta del CSV no está en el manifiesto verificado: ' + ruta)
        clave = (ruta, entrada['sha256'])
        if clave not in self.archivos:
            raise EtlError('No existe archivo_fuente con la ruta y el SHA-256 verificados: ' + ruta)
        return self.archivos[clave]

    def mes(self, valor):
        try:
            mes = datetime.strptime(valor, '%Y-%m-%d').date()
        except (TypeError, ValueError) as exc:
            raise EtlError('Mes con formato inválido: ' + repr(valor)) from exc
        if mes.day != 1 or str(mes) not in self.meses:
            raise EtlError('Mes ausente en dim_mes: ' + repr(valor))
        return self.meses[str(mes)]

    def concepto(self, fila, archivo_id):
        try:
            numero = int(fila)
        except (TypeError, ValueError) as exc:
            raise EtlError('fila_series inválida: ' + repr(fila)) from exc
        encontrado = self.conceptos.get((archivo_id, 'Series', numero))
        if encontrado is None:
            raise EtlError('Concepto CNBV sin FK resuelta: fila_series=' + str(numero))
        return encontrado['concepto_id'], encontrado


def funcion_de(ruta):
    nombre = Path(ruta).name.casefold()
    if 'diccionario' in nombre or 'inventario' in nombre:
        return 'metadato'
    if nombre.endswith('_api.json') or nombre == 'financiamientos_2025.xlsx':
        return 'contraste'
    return 'hechos'


def numero(texto, campo):
    if texto is None or texto == '':
        return None
    try:
        valor = Decimal(texto)
    except InvalidOperation as exc:
        raise EtlError('Valor numérico inválido en ' + campo + ': ' + repr(texto)) from exc
    if not valor.is_finite():
        raise EtlError('Valor numérico no finito en ' + campo)
    return fmt(valor)


def entero(texto, campo):
    if texto is None or texto == '':
        return None
    if not str(texto).isdigit():
        raise EtlError('Entero no negativo esperado en ' + campo + ': ' + repr(texto))
    return int(texto)


def texto_valor(valor, campo, obligatorio=False):
    resultado = None if valor in (None, '') else str(valor)
    if obligatorio and resultado is None:
        raise EtlError('Campo obligatorio vacío: ' + campo)
    return resultado


def leer_salida(settings, manifest, spec):
    """Verifica hash/columnas/filas declaradas y devuelve las filas crudas."""
    secciones = [s for s in manifest['fuentes'].values()
                 if any(o['archivo'] == spec.salida for o in s['salidas'])]
    if len(secciones) != 1 or secciones[0].get('version_proceso') != VERSION_PROCESO:
        raise EtlError('Manifiesto de salidas inconsistente para ' + spec.salida)
    declarado = next(o for o in secciones[0]['salidas'] if o['archivo'] == spec.salida)
    ruta = settings.processed_dir / spec.salida
    if not ruta.is_file():
        raise EtlError('Falta la salida local: ' + spec.salida + ' (ejecute primero el ETL local)')
    if sha256_file(ruta) != declarado['sha256']:
        raise EtlError('El SHA-256 de la salida no coincide con el manifiesto: ' + spec.salida)
    with ruta.open(encoding='utf-8', newline='') as stream:
        reader = csv.DictReader(stream)
        columnas = reader.fieldnames
        filas = list(reader)
    if columnas != declarado['columnas']:
        raise EtlError('Columnas distintas al manifiesto en ' + spec.salida)
    if len(filas) != declarado['filas'] or declarado['filas'] != spec.filas:
        raise EtlError('Recuento inesperado en ' + spec.salida + ': ' + str(len(filas)))
    return filas, declarado


def preparar(spec, filas, ctx, files):
    """Resuelve FK y normaliza valores; devuelve filas con columnas destino."""
    salida = []
    vistos = set()

    def agregar(fijas, medidas):
        clave = tuple(fijas.get(c) for c in spec.grano)
        if clave in vistos:
            raise EtlError('Grano duplicado en ' + spec.salida + ': ' + repr(clave))
        vistos.add(clave)
        salida.append({**fijas, **medidas})

    for r in filas:
        base = dict(ejecucion_id=ctx.ejecucion_id, mes_id=ctx.mes(r['mes']))
        if spec.salida == 'cnbv_sector_mes.csv':
            archivo_id = ctx.archivo(r['archivo'], files)
            concepto_id, concepto = ctx.concepto(r['fila_series'], archivo_id)
            for csv_col, db_col in (('concepto', 'nombre'), ('naturaleza', 'naturaleza'),
                                    ('unidad_origen', 'unidad_origen'),
                                    ('unidad_normalizada', 'unidad_normalizada')):
                if r[csv_col] != concepto[db_col]:
                    raise EtlError('El concepto CNBV no coincide con dim_concepto_cnbv: ' + csv_col)
            agregar({**base, 'archivo_id': archivo_id, 'concepto_id': concepto_id},
                    {'valor': numero(r['valor'], 'valor')})

        elif spec.salida == 'cnbv_institucion_trim.csv':
            clave = texto_valor(r['clave_seis'], 'clave_seis', True)
            institucion = ctx.instituciones.get(clave)
            if institucion is None:
                raise EtlError('Institución sin FK resuelta (no se crean instituciones): ' + clave)
            if r['clave_boletin'] != str(institucion['clave_boletin']).strip():
                raise EtlError('clave_boletin no coincide con dim_institucion: ' + clave)
            medidas = {}
            for nombre, clase in spec.medidas.items():
                valor = r[nombre]
                medidas[nombre] = (entero(valor, nombre) if clase == 'entero'
                                   else texto_valor(valor, nombre) if clase == 'texto'
                                   else numero(valor, nombre))
            agregar({**base, 'archivo_id': ctx.archivo(r['archivo'], files),
                     'institucion_id': institucion['institucion_id'],
                     'estado_reporte': texto_valor(r['estado_reporte'], 'estado_reporte', True)}, medidas)

        elif spec.salida == 'cnbv_total_trim.csv':
            agregar({**base, 'archivo_id': ctx.archivo(r['archivo'], files)},
                    {nombre: numero(r[nombre], nombre) for nombre in spec.medidas})

        elif spec.salida == 'fonacot.csv':
            ambito = ctx.ambitos.get((r['tipo_ambito'], r['ambito_canonico']))
            genero = ctx.generos.get(r['genero'])
            if ambito is None or genero is None:
                raise EtlError('Ámbito o género FONACOT sin FK resuelta: ' +
                               repr((r['tipo_ambito'], r['ambito_canonico'], r['genero'])))
            agregar({**base,
                     'archivo_creditos_id': ctx.archivo(r['archivo_creditos'], files),
                     'archivo_monto_id': ctx.archivo(r['archivo_monto'], files),
                     'ambito_id': ambito, 'genero_id': genero,
                     'etiqueta_creditos_original': texto_valor(
                         r['etiqueta_creditos_original'], 'etiqueta_creditos_original', True),
                     'etiqueta_monto_original': texto_valor(
                         r['etiqueta_monto_original'], 'etiqueta_monto_original', True)},
                    {'creditos': entero(r['creditos'], 'creditos'),
                     'monto_mxn': numero(r['monto_mxn'], 'monto_mxn')})

        elif spec.salida == 'sniiv.csv':
            # El CSV de SNIIV no repite la ruta: se toma del manifiesto verificado.
            fijas = {**base, 'archivo_id': ctx.archivo('data/raw/sniiv/financiamientos_2025.csv', files)}
            for columna, _ in spec.fijas:
                if columna in ('ejecucion_id', 'archivo_id', 'mes_id'):
                    continue
                fijas[columna] = texto_valor(r[columna], columna)
            agregar(fijas, {'acciones': entero(r['acciones'], 'acciones'),
                            'monto_mxn': numero(r['monto_mxn'], 'monto_mxn')})
    return salida


def crear_insertar(conn, spec, filas):
    """COPY a temporal + INSERT ... SELECT con casts a la escala del esquema."""
    columnas_fijas = [c for c, _ in spec.fijas]
    columnas_temp = columnas_fijas + list(spec.medidas)
    definicion = ', '.join(f'{c} {t}' for c, t in spec.fijas)
    definicion += ''.join(', ' + c + ' text' for c in spec.medidas)
    conn.execute(text(f'CREATE TEMP TABLE {spec.temp} ({definicion}) ON COMMIT DROP'))

    buffer = io.StringIO(newline='')
    writer = csv.writer(buffer, lineterminator='\n')
    for fila in filas:
        writer.writerow([fila[c] for c in columnas_temp])
    buffer.seek(0)
    with conn.connection.driver_connection.cursor() as cursor:
        with cursor.copy(f"COPY {spec.temp} ({', '.join(columnas_temp)}) "
                         "FROM STDIN WITH (FORMAT csv, NULL '')") as copia:
            copia.write(buffer.getvalue())

    casts = {
        'mxn6': lambda c: f'CASE WHEN {c} IS NULL THEN NULL ELSE {c}::numeric(30,6) END',
        'pct10': lambda c: f'CASE WHEN {c} IS NULL THEN NULL ELSE {c}::numeric(20,10) END',
        'entero': lambda c: f'CASE WHEN {c} IS NULL THEN NULL ELSE {c}::bigint END',
        'texto': lambda c: c,
    }
    seleccion = ', '.join(columnas_fijas + [casts[k](c) for c, k in spec.medidas.items()])
    conn.execute(text(f'INSERT INTO {spec.tabla} ({", ".join(columnas_temp)}) '
                      f'SELECT {seleccion} FROM {spec.temp}'))


def cast_expr(expr, clase):
    """Expresión SQL que reproduce exactamente el cast aplicado al insertar."""
    if clase == 'mxn6':
        return f'CASE WHEN {expr} IS NULL THEN NULL ELSE {expr}::numeric(30,6) END'
    if clase == 'pct10':
        return f'CASE WHEN {expr} IS NULL THEN NULL ELSE {expr}::numeric(20,10) END'
    if clase == 'entero':
        return f'CASE WHEN {expr} IS NULL THEN NULL ELSE {expr}::bigint END'
    return expr


def verificar_carga(conn, spec, ejecucion_id):
    """Comprueba recuento, precisión y equivalencia fila a fila sin joins cuadráticos.

    La comparación con ``EXCEPT`` trata NULL como NULL y detecta filas ausentes,
    sobrantes o con cualquier columna distinta. El control de precisión se hace
    contra la tabla temporal (sin unir con 325k filas), midiendo el redondeo
    introducido por la escala de PostgreSQL.
    """
    total = conn.execute(text(f'SELECT count(*) FROM {spec.tabla} WHERE ejecucion_id=:id'),
                         {'id': ejecucion_id}).scalar_one()
    if total != spec.filas:
        raise EtlError(f'{spec.tabla}: {total} filas insertadas, esperadas {spec.filas}')

    precision = []
    for columna, clase in spec.medidas.items():
        if clase == 'mxn6':
            tolerancia = TOL_MXN
        elif clase == 'pct10':
            tolerancia = TOL_PCT
        else:
            continue
        precision.append(f'(s.{columna} IS NULL OR ABS(s.{columna}::numeric - '
                         f'{cast_expr("s." + columna, clase)}) <= {tolerancia})')
    if precision:
        malas = conn.execute(text(f'SELECT count(*) FROM {spec.temp} s '
                                  f'WHERE NOT ({" AND ".join(precision)})')).scalar_one()
        if malas:
            raise EtlError(f'{spec.tabla}: {malas} valores exceden la tolerancia de redondeo')

    fijas = [c for c, _ in spec.fijas]
    esperado = ', '.join([f's.{c}' for c in fijas] +
                         [cast_expr(f's.{c}', clase) for c, clase in spec.medidas.items()])
    actual = ', '.join([f'h.{c}' for c in fijas] +
                       [cast_expr(f'h.{c}', clase) for c, clase in spec.medidas.items()])
    diferentes = conn.execute(text(f'''
        WITH esperado AS (SELECT {esperado} FROM {spec.temp} s),
             actual AS (SELECT {actual} FROM {spec.tabla} h WHERE h.ejecucion_id = :id),
             diferencias AS (
                 (SELECT * FROM esperado EXCEPT SELECT * FROM actual)
                 UNION ALL
                 (SELECT * FROM actual EXCEPT SELECT * FROM esperado)
             )
        SELECT count(*) FROM diferencias'''), {'id': ejecucion_id}).scalar_one()
    if diferentes:
        raise EtlError(f'{spec.tabla}: {diferentes} filas diferentes entre la salida y la base')


def verificar_conciliacion(conn, ejecucion_id):
    """Conciliación mínima desde la base: FONACOT, SNIIV y total CNBV vs. Series."""
    # Se calcula el trimestre desde mes_id para no depender de vistas.
    fonacot = {r['trimestre']: (r['creditos'], r['monto']) for r in conn.execute(text(
        "SELECT to_char(m.mes_id, 'YYYY') || '-Q' || "
        "(((EXTRACT(MONTH FROM m.mes_id)::integer - 1) / 3) + 1)::text AS trimestre, "
        'sum(h.creditos) AS creditos, sum(h.monto_mxn) AS monto '
        'FROM hecho_fonacot_mes h JOIN dim_mes m ON m.mes_id = h.mes_id '
        'WHERE h.ejecucion_id = :id GROUP BY 1'), {'id': ejecucion_id}).mappings()}
    if set(fonacot) != set(ESPERADO['fonacot']):
        raise EtlError('Trimestres FONACOT incompletos en la base')
    for trimestre, (creditos, monto) in ESPERADO['fonacot'].items():
        if fonacot[trimestre] != (creditos, monto):
            raise EtlError('Conciliación FONACOT fallida en ' + trimestre)

    sniiv = conn.execute(text(
        'SELECT count(*) AS filas, sum(acciones) AS acciones, sum(monto_mxn) AS monto, '
        'count(*) FILTER (WHERE sexo IS NULL) AS sin_sexo, '
        "coalesce(sum(acciones) FILTER (WHERE sexo IS NULL), 0) AS acciones_sin_sexo "
        'FROM hecho_sniiv_mes WHERE ejecucion_id = :id'), {'id': ejecucion_id}).mappings().one()
    esperado = ESPERADO['sniiv']
    if (sniiv['filas'], sniiv['acciones'], sniiv['monto'], sniiv['sin_sexo'],
            sniiv['acciones_sin_sexo']) != (esperado['filas'], esperado['acciones'],
                                            esperado['monto'], esperado['sin_sexo_filas'],
                                            esperado['sin_sexo_acciones']):
        raise EtlError('Conciliación SNIIV fallida tras la carga')

    # El activo del boletín se concilia con Σ activo de sus 155 sociedades (±1 MXN).
    # Series y boletín tienen fechas de elaboración distintas: se exige que ambos
    # estén presentes, pero no se fuerza una igualdad que las fuentes no cumplen.
    for fila in conn.execute(text(
        'SELECT t.mes_id, t.activo_mxn AS total, '
        '(SELECT sum(i.activo_mxn) FROM hecho_cnbv_institucion_trim i '
        ' WHERE i.ejecucion_id = t.ejecucion_id AND i.mes_id = t.mes_id) AS instituciones, '
        '(SELECT sum(s.valor) FROM hecho_cnbv_sector_mes s '
        ' JOIN dim_concepto_cnbv c ON c.concepto_id = s.concepto_id '
        ' AND c.archivo_id = s.archivo_id '
        ' WHERE s.ejecucion_id = t.ejecucion_id AND s.mes_id = t.mes_id '
        ' AND c.fila_series = 5) AS sector '
        'FROM hecho_cnbv_total_trim t WHERE t.ejecucion_id = :id'), {'id': ejecucion_id}).mappings():
        if fila['sector'] is None:
            raise EtlError('Falta el activo de Series para ' + str(fila['mes_id']))
        if fila['instituciones'] is None or abs(fila['total'] - fila['instituciones']) > 1:
            raise EtlError('Conciliación activo boletín vs. sociedades fallida en ' + str(fila['mes_id']))


def url_local():
    """Valida el destino y devuelve una URL SQLAlchemy sin revelar credenciales."""
    valor = dotenv_values(ROOT / 'Backend' / '.env').get('DATABASE_URL')
    if not valor:
        raise EtlError('DATABASE_URL no está definida en Backend/.env')
    try:
        url = make_url(valor)
    except Exception as exc:
        raise EtlError('DATABASE_URL no válida') from exc
    if (url.drivername != DESTINO['driver'] or url.host not in DESTINO['host']
            or url.port not in DESTINO['port'] or url.database != DESTINO['database']
            or url.username != DESTINO['username']):
        raise EtlError('Destino de base no autorizado')
    return url


def cargar(settings=None, files=None, manifest=None, *, engine=None, connection=None):
    """Carga atómica de las cinco salidas; devuelve LoadResult.

    Con ``connection`` se usa un savepoint: permite probar rollback sin confirmar
    datos. Sin él se abre una transacción propia y se cierra el motor creado.
    """
    settings = settings or load_settings()
    files = files if files is not None else verify_manifest(settings)
    if len(files) != 19:
        raise EtlError('Se requieren los 19 originales verificados')
    if manifest is None:
        manifest_path = settings.processed_dir / MANIFIESTO
        if not manifest_path.is_file():
            raise EtlError('Falta el manifiesto de salidas; ejecute primero el ETL local')
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))

    salidas = {}
    firmas = {}
    for spec in SPECS:
        filas, declarado = leer_salida(settings, manifest, spec)
        salidas[spec.salida] = filas
        firmas[spec.salida] = declarado['sha256']

    if connection is not None:
        # El savepoint se usa solo para pruebas; la transacción exterior decide el commit.
        with connection.begin_nested():
            return cargar_en_transaccion(connection, files, firmas, salidas)

    motor_creado = engine is None
    if motor_creado:
        engine = create_engine(url_local(), connect_args={'connect_timeout': 5},
                               hide_parameters=True)
    try:
        with engine.begin() as conn:
            return cargar_en_transaccion(conn, files, firmas, salidas)
    finally:
        if motor_creado:
            engine.dispose()


def cargar_en_transaccion(conn, files, firmas, salidas):
    """Carga y valida usando la conexión ya abierta dentro de una transacción."""
    conn.execute(text(f'SELECT pg_advisory_xact_lock({LOCK_CARGA})'))
    if conn.execute(text('SELECT current_database()')).scalar_one() != DESTINO['database']:
        raise EtlError('Base de datos inesperada')

    previa = conn.execute(text(
        "SELECT ejecucion_id, observaciones FROM ejecucion_etl WHERE estado='exitosa' "
        'ORDER BY terminada_en DESC NULLS LAST, ejecucion_id DESC LIMIT 1')).mappings().first()
    if previa is not None:
        try:
            observacion = json.loads(previa['observaciones'] or '{}')
        except (TypeError, ValueError):
            observacion = {}
        if (observacion.get('integracion') == INTEGRACION
                and observacion.get('salidas_sha256') == firmas):
            return LoadResult('omitida_idempotente', previa['ejecucion_id'],
                              {s.tabla: s.filas for s in SPECS},
                              'salidas_sha256 idénticos a la última ejecución exitosa')

    # now() del servidor: evita que relojes distintos violen ejecucion_fechas_ck.
    ejecucion_id = conn.execute(text(
        "INSERT INTO ejecucion_etl (iniciada_en, estado, version_proceso) "
        "VALUES (now(), 'iniciada', :version) RETURNING ejecucion_id"),
        {'version': VERSION_PROCESO}).scalar_one()

    for ruta, entrada in sorted(files.items()):
        conn.execute(text(
            'INSERT INTO ejecucion_archivo (ejecucion_id, archivo_id, funcion, hash_verificado) '
            'VALUES (:ejecucion, :archivo, :funcion, true)'),
            {'ejecucion': ejecucion_id, 'archivo': ctx_archivo(entrada, conn),
             'funcion': funcion_de(ruta)})

    ctx = Contexto(conn, ejecucion_id)
    filas_insertadas = {}
    for spec in SPECS:
        preparadas = preparar(spec, salidas[spec.salida], ctx, files)
        crear_insertar(conn, spec, preparadas)
        verificar_carga(conn, spec, ejecucion_id)
        filas_insertadas[spec.tabla] = spec.filas

    verificar_conciliacion(conn, ejecucion_id)
    observaciones = json.dumps({
        'integracion': INTEGRACION,
        'version_proceso': VERSION_PROCESO,
        'salidas_sha256': firmas,
        'filas': filas_insertadas,
        'columnas_no_modeladas': {
            'cnbv_institucion_trim.csv': ['marcas_origen', 'nombre_boletin'],
            'sniiv.csv': ['fila_origen'],
        },
        'redondeo': {'mxn': str(TOL_MXN), 'porcentaje': str(TOL_PCT)},
        'funciones_archivo': {r: funcion_de(r) for r in sorted(files)},
    }, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    conn.execute(text(
        "UPDATE ejecucion_etl SET estado='exitosa', terminada_en=now(), "
        'observaciones=:obs WHERE ejecucion_id=:id'),
        {'obs': observaciones, 'id': ejecucion_id})
    return LoadResult('exitosa', ejecucion_id, filas_insertadas, observaciones)


def ctx_archivo(entrada, conn):
    """Resuelve el archivo de trazabilidad por ruta + SHA-256 del manifiesto."""
    encontrado = conn.execute(text(
        'SELECT archivo_id FROM archivo_fuente WHERE ruta=:ruta AND sha256=:sha'),
        {'ruta': entrada['archivo'], 'sha': entrada['sha256']}).scalar_one_or_none()
    if encontrado is None:
        raise EtlError('Falta archivo_fuente para la trazabilidad: ' + entrada['archivo'])
    return encontrado


def main(argv=None):
    if argv not in (None, []):
        print('Este cargador no acepta argumentos; use ETL/run_etl.py --cargar', file=sys.stderr)
        return 2
    settings = load_settings()
    try:
        resultado = cargar(settings)
    except Exception as exc:
        # No imprimir la URL ni detalles del controlador: pueden incluir secretos.
        print('Carga cancelada; transacción revertida: ' + type(exc).__name__ + ': ' + str(exc),
              file=sys.stderr)
        return 1
    print('Estado: ' + resultado.estado)
    print('Ejecución: ' + str(resultado.ejecucion_id))
    for tabla, filas in resultado.filas.items():
        print(f'{tabla}: {filas} filas')
    if resultado.estado == 'omitida_idempotente':
        print('Sin inserciones: ' + resultado.observaciones)
    return 0


if __name__ == '__main__':
    sys.exit(main())
