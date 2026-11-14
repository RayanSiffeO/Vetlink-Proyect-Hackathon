# scripts\api.ps1 — arranca la API + SQLite + seed (auto-puerto si el 8000 está ocupado)
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\api.ps1 [-Port 8000]
param([int]$Port = 8000)
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$api = Join-Path $root "services\api"
$py = Join-Path $api ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Error "No existe el venv en services\api\.venv. Crea el entorno primero (ver README)."
    exit 1
}
while (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { $Port++ }
Write-Host "API VetLink en http://127.0.0.1:$Port  (health: /api/health · Swagger: /docs)" -ForegroundColor Cyan
Set-Location $api
& $py -m uvicorn app.main:app --reload --port $Port
