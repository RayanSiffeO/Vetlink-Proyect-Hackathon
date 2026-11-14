# scripts\serve-cp2.ps1 — sirve la build congelada de CP2 con la API actual
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\serve-cp2.ps1 [-Port 8000]
param([int]$Port = 8000)
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$release = Join-Path $root "releases\cp2\web"
$target = Join-Path $root "apps\web\dist"
$index = Join-Path $release "index.html"

if (-not (Test-Path $index)) {
    Write-Error "No existe la build congelada en releases\cp2\web. Ejecuta antes el snapshot."
    exit 1
}

New-Item -ItemType Directory -Force -Path $target | Out-Null
Remove-Item (Join-Path $target "*") -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $release "*") $target -Recurse -Force

while (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { $Port++ }
Write-Host "CP2 build congelada servida en http://127.0.0.1:$Port (SPA congelada + API actual)" -ForegroundColor Cyan
Write-Host "Login demo: Laura (clínica) / Marc (especialista). Reset en la Nav." -ForegroundColor DarkGray

$api = Join-Path $root "services\api"
$py = Join-Path $api ".venv\Scripts\python.exe"
Set-Location $api
& $py -m uvicorn app.main:app --port $Port
