"""Aplicación FastAPI de la Fase V (pasos 18 a 21)."""

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import dashboard, fonacot, fuentes, health, instituciones, periodos, sniiv
from app.schemas.respuestas import CONTRATO_VERSION

app = FastAPI(
    title="Dashboard de Toma de Decisiones",
    version="1.0.0",
    description=(
        "API de solo lectura sobre las vistas validadas de la Fase IV. "
        "Contrato JSON v" + CONTRATO_VERSION + ": indicadores oficiales CNBV, "
        "FONACOT y SNIIV, sin datos sintéticos ni fórmulas recalculadas en Python."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
    """Errores 4xx/503 con la misma versión de contrato que las respuestas correctas."""
    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers,
        content={"contrato_version": CONTRATO_VERSION, "detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Validación de parámetros sin exponer valores sensibles de la petición."""
    errores = [
        {
            "campo": ".".join(str(parte) for parte in error.get("loc", ())),
            "mensaje": error.get("msg", "valor inválido"),
        }
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "contrato_version": CONTRATO_VERSION,
            "detail": "Parámetros de consulta inválidos.",
            "errores": errores,
        },
    )


app.include_router(health.router)
app.include_router(dashboard.router)
app.include_router(instituciones.router)
app.include_router(periodos.router)
app.include_router(fuentes.router)
app.include_router(fonacot.router)
app.include_router(sniiv.router)


if __name__ == "__main__":  # pragma: no cover - ejecución manual local
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        log_level=settings.log_level.lower(),
    )
