"""Ejecuta archivos SQL en el PostgreSQL local usando el cliente del contenedor Docker.

Windows no requiere psql instalado: se lee la URL desde Backend/.env solo para
validar el destino y pasar la contraseña al proceso de Docker sin imprimirla.
Uso desde la raíz:
    .\\.venv\\Scripts\\python.exe scripts\\run_sql_docker.py Database/03_views.sql
    .\\.venv\\Scripts\\python.exe scripts\\run_sql_docker.py Database/04_validation.sql
"""

import argparse
import os
from pathlib import Path
import subprocess
import sys

from dotenv import dotenv_values
from sqlalchemy.engine import make_url

ROOT = Path(__file__).resolve().parents[1]
CONTENEDOR = 'dashboard-postgres'


def destino():
    """Devuelve (usuario, base, contraseña) tras comprobar que el destino es el local."""
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
    return url.username, url.database, url.password or ''


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sql', nargs='+', help='archivos SQL a ejecutar, en orden')
    args = parser.parse_args(argv)
    try:
        usuario, base, password = destino()
    except Exception:
        print('No se pudo validar el destino local desde Backend/.env', file=sys.stderr)
        return 2
    entorno = dict(os.environ, PGPASSWORD=password)
    for nombre in args.sql:
        ruta = Path(nombre)
        if not ruta.is_absolute():
            ruta = ROOT / ruta
        if not ruta.is_file() or ruta.suffix.lower() != '.sql':
            print('Archivo SQL no encontrado: ' + nombre, file=sys.stderr)
            return 2
        comando = [
            'docker', 'exec', '-i', '-e', 'PGPASSWORD', CONTENEDOR,
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
