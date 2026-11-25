# Local Docker deployment

## Services

- Supabase CLI manages the Docker-local Postgres, Auth, REST, Storage, Realtime, Studio and supporting services.
- `compose.yaml` runs the optimized Next.js app in a separate Docker container on `127.0.0.1:3002`.
- Browser requests use `http://localhost:54321`; server-side app requests use Docker's `host.docker.internal` gateway. The launcher verifies the Supabase API URL is loopback before writing any environment file.
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
