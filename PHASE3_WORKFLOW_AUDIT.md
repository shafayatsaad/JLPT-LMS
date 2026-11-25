# JLPT LMS Phase 3 workflow audit

**Audit date:** 25 November 2026  
**Environment:** Docker-local Supabase and the local Next.js demo  
**Database scope:** Local only. No hosted Supabase project or production payment provider was changed.

## Executive summary

The repository already had the core of a working JLPT practice platform: role-gated student and staff workspaces, question authoring and review, media upload, frozen published forms, a server-managed attempt lifecycle, answer writes, scoring, and local simulated payments. Phase 2 had verified the principal question import/review/publish workflow against the Docker database.

Phase 3 closes several important gaps: student navigation now includes a real privacy-safe leaderboard; the staff workspace has the seven requested areas; new mock attempts begin at a candidate cover and a five-minute server-timed preparation state; the active exam has a separate bubble sheet; failed answer writes survive a page refresh in the current browser tab; and leaving an active attempt from the in-app links asks for confirmation.

This is a verified local build checkpoint, not launch certification. Break timing is not modeled, audio is not prefetched before its section, and launch-quality exam inventory is missing for N1–N4. The content audit also counts local QA forms and cannot certify content quality.

## Repository findings

### Already present and exercised

- Student and staff authentication, staff role checks, and mandatory staff MFA.
- The existing origami/Sakura application design system and a distinct, paper-oriented exam workspace.
- Question Bank authoring and editing, JSON manifest plus media-folder import, content review, media approval, and exam-form validation/publication.
- Published exam snapshots are frozen; an attempted mutation is rejected by the database.
- Server-side answer validation, one active attempt per learner, idempotent start, section timers, result creation, and attempt recovery after reload.
- Local demo payments are simulated. No live payment behavior was enabled.

### Gaps confirmed before this phase

- Student navigation lacked a dedicated leaderboard destination and no real leaderboard query was exposed to learners.
- Staff navigation had six primary areas, with Reports nested under System.
- A newly started attempt opened without a candidate cover/preparation state.
- The listening element used native audio controls, and answer-write failures existed only in component memory.
- The live candidate/preparation/answer flow had no end-to-end browser journey.

## Implemented changes

### Student and staff navigation

Student primary destinations are Dashboard, Mock Exams, Practice, Results, Leaderboard, and Profile. Notifications remain available through the notification control; account and payment details remain within Profile/Account destinations.

Staff primary areas are Dashboard, Content, Exams, Students, Payments, Reports, and Settings. Access remains role-filtered and backed by server-side permission checks. Exam attempts and exports are under Reports; staff, roles, security, notifications, and system settings remain contextual tools.

### Leaderboard

The new authenticated `/leaderboard` page and dashboard preview use the `get_student_leaderboard` database function. It ranks completed results from published frozen forms, includes one best attempt per learner and level, supports all-time/7-day/30-day filters, and breaks ties by percentage, correct-answer count, completion time, then stable user ordering. Rows contain a deterministic pseudonym and score aggregates, not email, phone, user ID, or attempt ID. An unfinished attempt is excluded; the learner’s own rank is included even when outside the displayed top rows.

### Exam entry and active session

- The first page is a candidate cover. Candidate name is prefilled from the profile and can be confirmed; candidate number is optional. There are no questions or answer bubbles on the cover.
- Confirming the cover starts the five-minute preparation period on the server. Refreshing does not restart it; questions and answer sheet remain hidden until the server deadline.
- Questions appear as a scrollable paper section with stable question positions. The separate circular answer sheet reflects the saved option mapping.
- The active page uses a custom explicit-play control with no native pause, seek, speed, or replay controls. The server allows the original play and one recovery attempt.
- Failed answer writes are stored as pending entries in `sessionStorage` for that attempt. After refresh they are restored as **Not saved**, and the learner can retry. Saved is shown only after a successful server response.
- The in-app brand and dashboard exit links show an explanation and require confirmation while the attempt is active.

### Admin content workflow

The existing workflow was retained and tested rather than replaced with mock data. The tested package was a JSON manifest plus referenced image/audio files. It showed validation preview, stored imported content as drafts, rejected author self-review, approved content through a separate reviewer, created a form, validated and published it, and verified that the published form was immutable. A second local form included the independently reviewed audio question so the student path exercised the player.

The current uploader is a folder-based manifest/media workflow. ZIP import and XLSX/CSV conversion are not implemented. The existing importer has bounded synchronous processing; it is not a background import queue.

## Database changes

New forward migrations:

