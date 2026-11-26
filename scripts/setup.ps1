<#
.SYNOPSIS
    Instalación reproducible en Windows del dashboard (fase VII, paso 28).

.DESCRIPTION
    Crea/reutiliza .venv, instala dependencias de Backend y ETL, instala las
    dependencias del frontend desde package-lock.json y crea archivos .env
    desde las plantillas solo cuando no existen. Nunca sobrescribe un .env
    existente ni imprime credenciales. -SoloComprobar valida rutas y el estado
    de los .env sin instalar ni copiar nada.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
    powershell -ExecutionPolicy Bypass -File scripts\setup.ps1 -SoloComprobar
#>
[CmdletBinding()]
param(
    [switch]$SkipFrontend,
    [switch]$SkipDockerCheck,
    [switch]$SoloComprobar
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$venv = Join-Path $root '.venv'
$python = Join-Path $venv 'Scripts\python.exe'

function Assert-File([string]$relative) {
    $path = Join-Path $root $relative
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Falta el archivo requerido: $relative"
    }
    return $path
}

function Invoke-Checked([string]$file, [string[]]$arguments, [string]$workingDirectory) {
    Write-Host "==> $file $($arguments -join ' ')"
    # -r Backend\requirements.txt y -r ETL\requirements.txt son relativos a la raíz.
    Push-Location $root
    try {
        & $file @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Falló ($LASTEXITCODE): $file $($arguments -join ' ')"
        }
    }
    finally { Pop-Location }
}

Write-Host "Raíz del proyecto: $root"
Assert-File 'Backend\requirements.txt' | Out-Null
Assert-File 'ETL\requirements.txt' | Out-Null
Assert-File 'Frontend\package.json' | Out-Null
Assert-File 'Frontend\package-lock.json' | Out-Null
Assert-File 'Backend\.env.example' | Out-Null
Assert-File 'Frontend\.env.example' | Out-Null
Assert-File 'data\raw\manifest.json' | Out-Null

$pyCommand = Get-Command python -ErrorAction SilentlyContinue
if (-not $pyCommand) {
    throw 'No se encontró python en PATH. Instale Python 3.14 para Windows y vuelva a intentarlo.'
}
$version = & $pyCommand.Source --version 2>&1
if ($version -notmatch '3\.(\d+)') {
    throw "No se pudo identificar la versión de Python: $version"
}
if ([int]$Matches[1] -lt 10) {
    throw "Se requiere Python 3.10 o superior; encontrado: $version"
}
Write-Host "Python del sistema: $version"

if ($SoloComprobar) {
    foreach ($pair in @(
        @{ Target = 'Backend\.env'; Source = 'Backend\.env.example' },
        @{ Target = 'Frontend\.env'; Source = 'Frontend\.env.example' }
    )) {
        $target = Join-Path $root $pair.Target
        if (Test-Path -LiteralPath $target) {
            Write-Host "$($pair.Target) existe; setup.ps1 no lo modificaría."
        }
        else {
            Write-Host "$($pair.Target) no existe; se crearía desde $($pair.Source)."
        }
    }
    Write-Host 'Comprobación sin escrituras correcta.'
    exit 0
}

if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
    Write-Host 'Creando entorno virtual .venv...'
    & $pyCommand.Source -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw "No se pudo crear .venv ($LASTEXITCODE)" }
}
else {
    Write-Host 'Reutilizando .venv existente.'
}

Invoke-Checked $python @('-m', 'pip', 'install', '--disable-pip-version-check',
    '-r', 'Backend\requirements.txt', '-r', 'ETL\requirements.txt') $root
Invoke-Checked $python @('-m', 'pip', 'check') $root

foreach ($pair in @(
    @{ Source = 'Backend\.env.example'; Target = 'Backend\.env' },
    @{ Source = 'Frontend\.env.example'; Target = 'Frontend\.env' }
)) {
    $target = Join-Path $root $pair.Target
    if (Test-Path -LiteralPath $target) {
        Write-Host "$($pair.Target) ya existe; no se modifica."
    }
    else {
        Copy-Item -LiteralPath (Join-Path $root $pair.Source) -Destination $target
        Write-Host "Creado $($pair.Target) desde la plantilla. Revise los valores locales antes de arrancar."
    }
}

if (-not $SkipFrontend) {
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npm) {
        throw 'No se encontró npm en PATH. Instale Node.js 18 o superior.'
    }
    Write-Host "npm: $(& $npm.Source --version)"
    $nodeModules = Join-Path $root 'Frontend\node_modules'
    if (Test-Path -LiteralPath $nodeModules) {
        Write-Host 'Frontend/node_modules ya existe; no se reinstala. Para una instalación limpia, elimínelo y vuelva a ejecutar setup.ps1.'
    }
    else {
        Write-Host 'Instalando dependencias del frontend con npm ci...'
        Push-Location (Join-Path $root 'Frontend')
        try {
            & $npm.Source ci
            if ($LASTEXITCODE -ne 0) { throw "npm ci falló ($LASTEXITCODE)" }
        }
        finally { Pop-Location }
    }
}

if (-not $SkipDockerCheck) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Warning 'Docker no está en PATH. La carga/valid SQL requiere el contenedor dashboard-postgres.'
    }
    else {
        $estado = & docker inspect dashboard-postgres --format '{{.State.Running}}' 2>$null
        if ($LASTEXITCODE -ne 0 -or $estado -ne 'true') {
            Write-Warning 'El contenedor dashboard-postgres no está activo. Inícielo antes de inicializar la base.'
        }
        else {
            Write-Host 'Contenedor dashboard-postgres activo.'
        }
    }
}

Write-Host @'

Instalación terminada.
Siguiente paso habitual:
  powershell -ExecutionPolicy Bypass -File scripts\run_etl.ps1 -InicializarBase -Cargar
  powershell -ExecutionPolicy Bypass -File scripts\start.ps1
'@