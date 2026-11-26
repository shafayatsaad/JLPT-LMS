param([switch]$Stop, [switch]$Lan)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$supabaseCli = Join-Path $projectRoot "node_modules/.bin/supabase.cmd"
$composeEnvDirectory = Join-Path $projectRoot ".local-demo"
$composeEnvFile = Join-Path $composeEnvDirectory "compose.env"
$tunnelPidFile = Join-Path $composeEnvDirectory "cloudflared-remote.pid"
$tunnelPathFile = Join-Path $composeEnvDirectory "cloudflared-remote.path"
$restoreStaffMfaSql = Join-Path $PSScriptRoot "local-demo-restore-staff-mfa.sql"
$databaseContainer = "supabase_db_JLPT_LMS"

function Stop-LocalDemoTunnel {
  if (Test-Path -LiteralPath $composeEnvFile) {
    $savedPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $stopOutput = & docker compose --env-file $composeEnvFile -f compose.yaml --profile remote stop cloudflared 2>&1
    $stopExitCode = $LASTEXITCODE
    $ErrorActionPreference = $savedPreference
    if ($stopExitCode -ne 0) { Write-Host "No remote tunnel container was running." }
  }
  if ((Test-Path -LiteralPath $tunnelPidFile) -and (Test-Path -LiteralPath $tunnelPathFile)) {
    $tunnelPid = 0
    [void][int]::TryParse((Get-Content -LiteralPath $tunnelPidFile -Raw).Trim(), [ref]$tunnelPid)
    $expectedPath = (Get-Content -LiteralPath $tunnelPathFile -Raw).Trim()
    $process = Get-Process -Id $tunnelPid -ErrorAction SilentlyContinue
    if ($process -and $process.Path -and [string]::Equals($process.Path, $expectedPath, [System.StringComparison]::OrdinalIgnoreCase)) {
      Stop-Process -Id $tunnelPid -Force
      Write-Host "Stopped the temporary remote tester tunnel."
    }
    Remove-Item -LiteralPath $tunnelPidFile, $tunnelPathFile -Force -ErrorAction SilentlyContinue
  }
}

function Restore-LocalDemoStaffMfa {
  if (-not (Test-Path -LiteralPath $restoreStaffMfaSql)) { return }
  $databaseRunning = & docker ps --filter "name=^/$databaseContainer$" --filter "status=running" --format "{{.ID}}"
  if (-not $databaseRunning) { return }

  & docker cp $restoreStaffMfaSql "${databaseContainer}:/tmp/jlpt-local-demo-restore-staff-mfa.sql"
  if ($LASTEXITCODE -ne 0) { throw "Could not stage the local staff MFA restore SQL." }
  & docker exec $databaseContainer psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/jlpt-local-demo-restore-staff-mfa.sql
  $sqlExitCode = $LASTEXITCODE
  & docker exec $databaseContainer rm -f /tmp/jlpt-local-demo-restore-staff-mfa.sql *> $null
  if ($sqlExitCode -ne 0) { throw "Could not restore the normal staff MFA database checks." }
}

