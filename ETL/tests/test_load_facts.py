"""Pruebas del cargador PostgreSQL sin requerir una base en ejecución.

La carga real contra PostgreSQL se verificó por separado (ejecución 6, rollback e
idempotencia). Aquí se cubren las decisiones que pueden regresionarse sin red:
hash de salidas, resolución de FK savepoint y tolerancias de precisión.
"""

from contextlib import nullcontext
from dataclasses import replace
from datetime import datetime
import json
import shutil

import pytest

from common import EtlError, verify_manifest
import load_facts


SPEC = load_facts.SPECS[0]


class ScalarResult:
    """Resultado mínimo para las consultas escalares usadas por el loader."""

    def __init__(self, valor, filas=()):
        self.valor = valor
        self.filas = tuple(filas)

    def scalar_one(self):
        return self.valor

    def mappings(self):
        return self

    def first(self):
        return self.filas[0] if self.filas else None


class SequenceConnection:
    """Devuelve valores escalares en orden y registra las sentencias recibidas."""

    def __init__(self, valores):
        self.valores = iter(valores)
        self.sentencias = []

    def execute(self, sentencia, parametros=None):
        self.sentencias.append(str(sentencia))
        return ScalarResult(next(self.valores))


class StubContexto(load_facts.Contexto):
    """Contexto con dimensiones ya resueltas, sin abrir conexión."""

    def __init__(self, archivos, meses, conceptos, instituciones=None, ambitos=None, generos=None):
        self.ejecucion_id = 7
        self.archivos = archivos
        self.meses = meses
        self.conceptos = conceptos
        self.instituciones = instituciones or {}
        self.ambitos = ambitos or {}
        self.generos = generos or {}


def firmas_de(manifest):
    """Reproduce las firmas que el loader guarda en ejecucion_etl.observaciones."""
    firmas = {}
    for spec in load_facts.SPECS:
        secciones = [s for s in manifest['fuentes'].values()
                     if any(o['archivo'] == spec.salida for o in s['salidas'])]
        declarado = next(o for o in secciones[0]['salidas'] if o['archivo'] == spec.salida)
        firmas[spec.salida] = declarado['sha256']
    return firmas


def contexto_sector(settings, manifest, archivos=None):
    filas, _ = load_facts.leer_salida(settings, manifest, SPEC)
    fuentes = verify_manifest(settings)
    archivos = archivos or {(ruta, entrada['sha256']): 101 for ruta, entrada in fuentes.items()}
    meses = {fila['mes']: datetime.strptime(fila['mes'], '%Y-%m-%d').date() for fila in filas}
    conceptos = {}
    for fila in filas:
        entrada = fuentes[fila['archivo']]
        archivo_id = archivos[(fila['archivo'], entrada['sha256'])]
        conceptos[(archivo_id, 'Series', int(fila['fila_series']))] = {
            'concepto_id': int(fila['fila_series']),
            'nombre': fila['concepto'],
            'naturaleza': fila['naturaleza'],
            'unidad_origen': fila['unidad_origen'],
            'unidad_normalizada': fila['unidad_normalizada'],
        }
    return filas, StubContexto(archivos, meses, conceptos)


def test_leer_salda_rechaza_hash_alterado(settings, runs, manifest, tmp_path):
    filas, declarado = load_facts.leer_salida(replace(settings, processed_dir=runs[0]), manifest, SPEC)
    assert len(filas) == 598 and declarado['filas'] == 598

    destino = tmp_path / 'processed'
    destino.mkdir()
    for ruta in runs[0].iterdir():
        if ruta.is_file():
            shutil.copy2(ruta, destino / ruta.name)
    modificada = destino / SPEC.salida
    modificada.write_text(modificada.read_text(encoding='utf-8') + '0\n', encoding='utf-8')
    with pytest.raises(EtlError, match='SHA-256'):
        load_facts.leer_salida(replace(settings, processed_dir=destino), manifest, SPEC)


def test_funcion_de_clasifica_los_19_originales(settings):
    from collections import Counter

    conteos = Counter(load_facts.funcion_de(ruta) for ruta in verify_manifest(settings))
    assert conteos == {'hechos': 14, 'metadato': 3, 'contraste': 2}


def test_preparar_resuelve_fk_y_rechaza_concepto_ausente(settings, runs, manifest):
    configurado = replace(settings, processed_dir=runs[0])
    filas, contexto = contexto_sector(configurado, manifest)
    preparadas = load_facts.preparar(SPEC, filas[:5], contexto, verify_manifest(configurado))
    assert len(preparadas) == 5
    assert all(f['ejecucion_id'] == 7 and f['concepto_id'] and f['mes_id'] for f in preparadas)
    assert preparadas[0]['valor'] is not None or filas[0]['valor'] == ''

    contexto.conceptos.clear()
    with pytest.raises(EtlError, match='Concepto CNBV sin FK resuelta'):
        load_facts.preparar(SPEC, filas[:1], contexto, verify_manifest(configurado))


