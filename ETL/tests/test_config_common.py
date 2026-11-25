"""Paso 10: entorno, configuración y utilidades sin PostgreSQL."""

from datetime import date
from decimal import Decimal
import importlib

import pytest

from common import EtlError, fmt, parse_csv_number, to_decimal, verify_manifest, write_csv
from config import ROOT, load_settings


def test_librerias_importan():
    for name in ('pandas', 'openpyxl', 'dotenv'):
        importlib.import_module(name)


def test_modo_local_sin_database_url():
    s = load_settings(env={})  # entorno vacío: sin DATABASE_URL ni credenciales
    assert s.raw_dir == ROOT / 'data' / 'raw' and s.processed_dir == ROOT / 'data' / 'processed'
    assert (s.cnbv_mes_desde, s.cnbv_mes_hasta) == (date(2024, 2, 1), date(2025, 12, 1))
    assert s.raw_dir.is_dir()


def test_config_invalida():
    with pytest.raises(ValueError):
        load_settings(env={'ETL_CNBV_MES_DESDE': '2024-13'})
    with pytest.raises(ValueError):
        load_settings(env={'ETL_CNBV_MES_DESDE': '2026-01', 'ETL_CNBV_MES_HASTA': '2025-12'})


def test_19_originales_conforme_al_manifiesto(settings):
    files = verify_manifest(settings)
    assert len(files) == 19
    assert all(settings.raw(f).is_file() for f in files)


def test_decimales_sin_perdida():
    assert to_decimal(294888.150735) * 1_000_000 == Decimal('294888150735')
    assert to_decimal(7) == Decimal(7)
    assert parse_csv_number(' 32,050,929.75 ') == Decimal('32050929.75')
    assert parse_csv_number('1,326 ') == Decimal(1326)
    assert parse_csv_number('') is None
    for bad in ('12,34', 'abc', '1.2.3'):
        with pytest.raises(EtlError):
            parse_csv_number(bad)
    with pytest.raises(EtlError):
        to_decimal(True)
    assert fmt(Decimal('1.500')) == '1.5' and fmt(Decimal('-0')) == '0' and fmt(None) == ''


def test_escritura_atomica_conserva_archivo_previo(tmp_path):
    target = tmp_path / 'salida.csv'
    write_csv(target, ['a'], [{'a': 1}])
    before = target.read_bytes()

    def broken():
        yield {'a': 2}
        raise RuntimeError('fallo a mitad de escritura')

    with pytest.raises(RuntimeError):
        write_csv(target, ['a'], broken())
    assert target.read_bytes() == before
    assert [p.name for p in tmp_path.iterdir()] == ['salida.csv']  # sin temporales huérfanos
