# Testing and QA record

**Environment:** Docker-local Supabase; optimized Next.js app container on port 3002. No database reset performed.

## Current checks

| Check | Result |
|---|---|
| `npm run typecheck` | Passed; production Docker build also completed TypeScript |
| `npm run test:unit` | 16 passed |
| `npm run supabase:test` | 124 assertions passed across 5 SQL test files |
| `npm run supabase:audit` | 43/43 expected tables present in local Docker schema; table presence only |
| `npm run supabase:config:validate` | Valid and complete; no remote projects configured |
| `npm run supabase:content-audit` | 0 published forms for N1–N4; 34 N5 including retained QA forms; expected exit 1 because N1–N4 are below target |
| `npm run lint` | 0 errors and 19 warnings |
| `npm run demo:local:docker` | Optimized production image built and health check passed at `127.0.0.1:3002` |
| `PLAYWRIGHT_PORT=3002 npm run test:e2e` | 31 passed against the production container |

The Docker production build compiled Next.js 16.4.6, completed TypeScript, generated all application routes and reported no build error. A Docker clean `npm ci` reported 0 dependency vulnerabilities; npm emitted peer/deprecation warnings.

## Browser coverage

The 31-test Playwright suite covers public page accessibility in English/Bangla at desktop/mobile, homepage/hero, public level guides, free sample booklet and answer sheet, Google/email account form behavior, local student sign-in/sign-out, admin TOTP, staff navigation, content authoring/import/review/publication, premium access lock, free mock attempt candidate/preparation, answer persistence/retry, listening and results. During an active attempt it also verifies browser Back confirmation, the browser `beforeunload` event, and confirmed sign-out. It does not cover every action, form field, permission branch, failure mode or route.

The content workflow E2E creates QA records and frozen N5 forms in the local database. These records are intentionally retained; the suite does not reset the database. Thirty-one published N5 forms currently have `N5-PHASE*` QA codes. They must not be counted as reviewed production content. `/dev/test-accounts` now lists both the subscribed demo learner and a separate no-entitlement learner used for free-versus-premium checks.

## Commands

```powershell
npm run typecheck
npm run test:unit
npm run supabase:test
npm run supabase:audit
npm run supabase:content-audit
npm run lint
$env:LOCAL_DEMO_ACCOUNTS_ENABLED='true'
$env:PLAYWRIGHT_PORT='3002'
npm run test:e2e
```

## Remaining QA

- Add malformed/oversize/duplicate CSV/XLSX and ZIP traversal/zip-bomb cases; test asset upload rollback and storage failures.
- Exercise admin and reviewer route/action matrices, role mutation, support states, payments/entitlements, audit logs, reports and privacy export/deletion.
- Test attempt timers, breaks, disconnected finalization, listening failure recovery, lost connection, duplicate submit, beforeunload/history behavior across browsers, fullscreen denial, Japanese/furigana and screen readers.
- Perform a real backup/restore drill against disposable local data, then test the public launch build using staging credentials and owner-approved rights-cleared forms.
