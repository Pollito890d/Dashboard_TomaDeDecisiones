"""Ejecuta archivos SQL en el PostgreSQL local usando el cliente del contenedor Docker.

Windows no requiere psql instalado: se lee la URL desde Backend/.env solo para
validar el destino y pasar la contraseña al proceso de Docker sin imprimirla.
El contenedor se puede seleccionar con --contenedor; por defecto es
``dashboard-postgres``. Antes de cualquier escritura se comprueba que el
contenedor publica el mismo puerto y expone el mismo usuario/base que
Backend/.env, de modo que SQL y ETL no puedan apuntar a instancias distintas.

Uso desde la raíz:
    .\\.venv\\Scripts\\python.exe scripts\\run_sql_docker.py Database/04_validation.sql
    .\\.venv\\Scripts\\python.exe scripts\\run_sql_docker.py --contenedor dashboard-postgres --validar
"""

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

from dotenv import dotenv_values
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]
CONTENEDOR = 'dashboard-postgres'


def destino():
    """Devuelve (url, usuario, base, contraseña) tras validar el destino local."""
    valor = dotenv_values(ROOT / 'Backend' / '.env').get('DATABASE_URL')
    if not valor:
        raise ValueError('DATABASE_URL no está definida en Backend/.env')
    url = make_url(valor)
    if (url.drivername != 'postgresql+psycopg'
            or url.host not in ('localhost', '127.0.0.1', '::1')
            or url.port not in (None, 5432)
            or url.database != 'dashboard_caja_ahorro'
            or url.username != 'dashboard_user'):
        raise ValueError('Destino de base no autorizado')
    return url, url.username, url.database, url.password or ''


def inspeccionar(contenedor, formato):
    """Devuelve la salida de docker inspect; nunca incluye credenciales."""
    resultado = subprocess.run(
        ['docker', 'inspect', '--format', formato, contenedor],
        capture_output=True, text=True, check=False,
    )
    if resultado.returncode != 0:
        raise ValueError(f'No se pudo inspeccionar el contenedor {contenedor}')
    return resultado.stdout.strip()


def validar_contenedor(contenedor, url, usuario, base, password):
    """Comprueba, sin escribir, que el contenedor coincide con Backend/.env."""
    if inspeccionar(contenedor, '{{.State.Running}}') != 'true':
        raise ValueError(f'El contenedor {contenedor} no está activo')

    esperado_puerto = str(url.port or 5432)
    puertos = json.loads(inspeccionar(contenedor, '{{json .NetworkSettings.Ports}}'))
    enlaces = puertos.get('5432/tcp') or []
    host = url.host
    permitidos = {'0.0.0.0', '::', '127.0.0.1', '::1', host}
    coincide = any(
        str(enlace.get('HostPort')) == esperado_puerto
        and enlace.get('HostIp') in permitidos
        for enlace in enlaces
    )
    if not coincide:
        raise ValueError(
            f'El contenedor {contenedor} no publica {esperado_puerto}/tcp para el host local esperado'
        )

    entorno = dict(os.environ, PGPASSWORD=password)
    consulta = "SELECT current_user || '/' || current_database()"
    resultado = subprocess.run(
        ['docker', 'exec', '-i', '-e', 'PGPASSWORD', contenedor,
         'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', usuario, '-d', base,
         '-tAc', consulta],
        env=entorno, input='', capture_output=True, text=True, check=False,
    )
    if resultado.returncode != 0 or resultado.stdout.strip() != f'{usuario}/{base}':
        raise ValueError(
            f'El contenedor {contenedor} no expone la base y el usuario esperados'
        )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--contenedor', default=CONTENEDOR,
                        help='contenedor Docker que ejecuta PostgreSQL')
    parser.add_argument('--validar', action='store_true',
                        help='solo valida la configuración; no ejecuta SQL')
    parser.add_argument('sql', nargs='*', help='archivos SQL a ejecutar, en orden')
    args = parser.parse_args(argv)
    try:
        url, usuario, base, password = destino()
        validar_contenedor(args.contenedor, url, usuario, base, password)
    except Exception as exc:
        print('Configuración incompatible: ' + str(exc), file=sys.stderr)
        return 2

    if args.validar or not args.sql:
        print(f'Contenedor {args.contenedor} coherente con Backend/.env; sin escrituras.')
        return 0

    entorno = dict(os.environ, PGPASSWORD=password)
    for nombre in args.sql:
        ruta = Path(nombre)
        if not ruta.is_absolute():
            ruta = ROOT / ruta
        if not ruta.is_file() or ruta.suffix.lower() != '.sql':
            print('Archivo SQL no encontrado: ' + nombre, file=sys.stderr)
            return 2
        comando = [
            'docker', 'exec', '-i', '-e', 'PGPASSWORD', args.contenedor,
            'psql', '-X', '-v', 'ON_ERROR_STOP=1',
            '-U', usuario, '-d', base, '-f', '-',
        ]
        resultado = subprocess.run(comando, input=ruta.read_bytes(), env=entorno, check=False)
        if resultado.returncode != 0:
            print('Fallo al ejecutar ' + nombre + ' (psql devolvió ' + str(resultado.returncode) + ')',
                  file=sys.stderr)
            return resultado.returncode
        print('OK: ' + nombre)
    return 0


if __name__ == '__main__':
    sys.exit(main())