def test_verificar_carga_detecta_precision_y_diferencias():
    load_facts.verificar_carga(SequenceConnection([598, 0, 0]), SPEC, 7)
    with pytest.raises(EtlError, match='tolerancia de redondeo'):
        load_facts.verificar_carga(SequenceConnection([598, 1]), SPEC, 7)
    with pytest.raises(EtlError, match='filas diferentes'):
        load_facts.verificar_carga(SequenceConnection([598, 0, 1]), SPEC, 7)
    with pytest.raises(EtlError, match='filas insertadas'):
        load_facts.verificar_carga(SequenceConnection([597]), SPEC, 7)


def test_idempotencia_omite_inserciones_con_iguales_sha256(settings, runs, manifest, monkeypatch):
    class ConexionIdempotente:
        def __init__(self, previa):
            self.previa = previa
            self.sentencias = []

        def begin_nested(self):
            return nullcontext()

        def execute(self, sentencia, parametros=None):
            sql = str(sentencia)
            self.sentencias.append(sql)
            if 'pg_advisory_xact_lock' in sql:
                return ScalarResult(None)
            if 'current_database' in sql:
                return ScalarResult('dashboard_caja_ahorro')
            if 'ejecucion_etl' in sql:
                return ScalarResult(None, filas=[self.previa])
            raise AssertionError('Sentencia inesperada en la rama idempotente: ' + sql)

    observaciones = json.dumps({
        'integracion': load_facts.INTEGRACION,
        'salidas_sha256': firmas_de(manifest),
    })
    conexion = ConexionIdempotente({'ejecucion_id': 42, 'observaciones': observaciones})
    # El modo local sigue intacto: ningún motor debe crearse en la rama idempotente.
    monkeypatch.setattr(load_facts, 'create_engine', lambda *a, **k: pytest.fail('motor inesperado'))
    resultado = load_facts.cargar(
        replace(settings, processed_dir=runs[0]),
        files=verify_manifest(settings), manifest=manifest, connection=conexion)

    assert resultado.estado == 'omitida_idempotente' and resultado.ejecucion_id == 42
    assert not any('INSERT' in sql.upper() for sql in conexion.sentencias)


def test_rollback_usa_savepoint_y_propaga_el_error(settings, runs, manifest, monkeypatch):
    eventos = []

    class Savepoint:
        def __enter__(self):
            eventos.append('entrar')
            return self

        def __exit__(self, tipo, exc, traceback):
            eventos.append('salir:' + (tipo.__name__ if tipo else 'sin_error'))
            return False  # rollback lo decide la transacción exterior, no el loader

    class Conexion:
        def begin_nested(self):
            return Savepoint()

    def fallar(*args, **kwargs):
        eventos.append('cargar_en_transaccion')
        raise EtlError('fallo inducido después de insertar')

    monkeypatch.setattr(load_facts, 'cargar_en_transaccion', fallar)
    monkeypatch.setattr(load_facts, 'create_engine', lambda *a, **k: pytest.fail('motor inesperado'))
    with pytest.raises(EtlError, match='fallo inducido'):
        load_facts.cargar(
            replace(settings, processed_dir=runs[0]),
            files=verify_manifest(settings), manifest=manifest, connection=Conexion())
    assert eventos == ['entrar', 'cargar_en_transaccion', 'salir:EtlError']


def test_numeros_y_nulos_se_normalizan():
    assert load_facts.numero('123.456789012345', 'valor') == '123.456789012345'
    assert load_facts.numero('', 'valor') is None
    assert load_facts.entero('1326', 'creditos') == 1326
    assert load_facts.texto_valor('', 'sexo') is None
    with pytest.raises(EtlError, match='Entero no negativo'):
        load_facts.entero('-1', 'creditos')
    with pytest.raises(EtlError, match='no finito'):
        load_facts.numero('NaN', 'valor')


def test_url_local_rechaza_destino_remoto(monkeypatch):
    monkeypatch.setattr(load_facts, 'dotenv_values', lambda _: {
        'DATABASE_URL': 'postgresql+psycopg://usuario:clave@servidor-remoto:5432/otra_base'})
    with pytest.raises(EtlError, match='Destino de base no autorizado'):
        load_facts.url_local()
