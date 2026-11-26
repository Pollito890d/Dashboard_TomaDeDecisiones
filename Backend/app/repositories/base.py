"""Utilidades comunes de lectura: siempre ``SELECT`` con parámetros enlazados."""

from typing import Any, TypeVar

from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

Modelo = TypeVar("Modelo", bound=BaseModel)


def clausula_where(filtros: list[str]) -> str:
    """Compone una cláusula WHERE a partir de fragmentos fijos de SQL."""
    return f" WHERE {' AND '.join(filtros)}" if filtros else ""


def agregar_limite(sql: str, limite: int | None, parametros: dict[str, Any]) -> str:
    """Añade LIMIT enlazado; el valor nunca se interpola en la sentencia."""
    if limite is None:
        return sql
    parametros["limite"] = limite
    return f"{sql} LIMIT :limite"


def consultar(
    sesion: Session,
    sql: str,
    parametros: dict[str, Any],
    modelo: type[Modelo],
) -> list[Modelo]:
    """Convierte cada fila en el modelo Pydantic de su granularidad."""
    filas = sesion.execute(text(sql), parametros).mappings().all()
    return [modelo.model_validate(dict(fila)) for fila in filas]
