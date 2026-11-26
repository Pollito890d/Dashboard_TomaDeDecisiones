<#
.SYNOPSIS
    ETL local, inicialización opcional de PostgreSQL y carga reproducible (fase VII, paso 28).

.DESCRIPTION
    Sin opciones ejecuta solo el ETL local: valida los 19 originales y publica
    salidas en data/processed/ sin abrir conexión a PostgreSQL.
    -InicializarBase crea el esquema, carga catálogos y crea vistas en una base
    vacía; no modifica una base que ya contenga hechos.
    -Cargar ejecuta el ETL y carga las cinco salidas en una transacción; la
    repetición con las mismas firmas se omite por idempotencia.
    -SoloComprobar valida rutas, .env, Docker y la coherencia entre el contenedor
    y Backend/.env sin realizar escrituras.
    -Contenedor debe ser el mismo que publica el puerto configurado en
    Backend/.env; una configuración incompatible se rechaza antes de escribir.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\run_etl.ps1 -SoloComprobar
    powershell -ExecutionPolicy Bypass -File scripts\run_etl.ps1 -InicializarBase -Cargar
#>
[CmdletBinding()]
param(
    [switch]$InicializarBase,
    [switch]$Cargar,
    [switch]$SinValidar,
    [switch]$SoloComprobar,
    [string]$Contenedor = 'dashboard-postgres'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root '.venv\Scripts\python.exe'

function Assert-File([string]$relative) {
    $path = Join-Path $root $relative
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Falta el archivo requerido: $relative"
    }
    return $path
}

function Invoke-Python([string[]]$arguments) {
    Write-Host "==> python $($arguments -join ' ')"
    # Las rutas relativas de los scripts se resuelven siempre desde la raíz del proyecto.
    Push-Location $root
    try {
        & $python @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Falló el paso del ETL ($LASTEXITCODE): $($arguments -join ' ')"
        }
    }
    finally { Pop-Location }
}

function Assert-ConfiguracionBase {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker no está en PATH; se necesita para la base PostgreSQL local.'
    }
    # Ambos validadores son de solo lectura y se ejecutan antes de cualquier escritura.
    Invoke-Python @('scripts\check_db.py')
    Invoke-Python @('scripts\run_sql_docker.py', '--contenedor', $Contenedor, '--validar')
}

function Invoke-Sql([string[]]$files) {
    foreach ($file in $files) {
        Assert-File $file | Out-Null
        Invoke-Python @('scripts\run_sql_docker.py', '--contenedor', $Contenedor, $file)
    }
}

Assert-File '.venv\Scripts\python.exe' | Out-Null
Assert-File 'Backend\.env' | Out-Null
Assert-File 'data\raw\manifest.json' | Out-Null
Assert-File 'ETL\run_etl.py' | Out-Null
Assert-File 'scripts\check_db.py' | Out-Null
Assert-File 'scripts\run_sql_docker.py' | Out-Null

if ($SoloComprobar) {
    Assert-ConfiguracionBase
    Write-Host "Comprobación sin escrituras correcta: contenedor $Contenedor coherente con Backend/.env."
    exit 0
}

$usaBase = $InicializarBase -or $Cargar
if ($usaBase) {
    Assert-ConfiguracionBase
}

if ($InicializarBase) {
    Write-Host 'Inicializando esquema, catálogos y vistas...'
    Invoke-Python @('scripts\run_sql_docker.py', '--contenedor', $Contenedor, 'Database\01_schema.sql')
    Invoke-Python @('ETL\load_catalogs.py')
    Invoke-Sql @('Database\views\01_vistas.sql', 'Database\views\02_kpis.sql')
}

$etlArgs = @('ETL\run_etl.py')
if ($Cargar) { $etlArgs += '--cargar' }
Invoke-Python $etlArgs

if ($Cargar -and -not $SinValidar) {
    Write-Host 'Validando la carga y los nueve KPIs...'
    Invoke-Sql @('Database\04_validation.sql', 'Database\tests\validacion_kpis.sql')
}

Write-Host 'ETL finalizado correctamente.'
