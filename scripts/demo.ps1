# scripts\demo.ps1 — modo demo: compila la SPA y la sirve FastAPI en un solo proceso
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\demo.ps1  →  http://127.0.0.1:8000
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

Write-Host "1/2 Compilando frontend..." -ForegroundColor Cyan
Set-Location (Join-Path $root "apps\web")
if (Get-Command pnpm -ErrorAction SilentlyContinue) { pnpm build } else { npm run build }
if ($LASTEXITCODE -ne 0) { Write-Error "Falló el build del frontend"; exit 1 }

Write-Host "2/2 Arrancando API + SPA en http://127.0.0.1:8000 ..." -ForegroundColor Cyan
$api = Join-Path $root "services\api"
$py = Join-Path $api ".venv\Scripts\python.exe"
Set-Location $api
& $py -m uvicorn app.main:app --port 8000
