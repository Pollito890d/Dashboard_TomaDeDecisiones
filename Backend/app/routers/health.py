"""Endpoint de salud: 200 con PostgreSQL disponible, 503 si la conexión falla."""

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_session
from app.schemas.health import HealthResponse
from app.services.health_service import check_database

router = APIRouter(prefix="/api", tags=["health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Estado de la API y de PostgreSQL",
    description="Ejecuta SELECT 1 sobre la conexión de solo lectura; 503 si falla.",
)
def health(
    response: Response,
    sesion: Session = Depends(get_session),
) -> HealthResponse:
    resultado = check_database(sesion)
    if resultado.status == "unavailable":
        response.status_code = 503
    return resultado
