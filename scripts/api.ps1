# scripts\api.ps1 — arranca la API + SQLite + seed en http://127.0.0.1:8000
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\api.ps1
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$api = Join-Path $root "services\api"
$py = Join-Path $api ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Error "No existe el venv en services\api\.venv. Crea el entorno primero (ver README)."
    exit 1
}
Set-Location $api
& $py -m uvicorn app.main:app --reload --port 8000
