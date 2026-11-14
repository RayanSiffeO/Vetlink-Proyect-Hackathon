# scripts\build.ps1 — compila la SPA para que FastAPI la sirva en la demo
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\build.ps1
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location (Join-Path $root "apps\web")
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    pnpm build
} else {
    npm run build
}
