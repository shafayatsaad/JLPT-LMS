$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$composeEnvDirectory = Join-Path $projectRoot ".local-demo"
$composeEnvFile = Join-Path $composeEnvDirectory "compose.env"
$startLocalScript = Join-Path $PSScriptRoot "start-local-docker-app.ps1"
$sharedAdminSql = Join-Path $PSScriptRoot "local-demo-remote-admin.sql"
$databaseContainer = "supabase_db_JLPT_LMS"
$restoreStaffMfaSql = Join-Path $PSScriptRoot "local-demo-restore-staff-mfa.sql"

Push-Location $projectRoot
try {
  Write-Host "Starting the local production app and existing local database."
  & $startLocalScript
  if ($LASTEXITCODE -ne 0) { throw "The local Docker app did not start." }

  Write-Host "Preparing the shared, fake-email test administrator without resetting local data..."
  & docker cp $sharedAdminSql "${databaseContainer}:/tmp/jlpt-local-demo-remote-admin.sql"
  if ($LASTEXITCODE -ne 0) { throw "Could not copy the additive test-account SQL into the local database container." }
  & docker exec $databaseContainer psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/jlpt-local-demo-remote-admin.sql
  $sqlExitCode = $LASTEXITCODE
  & docker exec $databaseContainer rm -f /tmp/jlpt-local-demo-remote-admin.sql *> $null
  if ($sqlExitCode -ne 0) { throw "The shared test administrator could not be prepared." }

  $compose = @("--env-file", $composeEnvFile, "-f", "compose.yaml", "--profile", "remote")
  Write-Host "Starting a temporary HTTPS tunnel to the Docker app..."
  # Quick Tunnel URLs are random, and Compose keeps logs from older runs.
  # Recreate this one-service container so its logs contain only the new URL.
  & docker compose @compose rm --stop --force cloudflared
  if ($LASTEXITCODE -ne 0) { throw "The previous temporary tunnel could not be removed." }
  & docker compose @compose up --detach cloudflared
  if ($LASTEXITCODE -ne 0) { throw "The temporary tunnel container did not start." }

  $siteUrl = $null
  for ($attempt = 0; $attempt -lt 45; $attempt++) {
    $ErrorActionPreference = "Continue"
    $logLines = & docker compose @compose logs --no-color --tail 80 cloudflared 2>$null
    $logsExitCode = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($logsExitCode -eq 0) {
      $logText = $logLines -join "`n"
      $urlMatches = [regex]::Matches($logText, 'https://[a-z0-9-]+\.trycloudflare\.com', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
      if ($urlMatches.Count -gt 0) {
        $candidateUrl = $urlMatches[$urlMatches.Count - 1].Value
        $urlIndex = $logText.LastIndexOf($candidateUrl, [System.StringComparison]::OrdinalIgnoreCase)
        if ($logText.IndexOf("Registered tunnel connection", $urlIndex, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
          $siteUrl = $candidateUrl
          break
        }
      }
    }
    Start-Sleep -Seconds 2
  }
  if (-not $siteUrl) {
    & docker compose @compose logs --no-color --tail 60 cloudflared
    throw "Cloudflare did not provide a temporary URL. Check the tunnel container logs and internet connection."
  }

  $values = @{}
  foreach ($line in Get-Content -LiteralPath $composeEnvFile) {
    if ($line -match '^(?<key>[A-Z0-9_]+)=(?<value>.*)$') {
      $values[$Matches.key] = $Matches.value
    }
  }
  $values["JLPT_DEMO_BIND_ADDRESS"] = "127.0.0.1"
  $values["NEXT_PUBLIC_SITE_URL"] = $siteUrl
  $values["NEXT_PUBLIC_SUPABASE_URL"] = "$siteUrl/supabase"
  $values["NEXT_PUBLIC_DEMO_LAN_ENABLED"] = "false"
  $values["LOCAL_DEMO_SUPABASE_PROXY"] = "true"
  $values["SUPABASE_PROXY_TARGET"] = "http://host.docker.internal:54321"
  $values["LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED"] = "true"
  $envLines = @(
    "JLPT_DEMO_BIND_ADDRESS=$($values['JLPT_DEMO_BIND_ADDRESS'])",
    "NEXT_PUBLIC_SITE_URL=$($values['NEXT_PUBLIC_SITE_URL'])",
    "NEXT_PUBLIC_SUPABASE_URL=$($values['NEXT_PUBLIC_SUPABASE_URL'])",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$($values['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'])",
    "NEXT_PUBLIC_AUTH_ENABLE_PHONE=$($values['NEXT_PUBLIC_AUTH_ENABLE_PHONE'])",
    "NEXT_PUBLIC_DEMO_LAN_ENABLED=$($values['NEXT_PUBLIC_DEMO_LAN_ENABLED'])",
    "LOCAL_DEMO_SUPABASE_PROXY=$($values['LOCAL_DEMO_SUPABASE_PROXY'])",
    "SUPABASE_PROXY_TARGET=$($values['SUPABASE_PROXY_TARGET'])",
    "LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED=$($values['LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED'])",
    "SUPABASE_SERVICE_ROLE_KEY=$($values['SUPABASE_SERVICE_ROLE_KEY'])"
  )
  [System.IO.File]::WriteAllLines($composeEnvFile, $envLines, [System.Text.UTF8Encoding]::new($false))

  Write-Host "Rebuilding the app to route browser sign-in and database requests through the same HTTPS URL..."
  & docker compose @compose up --build --detach app
  if ($LASTEXITCODE -ne 0) { throw "The app could not be rebuilt with remote Supabase routing." }

  $healthy = $false
  for ($attempt = 0; $attempt -lt 48; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3002" -TimeoutSec 4
      if ($response.StatusCode -eq 200) { $healthy = $true; break }
    } catch {
      Start-Sleep -Seconds 3
    }
  }
  if (-not $healthy) { throw "The Docker app did not become healthy after remote routing was enabled." }

  $proxyHealthy = $false
  try {
    $proxyResponse = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3002/supabase/auth/v1/health" -TimeoutSec 10
    $proxyHealthy = $proxyResponse.StatusCode -eq 200
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -eq 401) { $proxyHealthy = $true }
  }
  if (-not $proxyHealthy) { throw "The local Supabase API did not respond through the app's same-origin proxy." }

  $remoteHealthy = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
      $remoteResponse = Invoke-WebRequest -UseBasicParsing -Uri $siteUrl -TimeoutSec 8
      if ($remoteResponse.StatusCode -eq 200) { $remoteHealthy = $true; break }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  if (-not $remoteHealthy) { throw "The temporary HTTPS URL did not return the app after startup. Check the cloudflared logs before sharing it." }

  Write-Host "Remote tester link: $siteUrl"
  Write-Host "Demo accounts and workflow links: $siteUrl/dev/test-accounts"
  Write-Host "Sign in with the shared demo credentials listed on that page. Only the shared remote-demo admin skips staff MFA; the standard staff account remains protected."
  Write-Host "Anyone with the temporary URL can open the demo login and use the shared test accounts."
  Write-Host "Keep this computer, Docker Desktop, and its internet connection running while testers are online."
  Write-Host "The local database was preserved; payments are simulated and no real payment provider is used."
  Write-Host "Google OAuth requires a fixed callback hostname; use the email/password demo account with this temporary URL."
} catch {
  $savedPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  if (Test-Path -LiteralPath $composeEnvFile) {
    & docker compose --env-file $composeEnvFile -f compose.yaml --profile remote stop cloudflared 2>&1 | Out-Null
  }
  if (Test-Path -LiteralPath $restoreStaffMfaSql) {
    & docker cp $restoreStaffMfaSql "${databaseContainer}:/tmp/jlpt-local-demo-restore-staff-mfa.sql" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      & docker exec $databaseContainer psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/jlpt-local-demo-restore-staff-mfa.sql 2>&1 | Out-Null
      & docker exec $databaseContainer rm -f /tmp/jlpt-local-demo-restore-staff-mfa.sql 2>&1 | Out-Null
    }
  }
  $ErrorActionPreference = $savedPreference
  throw
} finally {
  Pop-Location
}
