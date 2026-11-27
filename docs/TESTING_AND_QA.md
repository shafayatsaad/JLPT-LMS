# Testing and QA record

**Environment:** Docker-local Supabase; optimized Next.js app container on port 3002. No database reset performed.

## Current checks

| Check | Result |
|---|---|
| `npm run typecheck` | Passed; production Docker build also completed TypeScript |
| `npm run test:unit` | 27 passed |
| `npm run supabase:test` | 150 assertions passed across 7 SQL test files |
| `npm run supabase:audit` | 43/43 expected tables present in local Docker schema; table presence only |
| `npx supabase migration list` | Local migration history matches through `202611270058` |
| `npm run supabase:content-audit` | 0 published forms for N1–N4; 56 N5 including 55 QA-coded forms; expected exit 1 because N1–N4 are below target |
| Targeted ESLint on changed source/test files | 0 errors; 3 native-image warnings |
| Docker production build and health check | Passed; app healthy at `127.0.0.1:3002` |
| Full Playwright suite, one worker, against production container | 34 passed |

The Docker production build compiled Next.js 16.4.6, completed TypeScript, generated all application routes and reported no build error. A Docker clean `npm ci` reported 0 dependency vulnerabilities; npm emitted peer/deprecation warnings.

## Browser coverage

The 34-test Playwright suite covers public page accessibility in English/Bangla at desktop/mobile, homepage/hero, public level guides, free sample booklet and answer sheet, Google/email account form behavior, local student sign-in/sign-out, admin TOTP, staff navigation, content authoring/import/review/publication, paginated Question Bank search, private asset inventory and preview, safe media linking/unlinking, selected-form paper preview, premium access lock, candidate preparation, answer persistence/retry, listening and results. During an active attempt it also verifies browser Back confirmation, the browser `beforeunload` event, and confirmed sign-out. The payment journey submits a local simulated checkout, approves it through the staff UI, and checks the verified payment and active entitlement in local Supabase. It does not cover every action, form field, permission branch, failure mode or route.

The content workflow E2E creates QA records and frozen N5 forms in the local database. These records are intentionally retained; the suite does not reset the database. A read-only local query found 56 published N5 forms, 55 with `N5-PHASE*` QA codes. They must not be counted as reviewed production content. `/dev/test-accounts` lists both the subscribed demo learner and a separate no-entitlement learner used for free-versus-premium checks. Payment verification adds a simulated payment/entitlement to the subscribed demo learner; no real provider or money is involved.

The full E2E output includes a PostgreSQL rejection stating that published/frozen forms are immutable. This is the expected result of the immutability guard assertion; the test passed and the frozen record was not changed.

## Commands

```powershell
npm run typecheck
npm run test:unit
npm run supabase:test
npm run supabase:audit
npm run supabase:content-audit
npm run lint
$env:LOCAL_DEMO_ACCOUNTS_ENABLED='true'
$env:LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED='true'
$env:PLAYWRIGHT_PORT='3002'
npx playwright test --workers=1
```

## Remaining QA

- Add malformed/oversize/duplicate CSV/XLSX and ZIP traversal/zip-bomb cases; test asset upload rollback and storage failures.
- Exercise admin and reviewer route/action matrices, role mutation, support states, payments/entitlements, audit logs, reports and privacy export/deletion.
- Test attempt timers, breaks, disconnected finalization, listening failure recovery, lost connection, duplicate submit, beforeunload/history behavior across browsers, fullscreen denial, Japanese/furigana and screen readers.
- Perform a real backup/restore drill against disposable local data, then test the public launch build using staging credentials and owner-approved rights-cleared forms.
