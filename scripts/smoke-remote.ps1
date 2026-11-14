# scripts\smoke-remote.ps1 — smoke test contra una URL desplegada (Render, túnel, etc.)
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\smoke-remote.ps1 -BaseUrl https://vetlink.onrender.com [-WaitSeconds 120]
param(
    [Parameter(Mandatory = $true)][string]$BaseUrl,
    [int]$WaitSeconds = 120
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$base = $BaseUrl.TrimEnd("/")
$tmp = Join-Path $env:TEMP ("vetlink-smoke-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$checks = New-Object System.Collections.Generic.List[object]
$jarLa = Join-Path $tmp "la.jar"
$jarMa = Join-Path $tmp "ma.jar"

function Add-Check([string]$Name, [string]$Expected, [string]$Actual) {
    $ok = ($Expected -eq $Actual)
    $checks.Add([pscustomobject]@{ name = $Name; ok = $ok; expected = $Expected; actual = $Actual })
    $tag = if ($ok) { "PASS" } else { "FAIL" }
    Write-Host ("{0}  {1} (esperado {2}, real {3})" -f $tag, $Name, $Expected, $Actual)
}

Write-Host ("Esperando a {0} (hasta {1}s por cold start)..." -f $base, $WaitSeconds) -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt [math]::Ceiling($WaitSeconds / 3); $i++) {
    try {
        $health = Invoke-RestMethod "$base/api/health" -TimeoutSec 10
        $ready = $true
        break
    } catch {
        Start-Sleep -Seconds 3
    }
}
Add-Check "health" "ok" "$($health.status)"

try {
    '{"user":"laura"}' | Set-Content (Join-Path $tmp "la.json") -NoNewline -Encoding utf8
    '{"user":"marc"}' | Set-Content (Join-Path $tmp "ma.json") -NoNewline -Encoding utf8

    $login = curl.exe -s -c $jarLa -o (Join-Path $tmp "login.json") -w "%{http_code}" -X POST -H "Content-Type: application/json" --data-binary "@$(Join-Path $tmp 'la.json')" "$base/api/auth/demo"
    Add-Check "login Laura" "200" "$login"
    $me = curl.exe -s -b $jarLa "$base/api/me" | ConvertFrom-Json
    Add-Check "rol" "CLINIC" "$($me.user.role)"

    $patients = curl.exe -s -b $jarLa "$base/api/patients" | ConvertFrom-Json
    Add-Check "pacientes" "3" "$($patients.patients.Count)"

    $samples = Join-Path $root "data\samples"
    $docx = (Get-ChildItem $samples -Filter "*.docx" | Where-Object { $_.Name -like "*Vall*" } | Select-Object -First 1).FullName
    $xlsx = (Get-ChildItem $samples -Filter "*.xlsx" | Select-Object -First 1).FullName
    $json = (Get-ChildItem $samples -Filter "historial.json" | Select-Object -First 1).FullName
    $imports = curl.exe -s -b $jarLa -X POST -F "files=@$docx" -F "files=@$xlsx" -F "files=@$json" "$base/api/imports" | ConvertFrom-Json
    $readyCount = @($imports.files | Where-Object { $_.status -eq "READY" }).Count
    Add-Check "import 3 formatos" "3" "$readyCount"

    $record = curl.exe -s -b $jarLa "$base/api/patients/pat_kira/record" | ConvertFrom-Json
    Add-Check "ficha Kira (alertas)" "7" "$($record.alerts.Count)"

    $requestBody = @{ patient_id = 'pat_kira'; specialist_id = 'spc_marc'; motivo = 'Smoke remoto'; urgencia = 'ALTA'; share_level = 'CLINICAL'; preferred = 'Mananas' } | ConvertTo-Json
    Set-Content (Join-Path $tmp "request.json") $requestBody -Encoding utf8
    $request = curl.exe -s -b $jarLa -X POST -H "Content-Type: application/json" --data-binary "@$(Join-Path $tmp 'request.json')" "$base/api/requests" | ConvertFrom-Json
    $requestId = $request.request.id
    Add-Check "solicitud" "REQUESTED" "$($request.request.status)"

    $locked = curl.exe -s -b $jarLa -o (Join-Path $tmp "locked.json") -w "%{http_code}" "$base/api/requests/$requestId/briefing"
    Add-Check "briefing bloqueado" "403" "$locked"

    $marcLogin = curl.exe -s -c $jarMa -o (Join-Path $tmp "login-ma.json") -w "%{http_code}" -X POST -H "Content-Type: application/json" --data-binary "@$(Join-Path $tmp 'ma.json')" "$base/api/auth/demo"
    Add-Check "login Marc" "200" "$marcLogin"
    $slots = curl.exe -s -b $jarLa "$base/api/specialists/spc_marc" | ConvertFrom-Json
    $slot = @($slots.available_slots)[0]
    @{ slot_iso = $slot } | ConvertTo-Json | Set-Content (Join-Path $tmp "accept.json") -Encoding utf8
    $accepted = curl.exe -s -b $jarMa -X POST -H "Content-Type: application/json" --data-binary "@$(Join-Path $tmp 'accept.json')" "$base/api/requests/$requestId/accept" | ConvertFrom-Json
    Add-Check "aceptar" "SCHEDULED" "$($accepted.request.status)"
    $briefing = curl.exe -s -b $jarMa -o (Join-Path $tmp "briefing.json") -w "%{http_code}" "$base/api/requests/$requestId/briefing"
    Add-Check "briefing desbloqueado" "200" "$briefing"
} finally {
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    $failed = @($checks | Where-Object { -not $_.ok }).Count
    $passed = $checks.Count - $failed
    Write-Host ""
    Write-Host ("RESULTADO SMOKE REMOTO: {0}/{1} PASS, {2} FAIL" -f $passed, $checks.Count, $failed) -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
    exit ([int]($failed -gt 0))
}
