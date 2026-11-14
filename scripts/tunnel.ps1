# scripts\tunnel.ps1 — expone la demo local con una URL pública (plan B / demo rápida)
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\tunnel.ps1
# Requiere la API arrancada en http://127.0.0.1:8000 (scripts\api.ps1 o scripts\demo.ps1).
$ErrorActionPreference = "Stop"
$tools = Join-Path $env:LOCALAPPDATA "vetlink"
New-Item -ItemType Directory -Force -Path $tools | Out-Null
$exe = Join-Path $tools "cloudflared.exe"

if (-not (Test-Path $exe)) {
    Write-Host "Descargando cloudflared..." -ForegroundColor Cyan
    Invoke-WebRequest "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $exe
}

Write-Host "Comprobando que la demo responde en :8000..." -ForegroundColor Cyan
Invoke-RestMethod "http://127.0.0.1:8000/api/health" -TimeoutSec 10 | Out-Null
Write-Host "Abriendo túnel público (copia la URL https://*.trycloudflare.com que aparezca)..." -ForegroundColor Yellow
& $exe tunnel --url http://127.0.0.1:8000