Push-Location $projectRoot
try {
  if ($Stop) {
    Stop-LocalDemoTunnel
    Restore-LocalDemoStaffMfa
    if (Test-Path -LiteralPath $composeEnvFile) {
      & docker compose --env-file $composeEnvFile -f compose.yaml down
      if ($LASTEXITCODE -ne 0) { throw "The local application container could not be stopped." }
    } else {
      Write-Host "No local application compose environment exists."
    }
    return
  }

  Stop-LocalDemoTunnel

  if (-not (Test-Path -LiteralPath $supabaseCli)) {
    throw "Supabase CLI is not installed. Run npm install first."
  }

  Write-Host "Starting the existing Docker-local Supabase stack without resetting its database..."
  $savedPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $supabaseCli start *> $null
  $supabaseStartExitCode = $LASTEXITCODE
  $ErrorActionPreference = $savedPreference
  if ($supabaseStartExitCode -ne 0) { throw "Supabase could not start. Check Docker Desktop." }
  Restore-LocalDemoStaffMfa

  $ErrorActionPreference = "Continue"
  $statusLines = & $supabaseCli status --output env 2>$null
  $statusExitCode = $LASTEXITCODE
  $ErrorActionPreference = $savedPreference
  if ($statusExitCode -ne 0) { throw "Could not read local Supabase connection values." }
  $localConfig = @{}
  foreach ($line in $statusLines) {
    if ($line -match '^(?<key>[A-Z0-9_]+)="?(?<value>.*?)"?$') {
      $localConfig[$Matches.key] = $Matches.value.Trim('"')
    }
  }

  $apiUrl = $localConfig["API_URL"]
  $publishableKey = $localConfig["PUBLISHABLE_KEY"]
  if (-not $publishableKey) { $publishableKey = $localConfig["ANON_KEY"] }
  $serviceKey = $localConfig["SERVICE_ROLE_KEY"]
  if (-not $serviceKey) { $serviceKey = $localConfig["SECRET_KEY"] }
  if (-not $apiUrl -or -not $publishableKey -or -not $serviceKey) {
    throw "Supabase CLI did not return the local API URL and required local keys."
  }

  $apiUri = [System.Uri]::new($apiUrl)
  if ($apiUri.Scheme -ne "http" -or $apiUri.Host -notin @("localhost", "127.0.0.1", "::1")) {
    throw "Refusing to configure the local app with a non-local Supabase URL."
  }

  $lanAddress = $null
  if ($Lan) {
    $lanAddress = Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred |
      Where-Object {
        $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)' -and
        $_.InterfaceAlias -notmatch 'Loopback|vEthernet|Docker|WSL'
      } |
      Select-Object -First 1 -ExpandProperty IPAddress
    if (-not $lanAddress) { throw "No private Wi-Fi/Ethernet address was found for LAN testing." }
  }

  New-Item -ItemType Directory -Path $composeEnvDirectory -Force | Out-Null
  $browserHost = if ($Lan) { $lanAddress } else { "localhost" }
  $browserUrl = "http://${browserHost}:$($apiUri.Port)"
  $siteUrl = if ($Lan) { "http://${lanAddress}:3002" } else { "http://localhost:3002" }
  $bindAddress = if ($Lan) { "0.0.0.0" } else { "127.0.0.1" }
  $lanDemoEnabled = if ($Lan) { "true" } else { "false" }
  $envLines = @(
    "JLPT_DEMO_BIND_ADDRESS=$bindAddress",
    "NEXT_PUBLIC_SITE_URL=$siteUrl",
    "NEXT_PUBLIC_SUPABASE_URL=$browserUrl",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$publishableKey",
    "NEXT_PUBLIC_AUTH_ENABLE_PHONE=true",
    "NEXT_PUBLIC_DEMO_LAN_ENABLED=$lanDemoEnabled",
    "LOCAL_DEMO_SUPABASE_PROXY=false",
    "SUPABASE_PROXY_TARGET=http://host.docker.internal:54321",
    "LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED=false",
    "SUPABASE_SERVICE_ROLE_KEY=$serviceKey"
  )
  [System.IO.File]::WriteAllLines($composeEnvFile, $envLines, [System.Text.UTF8Encoding]::new($false))

  Write-Host "Building and starting the optimized app container..."
  & docker compose --env-file $composeEnvFile -f compose.yaml up --build --detach
  if ($LASTEXITCODE -ne 0) { throw "The application container could not be built or started." }

  Write-Host "Waiting for the local app health check..."
  $healthy = $false
  for ($attempt = 0; $attempt -lt 48; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:3002" -TimeoutSec 4
      if ($response.StatusCode -eq 200) { $healthy = $true; break }
    } catch {
      Start-Sleep -Seconds 3
    }
  }
  if (-not $healthy) {
    & docker compose --env-file $composeEnvFile -f compose.yaml ps
    throw "The app did not become healthy. Inspect its container logs with docker compose logs app."
  }

  Write-Host "Local Docker application is available at http://127.0.0.1:3002"
  Write-Host "Local demo profiles: http://127.0.0.1:3002/dev/test-accounts"
  if ($Lan) {
    Write-Host "LAN tester link: $siteUrl"
    Write-Host "LAN demo profiles: $siteUrl/dev/test-accounts"
    Write-Host "Supabase test API for browser clients: $browserUrl"
    Write-Host "Share these links only with trusted testers on your private Wi-Fi/VPN. This mode exposes the local test admin account and simulated-payment workspace to that network."
  }
  Write-Host "The existing local Supabase data was preserved. No hosted service was contacted."
}
finally {
  Pop-Location
}
