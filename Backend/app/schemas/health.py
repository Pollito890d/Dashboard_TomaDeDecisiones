"""Esquema de la respuesta de salud."""

from typing import Literal

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["ok", "unavailable"]
    database: Literal["connected", "disconnected"]
    detail: str | None = None
