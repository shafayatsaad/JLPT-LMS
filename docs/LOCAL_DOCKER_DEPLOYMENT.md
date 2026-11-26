# Local Docker deployment

## Services

- Supabase CLI manages the Docker-local Postgres, Auth, REST, Storage, Realtime, Studio and supporting services.
- `compose.yaml` runs the optimized Next.js app in a separate Docker container on `127.0.0.1:3002` by default.
- Browser requests use the local Supabase API; server-side app requests use Docker's `host.docker.internal` gateway. The launcher reads the URL from Supabase CLI and rejects a non-local endpoint.
- Generated local keys are written to ignored `.local-demo/compose.env`. They are never printed by the launcher and must not be copied into production.

## Start without resetting local data

```powershell
npm ci
npm run demo:local:docker
```

Open `http://127.0.0.1:3002` and `/dev/test-accounts`. The page lists a subscribed demo learner, a separate no-entitlement learner for premium-lock checks, and staff profiles. The app image uses Node 22 and Next.js production startup. The launcher starts Supabase but does not call `db reset`, seed, or write to a hosted project. Existing local database and storage volumes are preserved.

Stop only the app container:

```powershell
npm run demo:local:docker:stop
```

Supabase remains available. Use the Supabase CLI to stop its local containers separately if desired. Starting the Docker demo again reuses the same local volumes.

## Let trusted testers on the same private network open the demo

Start Docker Desktop, then from `D:\JLPT LMS` run:

```powershell
npm run demo:local:docker:lan
```

The script rebuilds the optimized app with the computer's private Wi-Fi/Ethernet address, binds port 3002 to the LAN, and prints the exact tester and account URLs. Send that `http://<private-LAN-IP>:3002` link to testers connected to the same trusted Wi-Fi or VPN. Give them the learner test account from `/dev/test-accounts`; share admin access only with testers who need staff workflows.

The local Supabase API on port 54321 is also reachable from that private network so browser sign-in and database-backed UI work. If Windows Firewall asks, allow the app for **Private networks only**. If another device cannot connect, confirm both computers are on the same network and ask the network administrator to permit TCP ports 3002 and 54321 on the private profile. The printed IP can change when Wi-Fi reconnects; restart with the command above to refresh it.

This is a same-network demo link, not an internet-hosted URL. Do not port-forward it or expose it through a public tunnel: the local staff test account and admin workflows are intentionally enabled. Payments remain simulated and send no money.

To return to local-computer-only access, run `npm run demo:local:docker`; it rebuilds the app bound to `127.0.0.1`.

Useful inspection commands:

```powershell
docker compose --env-file .local-demo/compose.env -f compose.yaml ps
docker compose --env-file .local-demo/compose.env -f compose.yaml logs --tail 100 app
npm run supabase:audit
npm run supabase:config:validate
```

## Database and content data

- Migrations are in `supabase/migrations`; current Docker-local migration history is synced through `202611250054`.
- `npm run supabase:audit` and `npm run supabase:content-audit` use local Supabase CLI connection values and reject non-loopback URLs.
- The normal Docker app launcher does not reset or reseed. The existing `npm run demo:local` script resets only the local Supabase database and loads demo seed data; it is a separate explicit operation and must not be used when you want to keep current test data.
- Supabase owns database/storage volumes. The app container itself stores no learner records.

## Limits

- This is a reproducible local simulation, not proof of production hosting readiness.
- Database backup/restore and volume recovery have not been drilled. Keep a separate verified backup before any intentional local reset.
- Real Google OAuth, email/SMS delivery, bKash/payment, Google Sheets and production monitoring are not part of this local container.
- Docker's optional log Vector service has reported inability to connect to the Docker host logging endpoint; inspect `docker logs supabase_vector_JLPT_LMS` if local telemetry is needed.
