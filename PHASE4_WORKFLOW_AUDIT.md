# JLPT LMS Phase 4 workflow audit

**Audit date:** 27 November 2026  
**Branch:** `main` at `bbe08e8`  
**Environment:** production Next.js app container plus Docker-local Supabase  
**Data handling:** no database reset or destructive migration performed

## Executive summary

The repository already contains role-gated learner and staff journeys, question authoring/import/review, private media, blueprint-based exam assembly, frozen published forms, exam attempts/results and simulated payment operations. The baseline is not a complete or reliable acceptance pass: key browser flows are covered, but the primary workspaces are spread across route-heavy subnavigation, the media page is a reviewer queue rather than a library, the question list searches only the newest 500 results, and the staff preview is a fixed N5 sample instead of a selected exam.

Phase 4 should preserve the existing RLS, MFA, frozen snapshots, payment/entitlement history, published exams, attempts and storage references while making the two core jobs easier to follow: staff manage questions and publish exams; learners find exams and review performance.

## Baseline repository and route inventory

`src/app` contains the public site and legal/information pages, email/Google/MFA account routes, learner dashboard/exam/practice/result/profile/payment/support/privacy routes, staff routes, API routes and cron/webhook-like jobs. The full source inventory is available with `rg --files src/app`.

| Journey | Main routes | Observed behavior |
|---|---|---|
| Public | `/`, `/about`, `/contact`, `/faq`, `/how-it-works`, `/levels`, `/levels/[level]`, `/pricing`, `/legal/[policy]` | Origami/Sakura public pages; the home hero has one video with reduced-motion still fallback. |
| Authentication | `/auth/*`, `/admin/sign-in`, `/admin/mfa` | Local email sign-in, optional Google entry, phone verification simulation, learner risk step-up and staff TOTP. Hosted provider delivery remains unverified. |
| Learner | `/dashboard`, `/exams`, `/exams/[formId]`, `/practice/*`, `/progress`, `/leaderboard`, `/account`, `/settings/*`, `/subscription`, `/payments`, `/support/*` | Dashboard already contains a leaderboard preview. Primary header currently lists Dashboard, Mock Exams, Practice, Results, Leaderboard and Profile, so leaderboard duplicates a dashboard/results feature. |
| Staff workspaces | `/admin`, `/admin/questions*`, `/admin/reviews`, `/admin/assets`, `/admin/sources`, `/admin/blueprints`, `/admin/exam-forms*`, `/admin/exam-preview`, `/admin/users*`, `/admin/support*`, `/admin/payments*`, `/admin/reports*`, `/admin/settings*` | Six major area links exist, but each workspace opens a long route-link subnavigation (26 destinations for an admin). The current labels are Overview, Content, Exams, Students, Payments and Reports & Settings. |
| API | `/api/payment-requests*`, private attachments/receipts, MFA step-up/trusted-device, payment-sheet sync and scheduled notification/sync routes | Server-authenticated handlers exist; external integrations are not enabled in the local sandbox. |

## Workflow findings

### Question Bank and content

- `/admin/questions` lists question revisions and server-side status counts, with level/status/type/skill filters.
- It loads at most 500 newest rows, then applies prompt, ID/content-family and skill search in memory. There is no page navigation, stable sort choice or bulk-selection action. The visible search label suggests more complete database search than the implementation provides.
- `/admin/questions/new` combines single-question authoring and JSON/CSV/XLSX/ZIP/folder imports. Import previews and validations create drafts, then question and media review are separate. PDFs remain private reference material and are not parsed as question data.
- `/admin/assets` calls `get_content_asset_review_queue()`, which intentionally returns only assets in `needs_review` and requires reviewer/admin. The route is visible to content editors too, so editor access can show a database rejection instead of an asset library.
- The asset review component shows an expiring private preview, linked question prompt, uploader ID and decision buttons. It does not provide a complete asset inventory, filename/size, status filtering, metadata editing, replacement, relationship management or guarded deletion.
- `content_assets` and `question_assets` use restrictive references. Storage delete rules permit only own/unregistered or own draft files; existing review and exam references must not be bypassed. A safe deletion/replacement workflow needs explicit database and storage checks plus an audit event.
- Source PDFs/audio use a separate private source-packet workflow under `/admin/sources`; retain it as a content-source function and surface it in the unified files workspace.

