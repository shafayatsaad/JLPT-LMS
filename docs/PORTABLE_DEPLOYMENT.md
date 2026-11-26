# Portable deployment and launch configuration

## What the local demo runs

The Docker demo runs the Next.js application and its database/auth/storage services on this computer. It does not connect to the hosted Supabase project, Vercel, a payment gateway, or a real email/SMS provider. The temporary remote demo link only forwards HTTPS traffic back to these local containers.

Start local-only mode with `npm run demo:local:docker`. For remote testers, use `npm run demo:local:docker:remote`; the printed HTTPS URL is temporary and changes when the tunnel starts again. Stop it with `npm run demo:local:docker:stop`. These commands preserve the local database unless you explicitly run the separate reset demo command.

## Current provider boundary

The product has a PostgreSQL schema and versioned SQL migrations. The application also calls Supabase Auth, the PostgREST API, Supabase RPC functions, Storage, and Row Level Security directly. As a result, the current build is **not plug-and-play with an arbitrary database or authentication service**. A plain PostgreSQL connection string cannot replace the local Supabase services by itself.

The Next.js app can be hosted on a different Docker/Node host and use a different domain through environment configuration, but its Auth callback URLs, public database API, storage URLs, OAuth callbacks, and secrets must match that deployment. The current hosted backend adapter is Supabase. Avoid describing the product as provider-independent until another adapter is implemented and tested.

## Before choosing a production provider

Keep the current local Docker project as the reproducible acceptance environment. Before launch, choose the production services and wire them through application-level adapters:

| Concern | Current local/hosted integration | Decision needed for another provider |
|---|---|---|
| Website hosting | Next.js production container | Node/Docker runtime, build command, health check, environment variables |
| Database | PostgreSQL through Supabase API/RPC and SQL migrations | PostgreSQL host, connection pooling, migration runner, backups and restore test |
| Authentication | Supabase Auth, OAuth, MFA and session cookies | Auth provider and a server-side session adapter; domain callback URLs |
| File storage | Supabase Storage private buckets and signed URLs | S3-compatible or provider storage adapter, private access and signed downloads |
| Email and SMS | Local demo capture/fixed test OTP | Provider credentials, templates, consent and delivery checks |
| Payments | Local simulated checkout | Gateway, webhook verification, refunds, reconciliation and launch-specific pricing |
| Google Sheets | Demo sync path | Service account, restricted destination, authorized admins and retry policy |

The adapter work should move pages and actions away from direct provider calls toward interfaces such as `AuthService`, `QuestionRepository`, `ExamRepository`, `AssetStorage`, and `PaymentGateway`. Keep provider-specific queries, OAuth callbacks, and storage signing inside those adapters. Use the same domain services for local and hosted environments, then run the existing browser workflow suite against each adapter before release.

## Steps when the owner selects providers

1. Record the selected domain, host, database, authentication, storage, email/SMS, payment and analytics providers.
2. Implement or select an adapter for each provider; keep credentials in that host's secret store and out of source control.
3. Add a clean environment template with the exact variable names for that deployment. Keep local-demo variables separate from production variables.
4. Apply migrations to an empty staging database, load reviewed sample content, then verify a backup can be restored.
5. Configure the canonical site URL, OAuth redirect allow-list, trusted origins, cookie settings, CORS and storage permissions for the chosen domain.
6. Run unit, type, accessibility, security-role and full learner/admin browser tests against staging. Verify that test payments cannot reach a real gateway.
7. Only after those checks pass, migrate reviewed content and launch configuration to production.

## Local reproducibility checklist

- Start Docker Desktop before using the Docker demo.
- Use `npm run demo:local:docker` for the optimized, localhost-only build.
- Use `npm run demo:local:docker:remote` only to share a temporary public test URL. Anyone with that link can reach the demo login and demo account page.
- Use only synthetic learners, fake payment references and non-sensitive sample content in the local database.
- Keep the local Supabase stack and the product's provider adapter explicit. Do not copy the local demo secrets or local-only role exception into a hosted environment.
- To return to normal local staff policy and localhost-only access, run `npm run demo:local:docker`; stopping remote mode restores the AAL2 staff checks.
