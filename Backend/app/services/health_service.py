"""Comprobación de disponibilidad de PostgreSQL sin exponer credenciales ni errores."""

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.schemas.health import HealthResponse


def check_database(sesion: Session) -> HealthResponse:
    """Devuelve ``ok`` si la sesión ejecuta una consulta mínima; ``unavailable`` si falla."""
    try:
        sesion.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return HealthResponse(
            status="unavailable",
            database="disconnected",
            detail="PostgreSQL no está disponible.",
        )
    return HealthResponse(status="ok", database="connected", detail=None)
