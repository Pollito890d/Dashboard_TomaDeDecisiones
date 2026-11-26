<#
.SYNOPSIS
    Arranca o verifica FastAPI y React en Windows (fase VII, paso 28).

.DESCRIPTION
    Comprueba la base, los archivos .env y las dependencias. Si los puertos ya
    están ocupados, solo verifica los servicios; si están libres, inicia Uvicorn
    y Vite. Es idempotente: no detiene ni reinicia procesos que ya funcionan.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\start.ps1
    powershell -ExecutionPolicy Bypass -File scripts\start.ps1 -ApiPort 8010 -FrontPort 5174
#>
[CmdletBinding()]
param(
    [int]$ApiPort = 8000,
    [int]$FrontPort = 5173,
    [switch]$NoReload,
    [switch]$SkipDbCheck
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root '.venv\Scripts\python.exe'
$frontend = Join-Path $root 'Frontend'

function Assert-File([string]$relative) {
    $path = Join-Path $root $relative
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Falta el archivo requerido: $relative"
    }
    return $path
}

function Test-Port([int]$port) {
    return [bool](Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
}

function Get-HttpStatus([string]$url) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 3
        return [int]$response.StatusCode
    }
    catch {
        return 0
    }
}

function Wait-Http([string]$url, [int]$timeoutSeconds = 30) {
    $deadline = (Get-Date).AddSeconds($timeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if ((Get-HttpStatus $url) -eq 200) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

Assert-File '.venv\Scripts\python.exe' | Out-Null
Assert-File 'Backend\.env' | Out-Null
Assert-File 'Frontend\.env' | Out-Null
Assert-File 'Backend\app\main.py' | Out-Null
Assert-File 'Frontend\package.json' | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $frontend 'node_modules') -PathType Container)) {
    throw 'Falta Frontend/node_modules; ejecute primero scripts\setup.ps1.'
}

if (-not $SkipDbCheck) {
    Write-Host 'Comprobando PostgreSQL local...'
    & $python (Join-Path $root 'scripts\check_db.py')
    if ($LASTEXITCODE -ne 0) { throw 'La comprobación de PostgreSQL falló; revise Backend/.env y el contenedor.' }
}

$healthUrl = "http://127.0.0.1:$ApiPort/api/health"
$docsUrl = "http://127.0.0.1:$ApiPort/docs"
$frontUrl = "http://localhost:$FrontPort"

if (Test-Port $ApiPort) {
    Write-Host "Puerto $ApiPort ya en escucha; no se inicia otra instancia de FastAPI."
}
else {
    Write-Host "Arrancando FastAPI en 127.0.0.1:$ApiPort..."
    $uvicornArguments = "-m uvicorn app.main:app --app-dir Backend --host 127.0.0.1 --port $ApiPort"
    if (-not $NoReload) { $uvicornArguments += ' --reload' }
    Start-Process -FilePath $python -ArgumentList $uvicornArguments -WorkingDirectory $root -WindowStyle Hidden | Out-Null
}

if (-not (Wait-Http $healthUrl)) {
    throw "FastAPI no respondió $healthUrl con 200 en el tiempo esperado."
}
$docsStatus = Get-HttpStatus $docsUrl
if ($docsStatus -ne 200) { throw "Swagger no respondió 200 en $docsUrl (estado $docsStatus)." }
Write-Host "FastAPI correcto: $healthUrl y $docsUrl"

if (Test-Port $FrontPort) {
    Write-Host "Puerto $FrontPort ya en escucha; no se inicia otra instancia de Vite."
}
else {
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $npm) { throw 'No se encontró npm en PATH.' }
    # Start-Process no puede ejecutar npm.ps1; se usa el ejecutable .cmd del mismo directorio.
    $npmCmd = Join-Path (Split-Path -Parent $npm.Source) 'npm.cmd'
    if (-not (Test-Path -LiteralPath $npmCmd)) { $npmCmd = 'npm.cmd' }
    Write-Host "Arrancando React/Vite en localhost:$FrontPort..."
    Start-Process -FilePath $npmCmd -ArgumentList @('run', 'dev', '--', '--port', "$FrontPort") `
        -WorkingDirectory $frontend -WindowStyle Hidden | Out-Null
}

if (-not (Wait-Http $frontUrl)) {
    throw "React/Vite no respondió $frontUrl con 200 en el tiempo esperado."
}
Write-Host @"

Servicios verificados:
  PostgreSQL        comprobada desde Backend/.env
  FastAPI           http://127.0.0.1:$ApiPort
  Swagger           $docsUrl
  Health            $healthUrl
  React / Vite      $frontUrl
"@