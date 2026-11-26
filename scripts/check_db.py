"""Comprueba únicamente la conexión local y SELECT 1, sin mostrar secretos."""

from pathlib import Path
import sys

from dotenv import dotenv_values
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


def main() -> int:
    env_path = Path(__file__).resolve().parents[1] / "Backend" / ".env"
    if not env_path.is_file():
        print("No existe Backend/.env; consulte docs/configuracion_postgresql.md.")
        return 1

    try:
        value = dotenv_values(env_path).get("DATABASE_URL")
        if not value:
            print("DATABASE_URL no está definida en Backend/.env.")
            return 1
        url = make_url(value)
        if (
            url.drivername != "postgresql+psycopg"
            or url.host not in {"localhost", "127.0.0.1", "::1"}
            or url.port not in {None, 5432}
            or url.database != "dashboard_caja_ahorro"
            or url.username != "dashboard_user"
        ):
            print("DATABASE_URL no corresponde al destino local esperado; revise la configuración.")
            return 1

        engine = create_engine(url, connect_args={"connect_timeout": 5})
        try:
            with engine.connect() as connection:
                result = connection.execute(text("SELECT 1")).scalar_one()
            if result != 1:
                print("La consulta de comprobación devolvió un resultado inesperado.")
                return 1
        finally:
            engine.dispose()
    except Exception:
        # Las excepciones del controlador podrían contener la URL o datos sensibles.
        print("No se pudo comprobar la conexión; revise la configuración y el servidor local.")
        return 1

    print("Conexión correcta; SELECT 1 devolvió 1.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
