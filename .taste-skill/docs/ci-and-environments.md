# CI and environment setup

## Continuous integration

GitHub Actions runs the same locked install, npm dependency audit, production build, and TypeScript check for every pull request and push. The workflow is in `.github/workflows/quality.yml` and uses the Node release recorded in `.nvmrc` (22.21.1). `package.json` pins the current dependency versions and npm version so `npm ci` can reproduce the install from `package-lock.json`.

The workflow has read-only repository permissions. It does not deploy, contact the hosted Supabase project, apply migrations, or need application secrets. A successful CI run confirms that the source installs, compiles, and type-checks; it does not count as hosted integration or account-isolation acceptance.

## Local development

1. Install Node.js 22.21.1 and npm 10.9.4.
2. Run `npm ci` from the repository root.
3. Copy `.env.example` to the ignored `.env.local` and set the public Supabase URL and publishable key for the intended environment. Keep service-role and other private keys server-side; never add them to `NEXT_PUBLIC_*` variables or commit `.env.local`.
4. Run `npm run dev` for local development. Before sharing a build, run `npm run build` and `npm run typecheck`.

The public app can render its local/demo states without Supabase configuration. Authenticated flows and database-backed features require the matching Supabase project and migrations to be configured.

## Vercel environments

Keep Preview and Production environment variables separate. The current `*.vercel.app` origin is for testing; configure the exact deployed URL in Supabase Auth redirect allowlists and Google OAuth before inviting testers. Do not promote a production environment until the hosted migration sequence, reviewed content, isolation checks, and release checklist in `staging-launch-runbook.md` are complete. The final domain and production credentials are still owner-provided decisions.

This CI workflow does not make or change Vercel deployments or hosted configuration.
