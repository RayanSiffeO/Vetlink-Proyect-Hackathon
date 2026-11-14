# scripts\e2e-api.ps1 — E2E de API completo (flujo clínica -> especialista)
# Uso:  powershell -ExecutionPolicy Bypass -File scripts\e2e-api.ps1 [-Port 8040]
# Genera reporte JSON en artifacts\\e2e\\api-report.json y devuelve exit 0 si todo pasa.
param([int]$Port = 8040, [string]$Report = "artifacts\\e2e\\api-report.json")

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$venv = Join-Path $root "services\api\.venv\Scripts\python.exe"
$reportPath = Join-Path $root $Report
$tmp = Join-Path $env:TEMP ("vetlink-e2e-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$checks = New-Object System.Collections.Generic.List[object]
$startedAt = Get-Date
$proc = $null

function Add-Check([string]$Name, [string]$Expected, [string]$Actual) {
    $ok = ($Expected -eq $Actual)
    $checks.Add([pscustomobject]@{ name = $Name; expected = $Expected; actual = $Actual; ok = $ok })
    if ($ok) { Write-Host ("PASS  {0}" -f $Name) -ForegroundColor Green }
    else { Write-Host ("FAIL  {0} (esperado {1}, real {2})" -f $Name, $Expected, $Actual) -ForegroundColor Red }
}

function Add-CheckAtLeast([string]$Name, [int]$Minimum, [int]$Actual) {
    $ok = ($Actual -ge $Minimum)
    $checks.Add([pscustomobject]@{ name = $Name; expected = ">=$Minimum"; actual = "$Actual"; ok = $ok })
    if ($ok) { Write-Host ("PASS  {0} ({1})" -f $Name, $Actual) -ForegroundColor Green }
    else { Write-Host ("FAIL  {0} (esperado >={1}, real {2})" -f $Name, $Minimum, $Actual) -ForegroundColor Red }
}

try {
    while (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { $Port++ }
    $proc = Start-Process -FilePath $venv -ArgumentList @("-m", "uvicorn", "app.main:app", "--port", "$Port") -WorkingDirectory (Join-Path $root "services\api") -PassThru -WindowStyle Hidden
    $base = "http://127.0.0.1:$Port"

    $health = $null
    for ($i = 0; $i -lt 40; $i++) {
        try { $health = Invoke-RestMethod "$base/api/health" -TimeoutSec 2; break } catch { Start-Sleep -Milliseconds 400 }
    }
    if (-not $health) { throw "La API no arrancó en :$Port" }

    Add-Check "health" "ok" $health.status

    '{"user":"laura"}' | Set-Content (Join-Path $tmp "laura.json") -NoNewline -Encoding utf8
    '{"user":"marc"}' | Set-Content (Join-Path $tmp "marc.json") -NoNewline -Encoding utf8
    $jarLa = Join-Path $tmp "la.jar"
    $jarMa = Join-Path $tmp "ma.jar"

    $loginCode = curl.exe -s -c $jarLa -o (Join-Path $tmp "login.json") -w "%{http_code}" -X POST -H "Content-Type: application/json" --data-binary "@$(Join-Path $tmp 'laura.json')" "$base/api/auth/demo"
    Add-Check "login Laura" "200" "$loginCode"
    $initialReset = curl.exe -s -b $jarLa -X POST "$base/api/demo/reset"
    Add-Check "reset inicial" "0" "$((($initialReset | ConvertFrom-Json).counts.requests))"
    $health = Invoke-RestMethod "$base/api/health"
    Add-Check "seed pacientes" "3" "$($health.counts.patients)"
    Add-Check "seed alertas" "22" "$($health.counts.alerts)"
    $me = curl.exe -s -b $jarLa "$base/api/me" | ConvertFrom-Json
    Add-Check "rol Laura" "CLINIC" "$($me.user.role)"

    $patients = curl.exe -s -b $jarLa "$base/api/patients" | ConvertFrom-Json
    Add-Check "pacientes de la clinica" "3" "$($patients.patients.Count)"
    $names = (($patients.patients | ForEach-Object { $_.name }) | Sort-Object) -join ","
    Add-Check "pacientes esperados" "Bruno,Kira,Luna" "$names"

    $sampleDir = Join-Path $root "data\samples"
    $docx = (Get-ChildItem $sampleDir -Filter "*.docx" | Where-Object { $_.Name -like "*Vall*" } | Select-Object -First 1).FullName
    $xlsx = (Get-ChildItem $sampleDir -Filter "*.xlsx" | Select-Object -First 1).FullName
    $json = (Get-ChildItem $sampleDir -Filter "historial.json" | Select-Object -First 1).FullName
    $csv = (Get-ChildItem $sampleDir -Filter "*.csv" | Select-Object -First 1).FullName
    if (-not ($docx -and $xlsx -and $json -and $csv)) { throw "Faltan ficheros de muestra en data\samples" }

    $importsRaw = curl.exe -s -b $jarLa -X POST `
        -F "files=@$docx" `
        -F "files=@$xlsx" `
        -F "files=@$json" `
        -F "files=@$csv" `
        "$base/api/imports"
    $imports = $importsRaw | ConvertFrom-Json
    $ready = @($imports.files | Where-Object { $_.status -eq "READY" }).Count
    $review = @($imports.files | Where-Object { $_.status -eq "NEEDS_REVIEW" }).Count
    Add-Check "import Word/Excel/JSON" "3" "$ready"
    Add-Check "CSV a revision" "1" "$review"

    $record = curl.exe -s -b $jarLa "$base/api/patients/pat_kira/record" | ConvertFrom-Json
    Add-Check "alertas Kira" "7" "$($record.alerts.Count)"
    Add-Check "entidades canonicas Kira" "53" "$($record.provenance_summary.entities)"

    $specialists = curl.exe -s -b $jarLa "$base/api/specialists" | ConvertFrom-Json
    Add-Check "marketplace especialistas" "3" "$($specialists.specialists.Count)"
    $profile = curl.exe -s -b $jarLa "$base/api/specialists/spc_marc" | ConvertFrom-Json
    Add-CheckAtLeast "franjas de Marc" 1 @($profile.available_slots).Count

    $requestBody = @{ patient_id = 'pat_kira'; specialist_id = 'spc_marc'; motivo = 'Control ocular y valoracion de pauta'; urgencia = 'ALTA'; share_level = 'CLINICAL'; preferred = 'Mananas de lunes a jueves' } | ConvertTo-Json
    Set-Content (Join-Path $tmp "request.json") $requestBody -Encoding utf8
    $request = curl.exe -s -b $jarLa -X POST -H "Content-Type: application/json" --data-binary "@$(Join-Path $tmp 'request.json')" "$base/api/requests" | ConvertFrom-Json
    $requestId = $request.request.id
    Add-Check "solicitud creada" "REQUESTED" "$($request.request.status)"

    $summaryRaw = curl.exe -s -b $jarLa "$base/api/requests/$requestId/summary"
    $summary = $summaryRaw | ConvertFrom-Json
    Add-Check "resumen pre-aceptacion" "NON_IDENTIFYING" "$($summary.privacy.level)"
    $leaks = $summaryRaw -match "Carmen|12345678Z|600 123 456|carmen.roldan"
    Add-Check "resumen sin PII del tutor" "False" "$leaks"

    $lockedCode = curl.exe -s -b $jarLa -o (Join-Path $tmp "locked.json") -w "%{http_code}" "$base/api/requests/$requestId/briefing"
    Add-Check "briefing bloqueado antes de aceptar" "403" "$lockedCode"

    $marcLogin = curl.exe -s -c $jarMa -o (Join-Path $tmp "login-marc.json") -w "%{http_code}" -X POST -H "Content-Type: application/json" --data-binary "@$(Join-Path $tmp 'marc.json')" "$base/api/auth/demo"
    Add-Check "login Marc" "200" "$marcLogin"

    $slot = @($profile.available_slots)[0]
    $acceptBody = @{ slot_iso = $slot } | ConvertTo-Json
    Set-Content (Join-Path $tmp "accept.json") $acceptBody -Encoding utf8
    $accepted = curl.exe -s -b $jarMa -X POST -H "Content-Type: application/json" --data-binary "@$(Join-Path $tmp 'accept.json')" "$base/api/requests/$requestId/accept" | ConvertFrom-Json
    Add-Check "aceptacion de la derivacion" "SCHEDULED" "$($accepted.request.status)"

    $briefingCode = curl.exe -s -b $jarMa -o (Join-Path $tmp "briefing.json") -w "%{http_code}" "$base/api/requests/$requestId/briefing"
    Add-Check "briefing desbloqueado" "200" "$briefingCode"
    $briefing = Get-Content (Join-Path $tmp "briefing.json") -Raw | ConvertFrom-Json
    Add-CheckAtLeast "briefing alertas renderizadas" 1 @($briefing.briefing.alerts_rendered).Count
    Add-CheckAtLeast "auditoria de accesos" 3 @($briefing.audit).Count

    $reviewBody = @{ reviewed_fields = @(); note = "Revision de smoke E2E" } | ConvertTo-Json
    Set-Content (Join-Path $tmp "review.json") $reviewBody -Encoding utf8
    $reviewCode = curl.exe -s -b $jarLa -o (Join-Path $tmp "review-resp.json") -w "%{http_code}" -X PATCH -H "Content-Type: application/json" --data-binary "@$(Join-Path $tmp 'review.json')" "$base/api/patients/pat_kira/record/review"
    Add-Check "revision humana" "200" "$reviewCode"
    $review = Get-Content (Join-Path $tmp "review-resp.json") -Raw | ConvertFrom-Json
    Add-Check "campos pendientes a cero" "0" "$($review.review.pending_review)"
    Add-Check "revisado por la clinica" "True" "$([bool]$review.review.reviewed_by)"

    $closeBody = @{ note = "Cierre E2E: evolucion favorable, se mantiene tratamiento"; diagnosis = "Control resuelto"; recommendations = "Revision en 30 dias" } | ConvertTo-Json
    Set-Content (Join-Path $tmp "close.json") $closeBody -Encoding utf8
    $closeCode = curl.exe -s -b $jarMa -o (Join-Path $tmp "close-resp.json") -w "%{http_code}" -X POST -H "Content-Type: application/json" --data-binary "@$(Join-Path $tmp 'close.json')" "$base/api/requests/$requestId/close"
    Add-Check "cierre de visita" "200" "$closeCode"
    $closed = Get-Content (Join-Path $tmp "close-resp.json") -Raw | ConvertFrom-Json
    Add-Check "solicitud completada" "COMPLETED" "$($closed.request.status)"
    $recordAfter = curl.exe -s -b $jarLa "$base/api/patients/pat_kira/record" | ConvertFrom-Json
    $specialistNotes = @($recordAfter.record.encounters | Where-Object { $_.'_meta'.source_ref -eq "request:$requestId" }).Count
    Add-Check "nota del especialista en la ficha" "1" "$specialistNotes"

    $appointments = curl.exe -s -b $jarLa "$base/api/appointments" | ConvertFrom-Json
    Add-CheckAtLeast "cita en calendario" 1 @($appointments.appointments).Count

    $spaCode = curl.exe -s -o (Join-Path $tmp "spa.html") -w "%{http_code}" "$base/"
    Add-Check "SPA servida por FastAPI" "200" "$spaCode"
    $spaHtml = Get-Content (Join-Path $tmp "spa.html") -Raw
    Add-Check "SPA con titulo VetLink" "True" "$($spaHtml -match 'VetLink')"
    $fallbackCode = curl.exe -s -o (Join-Path $tmp "fallback.html") -w "%{http_code}" "$base/patients"
    Add-Check "SPA fallback de rutas" "200" "$fallbackCode"

    $reset = curl.exe -s -b $jarLa -X POST "$base/api/demo/reset" | ConvertFrom-Json
    Add-Check "reset de demo" "0" "$($reset.counts.requests)"
}
catch {
    Write-Host ("ERROR: {0}" -f $_.Exception.Message) -ForegroundColor Red
    $checks.Add([pscustomobject]@{ name = "ejecucion"; expected = "sin errores"; actual = $_.Exception.Message; ok = $false })
}
finally {
    if ($proc) { taskkill /PID $proc.Id /T /F 2>&1 | Out-Null }
    Start-Sleep -Milliseconds 500
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue

    $failed = @($checks | Where-Object { -not $_.ok }).Count
    $passed = $checks.Count - $failed
    $reportDir = Split-Path $reportPath
    New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
    $gitSha = (git -C $root rev-parse --short HEAD) 2>$null
    $payload = [pscustomobject]@{
        suite       = "VetLink API E2E"
        generated_at = (Get-Date).ToString("o")
        git_commit  = "$gitSha"
        port        = $Port
        duration_ms = [int]((Get-Date) - $startedAt).TotalMilliseconds
        total       = $checks.Count
        passed      = $passed
        failed      = $failed
        checks      = $checks
    }
    $payload | ConvertTo-Json -Depth 6 | Set-Content $reportPath -Encoding utf8
    Write-Host ""
    Write-Host ("RESULTADO API E2E: {0}/{1} PASS, {2} FAIL" -f $passed, $checks.Count, $failed) -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
    Write-Host ("reporte: {0}" -f $reportPath)
    exit ([int]($failed -gt 0))
}


