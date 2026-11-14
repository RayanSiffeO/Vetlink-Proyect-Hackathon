# scripts\e2e-browser.ps1 — orquesta el E2E de navegador: build congelada + API + Edge headless
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\e2e-browser.ps1 [-Port 8050]
param([int]$Port = 8050)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$release = Join-Path $root "releases\cp2\web"
$target = Join-Path $root "apps\web\dist"
$node = "C:\Programa Programar\nodejs\node.exe"

if (-not (Test-Path $node)) { $node = (Get-Command node).Source }
if (-not (Test-Path (Join-Path $release "index.html"))) {
    Write-Error "No existe la build congelada en releases\cp2\web"
    exit 1
}

New-Item -ItemType Directory -Force -Path $target | Out-Null
Remove-Item (Join-Path $target "*") -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $release "*") $target -Recurse -Force

while (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { $Port++ }
$venv = Join-Path $root "services\api\.venv\Scripts\python.exe"
$proc = Start-Process -FilePath $venv -ArgumentList @("-m", "uvicorn", "app.main:app", "--port", "$Port") -WorkingDirectory (Join-Path $root "services\api") -PassThru -WindowStyle Hidden
$base = "http://127.0.0.1:$Port"

try {
    $ready = $false
    for ($i = 0; $i -lt 40; $i++) {
        try { Invoke-RestMethod "$base/api/health" -TimeoutSec 2 | Out-Null; $ready = $true; break }
        catch { Start-Sleep -Milliseconds 400 }
    }
    if (-not $ready) { throw "La API no arrancó en :$Port" }

    Write-Host ("Browser E2E contra {0} con la build congelada de CP2" -f $base) -ForegroundColor Cyan
    Set-Location $root
    & $node "scripts\e2e-browser.mjs" $base "releases\cp2\e2e"
    $exitCode = $LASTEXITCODE
}
finally {
    if ($proc) { taskkill /PID $proc.Id /T /F 2>&1 | Out-Null }
    Set-Location $root
}

exit $exitCode