### Exam Manager

- `/admin/blueprints` creates/submits/reviews blueprint revisions.
- `/admin/exam-forms` selects an approved blueprint, selects approved questions to exact slot quotas, creates draft forms, and shows validation/publication actions.
- Validation and publication are server-side RPCs. They check the approved blueprint, exact quotas, question status/level, answer keys, required media and consistent section duration. Publishing freezes a form; database guards reject edits to frozen forms.
- `/admin/exam-forms/[formId]` exposes the manifest and selected question/blueprint relations without answer keys.
- `/admin/exam-preview` is hard-coded to the N5 demo manifest and renderer. It does not preview the currently selected exam form or its assets.
- The current assembly UI requires exact quotas but has no explicit supported reordering control, no selected-form learner-renderer preview, and no visible structured validation checklist. Preserve the working server-side validation and frozen history while connecting these steps into one Exam Manager.

### Learner experience

- The learner flow covers exam discovery, access checks, candidate cover, server-timed preparation, paper sections, separate answer sheet, answer persistence, section deadlines, results and review.
- The public five-question N5 preview is original demonstration content and must remain labeled as a sample.
- The leaderboard query uses completed results and pseudonymous rows; the dashboard already links/shows a preview, making a separate top-level destination unnecessary.
- Existing dashboard/exam/practice/results/profile destinations must remain. Bookmarks and mistake review are database-backed but should remain contextual to practice/results.

## Roles, data, migrations and storage

- Staff route checks combine role lookup, `requireStaff`/`requireStaffMfa`, RLS and database RPC authorization. Review and exam publication prevent self-approval. Do not weaken these checks during navigation consolidation.
- Published form snapshots, existing attempts/results, payment history/entitlements, account roles and private storage references are compatibility constraints.
- Local Supabase schema audit: 43/43 expected public tables are visible. This is a table-name check only; it does not validate columns, functions, RLS or Storage rules.
- SQL test suite: 5 files, 124 assertions passed.
- No migration was added during baseline and no database reset was performed.

## Docker baseline

- `jlptlms-app-1` is healthy on `127.0.0.1:3002`.
- Local Supabase DB, Auth, Storage, REST and Studio are running. `supabase_vector_JLPT_LMS` is restarting because its optional log collector cannot reach the Docker host logging endpoint; database/auth/storage tests still passed.
- A public Quick Tunnel was running at audit time. Browser E2E writes persistent synthetic rows into this same database, so it must not be treated as an isolated test database. Existing QA forms and question records are preserved.

