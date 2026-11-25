# JLPT LMS Phase 2 workflow audit

**Audit date:** 25 November 2026  
**Environment:** optimized Next.js server on port 3001 and local Supabase in Docker, started by `npm run demo:local:production:resume`. The final verification did not change hosted configuration or access Vercel, OAuth, or payment providers.

## Findings and changes

- Student accounts land on a focused learner dashboard. Student navigation is Dashboard, Mock Exams, Practice, Results, and Profile; Plans & Payments now lives under the account destinations. Staff accounts land in the staff workspace, with a separate Learner view link.
- Admin navigation has six primary areas (Dashboard, Content, Exams, Users, Payments, System) and one contextual sub-navigation for the active area. Destination routes remain available and permission-filtered.
- Question Bank now has status totals, level/status/type/skill filters, ID or prompt search, and direct author/import/review actions. Question editing persists draft content, choices, correct answer, explanations and tags.
- Folder import supports a `manifest.json` package with referenced image/audio files. It reports item errors before confirmation; imported questions and assets enter review and are not published automatically.
- A separate reviewer demo user was added to `supabase/seed.sql` and the running local database. Its independent MFA-backed review was used to approve question and media content authored by the admin.
- Exam Builder captures a draft against an approved blueprint, enforces question quota, supports an independent validation step, and publishes a frozen snapshot.
- The mobile account menu now has React-owned open/close state and accessible labels. The previous module script and React were both trying to own the button, which caused its state to remain closed in a real mobile test.
- A PostgreSQL trigger defect blocked status review because a shared trigger tried to evaluate `NEW.version` on a `questions` row. Migration `202611250051_protect_review_record_fields.sql` now scopes each field comparison to its table. It is applied to the local database and should be included in any hosted migration rollout.
- The full Playwright workflow writes synthetic QA rows into the local database. Its `N5-PHASE2-*` forms and `[PHASE 2 QA/IMPORT]` questions are test artifacts, not launch inventory. Published test snapshots are immutable, so they remain visible in this local demo until a deliberate local database reset.

## Route and workflow inventory

| Area | Routes or workflow | Phase 2 result |
|---|---|---|
| Learner | `/dashboard`, `/account`, `/subscription`, `/exams` | Student sign-in, dashboard, profile destination, plan/payment destination, mobile menu, sign-out, and admin-role denial were exercised. Screenshot suite captured desktop/mobile account and dashboard. |
| Free mock | `/exams/n5/preview/session` | Five-question original preview, scrollable paper, separate answer sheet, answer persistence/clearing, reduced-motion behavior and mobile layout passed. This is a sample, not an official full JLPT section. |
| Staff entry | `/admin/sign-in`, `/auth/mfa`, `/admin`, `/dashboard?view=learner` | Admin TOTP challenge and staff landing passed. Learner view is a separate destination and resolves to the account’s actual profile. Reviewer also completed MFA for the review workflow. |
| Content | `/admin/content`, `/admin/questions`, `/admin/questions/new`, `/admin/questions/[questionId]`, `/admin/reviews`, `/admin/assets`, `/admin/sources` | Main routes rendered under staff auth. Manual draft create/edit/reload persistence and invalid-choice validation passed. Invalid import produced an actionable error; valid image/audio folder import persisted two assets and a question. Admin self-review was rejected; reviewer approval and asset approval persisted. Source-folder upload/archive was exercised in the prior local launch audit, not repeated in this Phase 2 run. |
| Exams | `/admin/blueprints`, `/admin/exam-forms`, `/admin/exam-forms/[formId]`, `/admin/exam-preview` | Blueprint, builder, preview and form routes rendered. Admin created an exact-quota draft; independent reviewer validated and published it. Database state changed to `published|true`, and a direct mutation was rejected as immutable. The standalone preview route remains a seeded sample, not a live preview of whichever form is selected. |
| Users | `/admin/users`, `/admin/staff`, `/admin/support` | Principal pages rendered in the admin route sweep. Deeper role-assignment and every support transition were not re-exercised in this Phase 2 run. |
| Payments | `/admin/payments`, `/admin/plans`, `/admin/entitlements`, `/admin/settings/payments` | Routes and policy-filtered navigation are present. Local fake checkout and manual approval were exercised in the previous launch audit; this Phase 2 run did not repeat a new checkout. No real payment was made. |
| System | `/admin/reports`, `/admin/attempts`, `/admin/announcements`, `/admin/privacy`, `/admin/audit`, `/admin/settings`, `/admin/settings/integrations` | Pages rendered in the admin route sweep. Local Sheets simulation was exercised in the prior launch audit. Not every control on every settings/system page received an interaction test in this phase. |

