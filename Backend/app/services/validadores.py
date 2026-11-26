"""Validación ligera de parámetros de consulta antes de enlazarlos en SQL."""

from __future__ import annotations

import re

_PERIODO_YM = re.compile(r"^\d{4}-(?:0[1-9]|1[0-2])$")
_TRIMESTRE = re.compile(r"^\d{4}-Q[1-4]$")
_CLAVE_SEIS = re.compile(r"^\d{6}$")
_CVE_ENT = re.compile(r"^\d{2}$")


def validar_anio(anio: int | None) -> None:
    if anio is not None and (isinstance(anio, bool) or not 2000 <= anio <= 2100):
        raise ValueError("anio debe ser un entero entre 2000 y 2100.")


def validar_periodo_ym(periodo: str | None, nombre: str = "periodo") -> None:
    if periodo is not None and not _PERIODO_YM.fullmatch(periodo):
        raise ValueError(f"{nombre} debe tener formato YYYY-MM.")


def validar_trimestre(trimestre: str | None) -> None:
    if trimestre is not None and not _TRIMESTRE.fullmatch(trimestre):
        raise ValueError("trimestre debe tener formato YYYY-Qn (n = 1..4).")


def validar_limite(limite: int | None) -> None:
    if limite is not None and (isinstance(limite, bool) or limite < 1):
        raise ValueError("limite debe ser un entero positivo.")


def validar_clave_seis(clave_seis: str | None) -> None:
    if clave_seis is not None and not _CLAVE_SEIS.fullmatch(clave_seis):
        raise ValueError("clave_seis debe contener exactamente 6 dígitos.")


def validar_cve_ent(cve_ent: str | None) -> None:
    if cve_ent is not None and not _CVE_ENT.fullmatch(cve_ent):
        raise ValueError("cve_ent debe contener exactamente 2 dígitos (ceros iniciales incluidos).")


def validar_opcion(valor: str | None, permitidas: set[str], nombre: str) -> None:
    if valor is not None and valor not in permitidas:
        raise ValueError(f"{nombre} debe ser uno de: {', '.join(sorted(permitidas))}.")
