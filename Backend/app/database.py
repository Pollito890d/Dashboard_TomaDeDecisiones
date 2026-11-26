"""Conexiones SQLAlchemy de lectura hacia PostgreSQL (Fase V, pasos 18-19).

Todas las sesiones se abren con ``default_transaction_read_only=on``: la API no
puede modificar la base aunque un consultante intente enviar una sentencia de
escritura. Los repositorios solo ejecutan ``SELECT`` sobre tablas y vistas.
"""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings

# Sin un connect_timeout explícito, psycopg espera indefinidamente cuando el
# contenedor PostgreSQL está detenido y /api/health nunca devuelve el 503.
CONNECT_TIMEOUT_SEGUNDOS = 5

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=1800,
    connect_args={
        "options": "-c default_transaction_read_only=on",
        "connect_timeout": CONNECT_TIMEOUT_SEGUNDOS,
    },
)

SessionFactory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    """Dependencia de FastAPI: entrega una sesión de solo lectura por petición."""
    with SessionFactory() as sesion:
        yield sesion