## Baseline test results

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run test:unit` | 27 passed |
| `npm run supabase:test` | 124 assertions passed across 5 SQL files |
| `npm run supabase:audit` | 43/43 expected tables present; table names only |
| Production-like Docker app | Healthy on port 3002 |
| Full Playwright suite | 33 passed, 1 failed (34 total) |

The failing E2E was the staff form validation/publication segment. The page still displayed a draft and the direct SQL assertion reported `draft|false`; a later direct database read showed the same uniquely identified form as `validated|false`. The failure is therefore recorded as an unresolved UI/database timing or shared-database isolation inconsistency. It is not counted as a passing exam workflow. The Quick Tunnel remained available to testers during the baseline run, and the browser suite writes to the same persistent local data.

## Confirmed gaps to address

1. Replace the six learner top links with the five required destinations; keep leaderboard discoverable within Dashboard/Results.
2. Keep exactly six authorized staff workspace destinations and reduce the long per-route secondary navigation to clear contextual tabs.
3. Make Question Bank the primary content home; preserve old URLs as compatibility redirects.
4. Add complete database-backed question search and pagination; provide a safe audited bulk action only where existing RPCs authorize it.
5. Make Files & Media browse all authorized media/source files and display useful metadata and relationships; retain separate question/media review. Do not expose storage files publicly or delete referenced files.
6. Put blueprint, exam assembly, selected-form preview, validation and publish/revision actions under Exam Manager. Replace the misleading fixed N5 admin preview with a selected-form preview or mark it clearly as a demo.
7. Add workflow tests for the consolidated views, content import/review, selected exam preview, publication freeze and role denials.
8. Re-run acceptance against an isolated database or explicitly disable concurrent remote testing during mutation-heavy E2E; do not reset the persistent demo database to obtain a clean test.

## Features to preserve

Independent content review and audit trails; private source and question media; role-specific access and staff MFA; simulated payment/entitlement handling; exam snapshot immutability; server-managed attempt timing/saving/scoring; student privacy; current Origami/Sakura shell and paper-like exam renderer; all legacy route destinations and historical records.

## Phase 4 implementation and acceptance — 27 November 2026

The baseline findings above record what was present before the Phase 4 changes. The following items are now implemented and verified locally:

- **Navigation:** six staff workspaces—Dashboard, Question Bank, Exam Manager, Students, Payments and Settings—with concise role-filtered contextual tabs. Existing deep links remain routable; `/admin/content` redirects to Question Bank and `/admin/sources` opens Files & Media’s source view.
- **Question Bank:** a bounded database RPC now applies prompt/family/ID search and level, section, type, skill, difficulty and status filters before pagination. The page supports 50-row pages, stable sort modes and status counts. Bulk review submission is limited to the signed-in editor’s own draft questions and calls the existing audited review RPC.
- **Files & Media:** the page now shows a paginated private content-asset inventory, filename, MIME type, size, uploader, upload time, audio duration, expiring private preview/download, linked questions and linked forms. Source packets and the independent reviewer queue remain available within the workspace. Metadata edits, same-type draft replacement, linking/unlinking, and deletion are constrained by server-side role/state/storage checks. A successful review immediately removes the item from the current queue while the server refresh completes.
- **Exam Manager:** form cards and detail pages open the selected saved form’s preview. It renders form directions, section order/timing, question prompts/options and approved media in a read-only paper layout, with a separate temporary answer sheet. It does not create an attempt or save answers.
- **Database:** additive migrations `202611270055`–`202611270058` are applied and synced on the Docker-local Supabase instance. No reset or destructive schema/data operation was run. Tests cover search/pagination/role denial and media metadata, relation changes, safe deletion and audit preservation.
- **Final test run:** `npm run typecheck` passed; `npm run test:unit` passed 27/27; `npm run supabase:test` passed 150 assertions in 7 files; `npm run supabase:audit` found 43/43 expected tables; the full production-container Playwright suite passed 34/34. The Docker app is healthy on `127.0.0.1:3002`; the existing public tunnel remains running.

The read-only content audit reports **0 published forms for N1–N4 and 56 for N5, including 55 synthetic `N5-PHASE*` QA forms**. Its exit code is 1 because N1–N4 do not meet the three-form target. This remains a real launch blocker: synthetic form counts do not represent reviewed, rights-cleared exams. The final E2E run intentionally adds more retained synthetic rows to the persistent local test database and does not reset it. Since the remote tunnel points at that same database, concurrent tester activity can affect these acceptance checks and the test records are visible to authorized staff.

ESLint on the changed source/test paths reports no errors and three native-image performance warnings for signed private image URLs. Full `eslint .` still scans generated build output and was not used for this acceptance run. Automated coverage, successful local flows and 43/43 table visibility are not a production security, backup/restore, content-rights or provider-configuration certification.

