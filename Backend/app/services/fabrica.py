"""Fábrica única de servicios para futuros routers y para pruebas específicas."""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.services.catalogos_service import CatalogosService
from app.services.cnbv_service import CnbvInstitucionService, CnbvSectorService
from app.services.fonacot_service import FonacotService
from app.services.sniiv_service import SniivService


@dataclass(frozen=True)
class Servicios:
    cnbv_sector: CnbvSectorService
    cnbv_institucion: CnbvInstitucionService
    fonacot: FonacotService
    sniiv: SniivService
    catalogos: CatalogosService


def construir_servicios(sesion: Session) -> Servicios:
    return Servicios(
        cnbv_sector=CnbvSectorService(sesion),
        cnbv_institucion=CnbvInstitucionService(sesion),
        fonacot=FonacotService(sesion),
        sniiv=SniivService(sesion),
        catalogos=CatalogosService(sesion),
    )
