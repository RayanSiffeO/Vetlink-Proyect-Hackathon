# scripts\stop.ps1 — libera los puertos de la demo (8000/8001/5173)
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\stop.ps1
param([int[]]$Ports = @(8000, 8001, 5173))
foreach ($port in $Ports) {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) { Write-Host ":$port libre" -ForegroundColor DarkGray; continue }
    foreach ($c in $conns) {
        $pid = $c.OwningProcess
        try {
            Stop-Process -Id $pid -Force -ErrorAction Stop
            Write-Host "detenido PID $pid en :$port" -ForegroundColor Green
        } catch {
            Write-Host "no se pudo parar PID $pid en :$port (prueba a ejecutar como administrador o cierra su terminal)" -ForegroundColor Yellow
            taskkill /F /PID $pid 2>$null
        }
    }
}
