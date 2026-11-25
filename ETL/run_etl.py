"""Paso 14: orquestador del ETL local (extracción + transformación + validación).

Uso desde la raíz del repositorio:
    .\\.venv\\Scripts\\python.exe ETL\\run_etl.py                 # las tres fuentes
    .\\.venv\\Scripts\\python.exe ETL\\run_etl.py --fuente cnbv   # una o varias fuentes

Modo local por defecto: no requiere PostgreSQL ni DATABASE_URL. Las salidas se generan en
un directorio temporal y solo reemplazan a las vigentes si todas las validaciones pasan.
"""

import argparse
from dataclasses import asdict, replace
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import FUENTES, VERSION_PROCESO, load_settings, setup_logging  # noqa: E402
from common import RECHAZO_COLUMNAS, EtlError, sha256_file, verify_manifest, write_csv, write_json  # noqa: E402
import cnbv_etl  # noqa: E402
import fonacot_etl  # noqa: E402
import sniiv_etl  # noqa: E402
from validations import VALIDADORES  # noqa: E402

MODULOS = {'cnbv': cnbv_etl, 'fonacot': fonacot_etl, 'sniiv': sniiv_etl}
MANIFIESTO = 'etl_manifest.json'


def cargar_postgres(*_args, **_kwargs):
    """Carga SQL futura: se implementará tras el merge de fases II y III (ver
    docs/etl_integracion_pendiente.md). Deshabilitada: no se simula ninguna conexión."""
    raise NotImplementedError('La carga a PostgreSQL no forma parte de la fase III')


def parse_args(argv):
    p = argparse.ArgumentParser(description='ETL local CNBV / FONACOT / SNIIV (sin base de datos)')
    p.add_argument('--fuente', choices=FUENTES + ('todas',), nargs='+', default=['todas'],
                   help='fuentes a procesar (por defecto: todas)')
    p.add_argument('--salida', help='directorio de salida (por defecto ETL_PROCESSED_DIR o data/processed)')
    p.add_argument('--cargar', action='store_true', help='reservado: carga SQL no implementada en la fase III')
    return p.parse_args(argv)


def run(argv=None, settings=None):
    args = parse_args(argv)
    settings = settings or load_settings()
    if args.salida:
        settings = replace(settings, processed_dir=Path(args.salida).resolve())
    fuentes = list(FUENTES) if 'todas' in args.fuente else sorted(set(args.fuente), key=FUENTES.index)
    started = datetime.now(timezone.utc)
    stamp = started.strftime('%Y%m%dT%H%M%SZ')
    log = setup_logging(settings, settings.log_dir / f'etl_{stamp}.log')
    if args.cargar:
        log.error('--cargar no está disponible: la carga SQL queda pendiente de la integración')
        return 2
    staging = settings.processed_dir / f'.staging_{stamp}_{os.getpid()}'
    record = dict(version_proceso=VERSION_PROCESO, iniciada_en=started.isoformat(), fuentes=fuentes,
                  salida=str(settings.processed_dir), estado='iniciada', fuentes_resultado={})
    try:
        files = verify_manifest(settings)
        log.info('Originales verificados contra manifiesto: %s/19', len(files))
        sections, validaciones = {}, []
        for fuente in fuentes:
            t0 = time.perf_counter()
            out_dir = staging / fuente
            out_dir.mkdir(parents=True)
            result = MODULOS[fuente].run(settings, files, out_dir)
            write_csv(out_dir / f'rechazos_{fuente}.csv', RECHAZO_COLUMNAS, result.rechazos)
            checks = VALIDADORES[fuente](out_dir, result, settings)
            validaciones += checks
            failed = [c for c in checks if c['resultado'] == 'falla']
            record['fuentes_resultado'][fuente] = dict(segundos=round(time.perf_counter() - t0, 2),
                                                        pruebas=len(checks), fallas=len(failed))
            for c in checks:
                (log.error if c['resultado'] == 'falla' else log.warning if c['resultado'] == 'advertencia'
                 else log.debug)('[%s] %s: %s %s', fuente, c['prueba'], c['resultado'], c['detalle'])
            if failed:
                raise EtlError(f'{len(failed)} validaciones fallidas en {fuente}; no se publica ninguna salida')
            sections[fuente] = section(result, out_dir, files, checks)
        if verify_manifest(settings).keys() != files.keys():
            raise EtlError('Los originales cambiaron durante la ejecución')
        publish(settings, staging, sections)
        record.update(estado='exitosa', originales_intactos='19/19')
        log.info('ETL exitoso: %s. Salidas en %s', ', '.join(fuentes), settings.processed_dir)
        return 0
    except Exception as exc:  # noqa: BLE001 - se registra y se devuelve código de error
        record.update(estado='fallida', error=f'{type(exc).__name__}: {exc}')
        log.error('ETL fallido, salidas vigentes sin cambios: %s', record['error'])
        return 1
    finally:
        shutil.rmtree(staging, ignore_errors=True)
        record['terminada_en'] = datetime.now(timezone.utc).isoformat()
        write_json(settings.log_dir / f'ejecucion_{stamp}.json', record)


def section(result, out_dir, files, checks):
    """Bloque determinista del manifiesto de salidas (sin fechas ni rutas absolutas)."""
    outputs = []
    for o in result.salidas:
        item = asdict(o)
        item['sha256'] = sha256_file(out_dir / o.archivo)
        outputs.append(item)
    return dict(
        version_proceso=VERSION_PROCESO,
        entradas=[dict(archivo=a, sha256=files[a]['sha256'], tamano_bytes=files[a]['tamano_bytes'],
                       periodo=files[a]['periodo']) for a in result.entradas],
        salidas=outputs,
        rechazos=dict(archivo=f'rechazos_{result.fuente}.csv', filas=len(result.rechazos),
                      sha256=sha256_file(out_dir / f'rechazos_{result.fuente}.csv')),
        conciliacion=result.conciliacion,
        validaciones=dict(total=len(checks), ok=sum(c['resultado'] == 'ok' for c in checks),
                          advertencias=[c for c in checks if c['resultado'] == 'advertencia'],
                          pruebas=[f"{c['resultado']}: {c['prueba']}" for c in checks]),
    )


def publish(settings, staging, sections):
    """Reemplaza salidas solo después de validar todas las fuentes de la ejecución."""
    target = settings.processed_dir
    target.mkdir(parents=True, exist_ok=True)
    for fuente in sections:
        for path in sorted((staging / fuente).iterdir()):
            os.replace(path, target / path.name)
    manifest_path = target / MANIFIESTO
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.is_file() else {}
    manifest.setdefault('fuentes', {}).update(sections)
    manifest['descripcion'] = ('Manifiesto determinista de salidas del ETL local (fase III). '
                               'NULL = campo vacío en CSV. Ver docs/etl_calidad.md.')
    write_json(manifest_path, manifest)


if __name__ == '__main__':
    sys.exit(run())
