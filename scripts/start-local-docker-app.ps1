param([switch]$Stop)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$supabaseCli = Join-Path $projectRoot "node_modules/.bin/supabase.cmd"
$composeEnvDirectory = Join-Path $projectRoot ".local-demo"
$composeEnvFile = Join-Path $composeEnvDirectory "compose.env"

Push-Location $projectRoot
try {
  if ($Stop) {
    if (Test-Path -LiteralPath $composeEnvFile) {
      & docker compose --env-file $composeEnvFile -f compose.yaml down
      if ($LASTEXITCODE -ne 0) { throw "The local application container could not be stopped." }
    } else {
      Write-Host "No local application compose environment exists."
    }
    return
  }

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

  New-Item -ItemType Directory -Path $composeEnvDirectory -Force | Out-Null
  $browserUrl = "http://localhost:$($apiUri.Port)"
  $envLines = @(
    "NEXT_PUBLIC_SUPABASE_URL=$browserUrl",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$publishableKey",
    "NEXT_PUBLIC_AUTH_ENABLE_PHONE=true",
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
  Write-Host "Demo profiles: http://127.0.0.1:3002/dev/test-accounts"
  Write-Host "The existing local Supabase data was preserved. No hosted service was contacted."
}
finally {
  Pop-Location
}
