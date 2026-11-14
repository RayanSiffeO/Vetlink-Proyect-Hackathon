# scripts\dev.ps1 — arranca el frontend en desarrollo (http://127.0.0.1:5173)
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\dev.ps1
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location (Join-Path $root "apps\web")
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    Write-Host "Usando pnpm..." -ForegroundColor Cyan
    pnpm dev
} else {
    Write-Host "pnpm no está en PATH; usando npm (funciona igual con node_modules ya instalado)..." -ForegroundColor Yellow
    npm run dev
}
