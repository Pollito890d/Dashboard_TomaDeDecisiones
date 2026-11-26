# Configuración de PostgreSQL — paso 07

## Alcance

Cliente Python para PostgreSQL local; no se crean tablas, usuarios ni bases y no se implementa ETL. La base `dashboard_caja_ahorro` y el usuario sin privilegios administrativos `dashboard_user` ya existían según la comprobación manual indicada. `scripts/check_db.py` solo acepta ese usuario y base, host `localhost`, `127.0.0.1` o `::1` y puerto predeterminado o 5432. Ejecuta únicamente `SELECT 1` y cierra la conexión.

## Preparación reproducible en PowerShell

Desde la raíz del repositorio, con Python 3.14.5 para Windows x64:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r Backend\requirements.txt
.\.venv\Scripts\python.exe -m pip check
```

Si `.venv` ya existe y utiliza el Python esperado, omitir su creación. El archivo fija las versiones directas y transitivas observadas en Windows; no fija hashes de paquetes ni garantiza resolución idéntica en otra plataforma. Se usan SQLAlchemy con dialecto `postgresql+psycopg`, psycopg 3 con distribución binaria y python-dotenv. No se requieren binarios de compilación de PostgreSQL para esta combinación verificada.

## Configuración privada y prueba

Si no existe el archivo privado, copiar la plantilla sin sobrescribir una configuración existente:

```powershell
if (-not (Test-Path Backend\.env)) { Copy-Item Backend\.env.example Backend\.env }
notepad Backend\.env
```

En el editor, sustituir **solo la contraseña de ejemplo** en `DATABASE_URL` por la contraseña local ya configurada para `dashboard_user`. No compartir el archivo ni pegar su contenido en incidencias, consola o chat. La URL tiene la forma `postgresql+psycopg://usuario:contraseña_codificada@localhost:5432/dashboard_caja_ahorro`. Si la contraseña contiene caracteres reservados como `@`, `:`, `/`, `%` o `#`, codificar con percent-encoding UTF-8 el componente de contraseña antes de colocarlo en la URL; no codificar la URL completa. No ejecutar comandos que muestren la contraseña.

Guardar y ejecutar desde la raíz:

```powershell
.\.venv\Scripts\python.exe scripts\check_db.py
```

Éxito: `Conexión correcta; SELECT 1 devolvió 1.` y código de salida 0. Fallo: mensaje genérico y código 1, sin detalles de excepción que puedan filtrar credenciales. Comprobar configuración, codificación de contraseña y disponibilidad del servidor; el script no imprime la URL. Lee exclusivamente `Backend/.env`, no variables heredadas del proceso. `.env` y `.env.*` están ignorados; `.env.example` está explícitamente permitido. Mantener cualquier copia de credenciales fuera de Git.

## Resultados verificados en este paso

- Rama `feature/database`; Python `3.14.5`; se creó `.venv` local, ignorado por Git.
- Instalación correcta: SQLAlchemy `2.1.9`, psycopg y psycopg-binary `3.3.9`, python-dotenv `1.2.4`, typing-extensions `4.16.0`, tzdata `2026.6`. Importaciones correctas; psycopg reporta implementación `binary`; `pip check` no detectó conflictos.
- `pg_isready` de PostgreSQL 17 respondió `localhost:5432 - aceptando conexiones`. Esto comprueba disponibilidad del servidor, **no** autenticación ni acceso a la base.
- `git check-ignore` confirma que `Backend/.env` y `Backend/.env.local` se ignoran y la excepción permite `Backend/.env.example`.
- Sin `Backend/.env`, el script real devolvió el mensaje de archivo ausente y código 1, sin mostrar secretos. Pruebas simuladas verificaron la ruta de éxito y rechazo de otra base sin abrir conexión.
- La conexión real y `SELECT 1` desde el script **quedan pendientes** hasta configurar el `.env` privado. La conexión previa con `psql` es contexto aportado por el usuario, no una nueva prueba ejecutada aquí.
