"""Paso 10: configuración, rutas y logging del ETL local (sin PostgreSQL)."""

from dataclasses import dataclass
from datetime import date
import logging
import os
from pathlib import Path
import re

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
VERSION_PROCESO = 'etl-local-fase3-1.0'
FUENTES = ('cnbv', 'fonacot', 'sniiv')


def _month(value, name):
    match = re.fullmatch(r'(\d{4})-(\d{2})', value.strip())
    if not match or not 1 <= int(match.group(2)) <= 12:
        raise ValueError(f'{name} debe tener formato YYYY-MM')
    return date(int(match.group(1)), int(match.group(2)), 1)


def _path(value):
    path = Path(value)
    return (path if path.is_absolute() else ROOT / path).resolve()


@dataclass(frozen=True)
class Settings:
    raw_dir: Path
    processed_dir: Path
    log_level: str
    cnbv_mes_desde: date
    cnbv_mes_hasta: date

    @property
    def manifest(self):
        return self.raw_dir / 'manifest.json'

    @property
    def log_dir(self):
        return self.processed_dir / 'logs'

    def raw(self, manifest_path):
        """Resuelve una ruta del manifiesto (`data/raw/...`) dentro de raw_dir."""
        relative = Path(manifest_path).relative_to('data/raw')
        path = (self.raw_dir / relative).resolve()
        if not path.is_relative_to(self.raw_dir):
            raise ValueError('Ruta fuera de data/raw: ' + manifest_path)
        return path


def load_settings(env=None, **overrides):
    """Lee ETL/.env (opcional) y variables de entorno; nunca requiere DATABASE_URL."""
    values = {}
    env_file = ROOT / 'ETL' / '.env'
    if env_file.is_file():
        values.update({k: v for k, v in dotenv_values(env_file).items() if v is not None})
    values.update({k: v for k, v in (os.environ if env is None else env).items() if k.startswith('ETL_')})
    settings = Settings(
        raw_dir=_path(values.get('ETL_RAW_DIR', 'data/raw')),
        processed_dir=_path(values.get('ETL_PROCESSED_DIR', 'data/processed')),
        log_level=values.get('ETL_LOG_LEVEL', 'INFO').upper(),
        cnbv_mes_desde=_month(values.get('ETL_CNBV_MES_DESDE', '2024-02'), 'ETL_CNBV_MES_DESDE'),
        cnbv_mes_hasta=_month(values.get('ETL_CNBV_MES_HASTA', '2025-12'), 'ETL_CNBV_MES_HASTA'),
    )
    if overrides:
        settings = Settings(**{**settings.__dict__, **overrides})
    if settings.log_level not in ('DEBUG', 'INFO', 'WARNING', 'ERROR'):
        raise ValueError('ETL_LOG_LEVEL inválido')
    if settings.cnbv_mes_desde > settings.cnbv_mes_hasta:
        raise ValueError('ETL_CNBV_MES_DESDE es posterior a ETL_CNBV_MES_HASTA')
    return settings


def setup_logging(settings, log_file=None):
    """Consola y, opcionalmente, archivo en data/processed/logs/. No registra secretos."""
    logger = logging.getLogger('etl')
    logger.setLevel(settings.log_level)
    for handler in list(logger.handlers):
        logger.removeHandler(handler)
        handler.close()
    fmt = logging.Formatter('%(asctime)s %(levelname)s %(name)s: %(message)s')
    console = logging.StreamHandler()
    console.setFormatter(fmt)
    logger.addHandler(console)
    if log_file is not None:
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        handler = logging.FileHandler(log_file, encoding='utf-8')
        handler.setFormatter(fmt)
        logger.addHandler(handler)
    logger.propagate = False
    return logger
