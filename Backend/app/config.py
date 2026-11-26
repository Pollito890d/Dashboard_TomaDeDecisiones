"""Configuración del backend reutilizando ``Backend/.env`` (Fase V, pasos 18-19)."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path

from dotenv import dotenv_values
from sqlalchemy.engine import make_url

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_ENV_PATH = _BACKEND_DIR / ".env"
_VARIABLES = ("API_HOST", "API_PORT", "LOG_LEVEL", "CORS_ORIGINS", "DATABASE_URL")
_NIVELES = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}


@dataclass(frozen=True)
class Settings:
    """Valores de ejecución ya validados; nunca guarda credenciales en texto."""

    api_host: str
    api_port: int
    log_level: str
    cors_origins: tuple[str, ...]
    database_url: str

    @property
    def destino_seguro(self) -> str:
        """Identificador no sensible del destino, apto para bitácoras."""
        url = make_url(self.database_url)
        return f"{url.host}:{url.port}/{url.database}"


def _leer_variables(env_path: Path) -> dict[str, str]:
    valores = {
        clave: valor
        for clave, valor in dotenv_values(env_path).items()
        if valor is not None and valor != ""
    }
    # El entorno del proceso tiene prioridad sobre el archivo .env.
    for clave in _VARIABLES:
        if clave in os.environ and os.environ[clave] != "":
            valores[clave] = os.environ[clave]
    return valores


def _validar_destino(database_url: str) -> None:
    """Restringe el acceso al único PostgreSQL local autorizado por el proyecto."""
    url = make_url(database_url)
    if url.drivername != "postgresql+psycopg":
        raise ValueError("DATABASE_URL debe usar el driver postgresql+psycopg (psycopg 3).")
    if url.host not in ("localhost", "127.0.0.1", "::1"):
        raise ValueError("Solo se autoriza el host local de PostgreSQL.")
    if url.port not in (None, 5432):
        raise ValueError("Solo se autoriza el puerto 5432 de PostgreSQL.")
    if url.database != "dashboard_caja_ahorro" or url.username != "dashboard_user":
        raise ValueError("Base de datos o usuario PostgreSQL no autorizados.")
    if not url.password:
        raise ValueError("DATABASE_URL requiere contraseña; revisa Backend/.env.")


@lru_cache(maxsize=1)
def load_settings(env_path: Path | None = None) -> Settings:
    """Lee y valida ``Backend/.env`` una sola vez por proceso."""
    valores = _leer_variables(env_path or _ENV_PATH)
    faltantes = [clave for clave in _VARIABLES if clave not in valores]
    if faltantes:
        raise ValueError(f"Faltan variables de configuración: {', '.join(faltantes)}")

    try:
        puerto = int(valores["API_PORT"])
    except ValueError as exc:
        raise ValueError("API_PORT debe ser un entero.") from exc
    if not 1 <= puerto <= 65535:
        raise ValueError("API_PORT debe estar entre 1 y 65535.")

    nivel = valores["LOG_LEVEL"].upper()
    if nivel not in _NIVELES:
        raise ValueError(f"LOG_LEVEL debe ser uno de: {', '.join(sorted(_NIVELES))}.")

    origenes = tuple(
        origen.strip() for origen in valores["CORS_ORIGINS"].split(",") if origen.strip()
    )
    if not origenes:
        raise ValueError("CORS_ORIGINS debe contener al menos un origen.")

    database_url = valores["DATABASE_URL"]
    _validar_destino(database_url)

    return Settings(
        api_host=valores["API_HOST"],
        api_port=puerto,
        log_level=nivel,
        cors_origins=origenes,
        database_url=database_url,
    )


settings = load_settings()
