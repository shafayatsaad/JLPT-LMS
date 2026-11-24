param([switch]$Resume, [switch]$Production)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$supabaseCli = Join-Path $projectRoot "node_modules/.bin/supabase.cmd"

if (-not (Test-Path -LiteralPath $supabaseCli)) {
  throw "Supabase CLI is not installed. Run npm install first."
}

$port = if ($Production) { 3001 } else { 3000 }

Push-Location $projectRoot
try {
  Write-Host "Starting local Supabase containers..."
  $savedPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $supabaseCli start *> $null
  $supabaseStartExitCode = $LASTEXITCODE
  $ErrorActionPreference = $savedPreference
  if ($supabaseStartExitCode -ne 0) { throw "Supabase could not start. Check that Docker Desktop is running." }

  if ($Resume) {
    Write-Host "Applying pending migrations to the existing local database; preserving its data..."
    & $supabaseCli migration up --local
    if ($LASTEXITCODE -ne 0) { throw "Pending migrations could not be applied to the local database." }
  } else {
    Write-Host "Resetting only the local database and loading the test profiles..."
    & $supabaseCli db reset --sql-paths ./seed.sql
    if ($LASTEXITCODE -ne 0) { throw "The local Supabase database reset failed." }
  }

  $statusLines = & $supabaseCli status --output env
  if ($LASTEXITCODE -ne 0) { throw "Could not read local Supabase connection values." }
  $localConfig = @{}
  foreach ($line in $statusLines) {
    if ($line -match '^(?<key>[A-Z0-9_]+)="?(?<value>.*?)"?$') {
      $localConfig[$Matches.key] = $Matches.value.Trim('"')
    }
  }

  $apiUrl = $localConfig["API_URL"]
  $publicKey = $localConfig["PUBLISHABLE_KEY"]
  if (-not $publicKey) { $publicKey = $localConfig["ANON_KEY"] }
  $serviceKey = $localConfig["SERVICE_ROLE_KEY"]
  if (-not $serviceKey) { $serviceKey = $localConfig["SECRET_KEY"] }
  if (-not $apiUrl -or -not $publicKey) { throw "Supabase CLI did not provide a local API URL and public key." }
  if (-not $serviceKey) { throw "Supabase CLI did not provide a local server key for staff preview features." }
  $apiUri = [System.Uri]::new($apiUrl)
  if ($apiUri.Host -notin @("localhost", "127.0.0.1", "::1")) { throw "Refusing to start demo mode with a non-local Supabase URL." }

  $env:NEXT_PUBLIC_SUPABASE_URL = $apiUrl -replace '^http://127\.0\.0\.1', 'http://localhost'
  $env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = $publicKey
  $env:NEXT_PUBLIC_AUTH_ENABLE_PHONE = "true"
  $env:SUPABASE_SERVICE_ROLE_KEY = $serviceKey
  $env:LOCAL_DEMO_ACCOUNTS_ENABLED = "true"
  if ($Production) {
    $env:JLPT_NEXT_DIST_DIR = ".next-production-demo"
  } else {
    Remove-Item Env:JLPT_NEXT_DIST_DIR -ErrorAction SilentlyContinue
  }

  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
  try { $listener.Start() } catch { throw "Port $port is in use. Stop the server using it, then retry." }
  finally { $listener.Stop() }

  Write-Host "Local demo accounts are ready. No hosted Supabase settings were changed."
  Write-Host "Open http://127.0.0.1:$port/dev/test-accounts for credentials and links."
  if ($Production) {
    Write-Host "Building and starting the production Next.js server against local Docker services..."
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw "The production build failed." }
    Write-Host "Press Ctrl+C to stop the local production server."
    & npm run start -- --port $port
  } else {
    Write-Host "Press Ctrl+C to stop the local Next.js server."
    & npm run dev -- --port $port
  }
  if ($LASTEXITCODE -ne 0) { throw "Next.js exited with an error." }
}
finally {
  Pop-Location
}