- `202611250052_student_leaderboard.sql` — leaderboard function and query index.
- `202611250053_exam_candidate_preparation.sql` — candidate/preparation fields and functions, active attempt payload support, and server-controlled audio playback/recovery records.
- `202611250054_fix_leaderboard_rank_qualification.sql` — qualifies the rank ordering to avoid PL/pgSQL output-column ambiguity.

All three migrations were applied to the Docker-local database. No destructive reset was performed. The leaderboard and candidate/preparation test file uses a transaction and rolls back its fixtures.

## Test evidence

All browser and database activity below used the local Docker Supabase stack and the local demo server.

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `npm run test:unit` | 14 passed |
| `npm run supabase:test` | 124 assertions passed across 5 SQL files |
| `npm run test:e2e` | 31 passed, including desktop/mobile axe checks and the full local staff-to-student exam journey |
| Focused staff-to-student journey | Passed: content import/review, form publication, cover, preparation refresh, section transition, answer-save failure and retry after refresh, audio playback, and submission to results |
| `npm run lint` | 0 errors, 19 warnings |
| `npm run build` | Passed |
| `npm run supabase:config:validate` | Valid and complete; no remote projects configured |
| `npm run supabase:audit` | 43/43 expected tables present; this checks exposed table names only |
| `npm run supabase:content-audit` | Exit 1 because N1–N4 are below the target of 3 published forms per level |

Lint warnings are existing page-layout/font and image/navigation advisories. The full generated build directory is excluded from ESLint, which previously scanned an ignored `.next-phase2-build` and emitted thousands of compiled-output errors.

### Visual check

Playwright captured desktop candidate-cover, desktop paper, and mobile paper screenshots under ignored `test-results/phase3-exam-*` artifacts. The 390px mobile paper has no horizontal overflow. The exam is intentionally minimal and paper-oriented, distinct from the normal origami/Sakura interface.

## Remaining limitations and launch gates

1. **Section breaks:** No per-form break-duration schema or break screen/timer exists. Section advancement currently opens the next section directly. The prior blueprint recommends configurable 2-/5-minute breaks, but the section transitions and defaults still need owner decisions and implementation.
2. **Listening preflight:** The active payload and signed media URLs are loaded for the current section. Audio is not validated/prefetched before the listening section starts. The E2E journey verified an attached WAV can play and complete under the one-play policy; it did not simulate a real device/browser media failure and confirm the single recovery path end to end.
3. **Deadline finalization without a connected client:** The server enforces deadlines whenever an attempt RPC runs, and the open page refreshes at its deadline. There is no scheduled worker that finalizes an attempt while every client is closed.
4. **Navigation protection:** The in-app exit links ask for confirmation. Browser Back, tab close, and sign-out are not intercepted.
5. **Full route/action matrix:** E2E covers the main public routes, student login/dashboard/profile/library/leaderboard, the core content and publication flow, staff MFA/role denial, and an exam attempt. It does not click every action, filter, error state, or permission branch on every admin/student route.
6. **Content import formats:** ZIP ingestion and spreadsheet conversion are not supported; the tested import is a folder containing a manifest and media files.
7. **Content inventory:** The final local read-only inventory counted 0 forms for N1, N2, N3, and N4, and 22 for N5. N5 includes forms created by QA runs and is not a count of approved, rights-cleared launch papers. The audit does not verify question quotas, answer keys, media quality, rights, or independent review.
8. **Production integrations and policy:** Hosted OAuth/provider configuration, SMS, live payments, Google Sheets credentials, operational monitoring/backups, final support/legal policies, and restore drills remain to be staged and verified. No production credentials or changes were supplied in this phase.

## Owner decisions still needed

- Select break durations and which section transitions use them.
- Decide the candidate-number format and whether it stays optional or is generated per attempt.
- Approve the recovery/escalation policy after the one allowed listening recovery fails.
- Supply/approve rights-cleared complete exam inventory and reviewers for launch.
- Confirm hosted Google OAuth, SMS timing, payment/Google Sheets credentials, operational owner, and final legal/support policies.

## Change inventory

Application: `src/app/dashboard/page.tsx`, new `src/app/leaderboard/page.tsx`, `src/components/active-exam-session.tsx`, `src/components/i18n/site-header-items.tsx`, `src/lib/admin-navigation.ts`, `src/lib/i18n.ts`, `public/css/site.css`.

Database and QA: the three migrations above, `supabase/tests/phase3_leaderboard_preparation.test.sql`, `supabase/tests/rls_catalog.test.sql`, and `scripts/audit-supabase-schema.cjs`.

Quality/tooling: `tests/e2e/public.spec.ts`, `tests/unit/admin-navigation.test.mjs`, `eslint.config.mjs`, and `.gitignore`.
