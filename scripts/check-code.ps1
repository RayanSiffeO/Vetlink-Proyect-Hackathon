# scripts\check-code.ps1 — barrido de clean code: comentarios, docstrings y TODOs
# Regla del equipo (PLAYBOOK §7.1): cero comentarios explicativos y código autoexplicativo.
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\check-code.ps1
$root = Resolve-Path (Join-Path $PSScriptRoot "..")

$targets = @(
    @{ Path = Join-Path $root "apps\web\src"; Extensions = @("*.ts", "*.tsx"); Kind = "web" },
    @{ Path = Join-Path $root "services\api\app"; Extensions = @("*.py"); Kind = "py" },
    @{ Path = Join-Path $root "services\api\tests"; Extensions = @("*.py"); Kind = "py" }
)

$webPatterns = @('^\s*//', '^\s*/\*', '^\s*\*', '\{/\*')
$pyPatterns = @('^\s*#', '^\s*"""', "^\s*'''")
$todoPattern = '\b(TODO|FIXME|XXX)\b'
$violations = @()
$count = 0

foreach ($target in $targets) {
    $files = Get-ChildItem $target.Path -Recurse -Include $target.Extensions -ErrorAction SilentlyContinue
    $patterns = if ($target.Kind -eq "web") { $webPatterns } else { $pyPatterns }
    foreach ($file in $files) {
        $count++
        $lines = Get-Content $file.FullName -ErrorAction SilentlyContinue
        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i]
            $isComment = $false
            foreach ($pattern in $patterns) {
                if ($line -match $pattern) { $isComment = $true; break }
            }
            if ($isComment) {
                $violations += "$($file.FullName):$($i + 1) comentario"
                continue
            }
            if ($line -cmatch $todoPattern) {
                $violations += "$($file.FullName):$($i + 1) TODO/FIXME"
            }
        }
    }
}

if ($violations.Count -eq 0) {
    Write-Host "check-code OK: 0 comentarios, 0 TODO/FIXME en $count ficheros" -ForegroundColor Green
    exit 0
}
$violations | Select-Object -First 40 | ForEach-Object { Write-Host $_ -ForegroundColor Yellow }
Write-Host "check-code FAIL: $($violations.Count) violaciones" -ForegroundColor Red
exit 1
