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

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\run_etl.ps1
    powershell -ExecutionPolicy Bypass -File scripts\run_etl.ps1 -InicializarBase -Cargar
#>
[CmdletBinding()]
param(
    [switch]$InicializarBase,
    [switch]$Cargar,
    [switch]$SinValidar,
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
    & $python @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Falló el paso del ETL ($LASTEXITCODE): $($arguments -join ' ')"
    }
}

function Invoke-Sql([string[]]$files) {
    foreach ($file in $files) {
        Assert-File $file | Out-Null
        Invoke-Python @('scripts\run_sql_docker.py', $file)
    }
}

Assert-File '.venv\Scripts\python.exe' | Out-Null
Assert-File 'Backend\.env' | Out-Null
Assert-File 'data\raw\manifest.json' | Out-Null
Assert-File 'ETL\run_etl.py' | Out-Null
Assert-File 'scripts\check_db.py' | Out-Null

$usaBase = $InicializarBase -or $Cargar
if ($usaBase) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker no está en PATH; se necesita para la base PostgreSQL local.'
    }
    $estado = & docker inspect $Contenedor --format '{{.State.Running}}' 2>$null
    if ($LASTEXITCODE -ne 0 -or $estado -ne 'true') {
        throw "El contenedor $Contenedor no está activo. Arránquelo antes de continuar."
    }
    Invoke-Python @('scripts\check_db.py')
}

if ($InicializarBase) {
    Write-Host 'Inicializando esquema, catálogos y vistas...'
    Invoke-Python @('scripts\run_sql_docker.py', 'Database\01_schema.sql')
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