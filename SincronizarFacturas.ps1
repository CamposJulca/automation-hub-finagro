# =============================================================================
# SincronizarFacturas.ps1
# Descarga los PDFs de facturas electronicas (por semana) desde el portal
# Automation Hub y los guarda en la carpeta local, sin repetir descargas.
#
# USO:
#   1. Abrir PowerShell como usuario normal (no requiere admin)
#   2. Si es la primera vez, habilitar scripts:
#      Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
#   3. Ejecutar:
#      .\SincronizarFacturas.ps1
#
# PROGRAMAR EN TASK SCHEDULER (opcional):
#   Trigger : Diario, lunes a viernes, 06:30 AM
#   Accion  : powershell.exe -WindowStyle Hidden -File "C:\ruta\SincronizarFacturas.ps1"
# =============================================================================

# -- Configuracion ------------------------------------------------------------
$BASE_URL  = "https://facturacion-electronica.ngrok.io"
$USUARIO   = "admin"
$PASSWORD  = "Finagro2026!"
$DESTINO   = "C:\Users\cdcampos\Documents\FacturasElectronicas"
# -----------------------------------------------------------------------------

$ErrorActionPreference = "Stop"

$cred    = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${USUARIO}:${PASSWORD}"))
$headers = @{ Authorization = "Basic $cred" }

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Sincronizacion Facturas Electronicas    " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Destino : $DESTINO"
Write-Host "Servidor: $BASE_URL"
Write-Host ""

New-Item -ItemType Directory -Force -Path $DESTINO | Out-Null

# -- 1. Obtener lista de semanas disponibles ----------------------------------
Write-Host "Consultando semanas disponibles..." -NoNewline
try {
    $resp    = Invoke-RestMethod -Uri "$BASE_URL/api/facturacion/semanas/" -Headers $headers -Method Get
    $semanas = $resp.semanas
    Write-Host " OK ($($semanas.Count) semanas)" -ForegroundColor Green
} catch {
    Write-Host " ERROR: $_" -ForegroundColor Red
    exit 1
}

# -- 2. Por cada semana, descargar solo si no existe ya -----------------------
$total_nuevas   = 0
$total_omitidas = 0

foreach ($sem in $semanas) {
    $key    = $sem.key
    $year   = $sem.year
    $mes    = $sem.mes
    $semana = $sem.semana
    $pdfs   = $sem.total_zips

    $carpeta = Join-Path $DESTINO "$year\$mes\$semana"

    if (Test-Path $carpeta) {
        $archivos = Get-ChildItem -Path $carpeta -Filter "*.pdf" -ErrorAction SilentlyContinue
        if ($archivos.Count -gt 0) {
            Write-Host "  [OK] $key  ($($archivos.Count) PDFs ya descargados)" -ForegroundColor DarkGray
            $total_omitidas++
            continue
        }
    }

    Write-Host "  [>>] $key  ($pdfs facturas)..." -NoNewline -ForegroundColor Yellow
    $url    = "$BASE_URL/api/facturacion/descargar-pdfs/?semana=$([Uri]::EscapeDataString($key))"
    $tmpZip = [System.IO.Path]::GetTempFileName() + ".zip"

    try {
        Invoke-WebRequest -Uri $url -Headers $headers -OutFile $tmpZip -UseBasicParsing
    } catch {
        Write-Host " ERROR descargando: $_" -ForegroundColor Red
        continue
    }

    try {
        New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
        Expand-Archive -Path $tmpZip -DestinationPath $carpeta -Force
        $extraidos = (Get-ChildItem -Path $carpeta -Filter "*.pdf").Count
        Write-Host " OK ($extraidos PDFs)" -ForegroundColor Green
        $total_nuevas++
    } catch {
        Write-Host " FALLO extrayendo: $_" -ForegroundColor Red
    } finally {
        Remove-Item $tmpZip -ErrorAction SilentlyContinue
    }
}

# -- 3. Resumen ---------------------------------------------------------------
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Sincronizacion completada" -ForegroundColor Cyan
Write-Host "  Semanas nuevas descargadas : $total_nuevas" -ForegroundColor Green
Write-Host "  Semanas ya existentes      : $total_omitidas" -ForegroundColor DarkGray
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Archivos en: $DESTINO"