## Exact verification run

- `npm run demo:local:production:resume` — production build passed and the optimized server started against local Docker Supabase without resetting local data.
- `LOCAL_DEMO_ACCOUNTS_ENABLED=true PLAYWRIGHT_PORT=3001 npm run test:e2e` — **31 passed**, including 14 desktop/mobile accessibility checks. The admin browser flow verified persisted question and asset states, validation/publication state, and published-form immutability against the local database.
- After filtering the Question Bank screenshot to `eligible_for_exam`, `LOCAL_DEMO_ACCOUNTS_ENABLED=true PLAYWRIGHT_PORT=3001 npm run test:e2e -- --grep "local administrator opens staff workspace"` — **1 passed**; refreshed the production screenshot set.
- `npm run typecheck` — passed.
- `npm run test:unit` — **14/14 passed**.
- `npm run lint` — **0 errors, 19 warnings**. Warnings are existing font/stylesheet loading, raw image tags, and internal navigation via `window.location.assign`.
- `npx supabase migration up --local` — migration `202611250051` applied. `npx supabase migration list --local` confirmed it is recorded in local history.

## Screenshots

Playwright saved Phase 2 screenshots under `test-results/`. The admin-route capture set includes content, question bank/editor/import, review, media, blueprints, exam builder/preview, users, support, payments, plans, entitlements, reports, attempts, announcements, privacy, audit, integrations and settings. The learner set includes dashboard and profile at desktop/mobile plus mobile exam library.

- Admin dashboard: `test-results/phase2-admin-dashboard-desktop.png`
- Question Bank desktop/mobile: `test-results/phase2-admin-question-bank-desktop.png`, `test-results/phase2-admin-question-bank-mobile.png`
- Question editor/import/review/media: `test-results/phase2-admin-question-editor-desktop.png`, `test-results/phase2-admin-import-preview-desktop.png`, `test-results/phase2-admin-review-queue-desktop.png`, `test-results/phase2-admin-media-review-with-samples-desktop.png`
- Published exam workflow: `test-results/phase2-admin-exam-builder-published-desktop.png`
- Learner: `test-results/phase2-student-dashboard-desktop.png`, `test-results/phase2-student-dashboard-mobile.png`, `test-results/phase2-student-account-desktop.png`, `test-results/phase2-student-account-mobile.png`

These were refreshed from the optimized local production server; they do not include the Next.js development diagnostics badge. The Question Bank screenshot is filtered to exam-eligible content so the synthetic QA rows do not dominate the image.

## Test-environment incident

One initial optimized-server attempt inherited the Supabase URL from `.env.local` rather than the Docker values. The local demo sign-in attempts returned `Invalid login credentials`; they did not establish a session or write application data. The hosted auth service may record the failed sign-in attempts. The final production build and all passing tests used the Docker-backed local demo launcher.

## Limits and remaining work

1. This verifies important workflows, not every button and transition across every admin route. User/staff role mutation, support conversation states, all system settings, and all payment cases need their own full acceptance pass.
2. Folder import is synchronous (up to 100 questions/50 MB per package) and is not represented by a background job queue. The Question Bank searches up to the newest 500 database-filtered revisions.
3. Per-form section timing and quotas are supplied by an approved blueprint. There is no independent section editor for each form. Validate the published renderer against licensed, complete N1–N5 papers before launch.
4. The learner free preview contains five original sample questions; the local premium demo contains six. Neither represents a complete JLPT paper. Some seeded listening content is transcript-only.
5. Supplied past-paper rights remain unconfirmed; keep source packets private. No source PDF was converted automatically into learner questions.
6. Production Google OAuth, email/SMS delivery, real payment reconciliation, Google Sheets credentials, Vercel staging, legal text, monitoring and restore procedures remain external launch gates. See `LAUNCH_READINESS_AUDIT.md` and `LOCAL_DEMO.md`.

## Three highest-value next steps

1. Build and independently review a complete rights-cleared N5 exam form against the paper reference, including listening media and answer-sheet mappings; then repeat with N1–N4.
2. Run full interaction acceptance across user/staff roles, support, all payment states and system settings, including unauthorized/empty/error cases.
3. Configure hosted OAuth, mail/SMS, payments, Sheets and Vercel staging, then run a production-like smoke test and backup/restore drill with owner-provided credentials and policies.
