# JLPT practice platform build plan

## Confirmed direction

- Product kind: software. Product: an independent JLPT preparation and mock-exam platform.
- Audience: learners preparing for JLPT N1–N5.
- Main action: **Choose a JLPT level**. The level selector shows the official test-section timing and scoring-category mapping.
- Hero: use only the latest supplied Sakura-tree video, rendered as a muted 1280×720 H.264 loop that plays forward and back. Show the full video frame in one unframed 16:9 space; do not crop or place a second tree image beside it. Use the supplied origami Sakura artwork (optimized WebP derived from the supplied PNG) as the poster and static fallback when playback is unavailable or reduced motion is requested.
- Copy and content: manually authored questions and explanations, with review before publication. No runtime AI or AI-generated study plans.
- Exam integrity: server-owned timers, deadlines, answer writes, grading, and answer-key release. Approved question revisions and published exam forms are frozen.
- Site system: Next.js App Router, TypeScript, Supabase PostgreSQL/Auth, accessible paper surfaces, and minimal exam screens.

## Taste Skill design plan

Kind: software (`data-type="software"`, `site-kind="software"`).

Palette: follow the user's Origami and Sakura direction throughout the public site: warm paper, blossom pink, and deep cherry ink. Use Shippori Mincho for display headings and Outfit for interface text; reserve DM Mono for timing metadata. Controls and feature surfaces use folded-corner cues and angular paper planes. Keep the exam screen focused on readable test-taking rather than decorative theme details.

Hero composition: split, copy on the left and the single full-frame animation on the right. The skill dealer returned `product`, `photo`, `film`, and `centred` on successive material-aware deals. Their recipes respectively require a product object, full-bleed photo, a video, or centered copy. The brief requires the tree with left-side copy; the supplied still is the video's poster and playback fallback.

The first nav deal was `nav-cards`, which requires several different product photographs. Only one brand image is supplied, so re-deal to `nav-split` with no image panel. The random selection gave `footer-dark`, `close-type`, `surface-pairs`, `pill`, and `arc`. Keep the paper palette, `footer-dark`, `close-type`, `surface-pairs`, and `arc`; use the crisp solid button treatment required by the product spec instead of the pill button.

Voice: facts only, instructional. Use JLPT terms consistently. State platform capabilities without pass guarantees, official-score claims, customer proof, prices, or publication status that has not been supplied.

## Page plan

1. Hero — one screen. JLPT mock-exam category and N1–N5 scope; one full-view Sakura-tree video on the right with the supplied still as fallback; primary action to the level selector, secondary action to the practice interface.
2. Practice interface — one screen. The actual product UI: a question view beside a review view. Any displayed question is an original interface preview and is not a published exam item.
3. Review process — one screen. Show the test → answer review → targeted practice flow. Use the `word-highlight` moment in this marketing section only; keep content visible without JavaScript and under reduced motion.
4. Level formats — one screen. N1–N5 selector, verified timed sections and score categories. Include the official JLPT source link.
5. Questions — one screen. Open FAQ answers; no accordion or invented testimonials.
6. Closing footer — one screen. Repeat the main action, show the independent-platform statement, and keep legal/policy links out until approved policy pages exist.

Navigation: signed-out visitors see account entry; signed-in learners see Dashboard and Account, with Staff shown only to authorized staff. The private `/admin/sign-in` entry is not linked from public navigation.

## Implementation order

1. Record the verified N1–N5 format matrix, logical data model, question schema, and content QA rubric.
2. Add the Supabase foundation migration with RLS, immutable reviewed content, frozen forms, attempts/results, payments, and audit tables.
3. Build the public experience and product-interface preview using the taste system, followed by the N5 exam vertical slice.
4. Keep unspecified plan/pricing, payment-provider, TOTP recovery policy, legal copy, and product-name values configurable until decided.

## Implementation checkpoint — 22 November 2026

- The homepage and N1–N5 section selector are in place, using the single latest Sakura hero video and the supplied still as its fallback.
- `/levels/[level]` shows the verified timed sections and score-category mapping for each level.
- The N5 preview flow covers details, instructions, a sample question workspace, a sample result, and answer review.
- The N5 flow is interface preview content only. It uses two original sample questions, browser-tab answer storage, an illustrative local timer, and a listening placeholder. It is not a published form or a saved attempt.
- The exam workspace uses a plain high-contrast layout. Public, level, result, and review pages use the Origami Sakura styling and reduced-motion-aware fold reveals.
- The authenticated exam vertical slice now has server-side attempt/timer actions in migration 006 and `/attempts/[attemptId]`. It is still unavailable to learners until the hosted migrations are applied and approved exam forms and media are published.

## Source checks

- Official JLPT sections and item types: <https://www.jlpt.jp/e/guideline/testsections.html>
- Official JLPT scoring sections and mappings: <https://www.jlpt.jp/e/guideline/results.html>
- Recheck these pages before launch; the JLPT notes that section times may change and listening time can vary with recording length.

## Browser review

On 23 November 2026, the full Taste Skill gate passed against local HTTP at 1440 and 390 px, with its 320 px tap-size check also passing. The only waiver is the final concise hero headline: the checker expands it to 45 characters even though the authored title visibly fits in three lines. There are four non-blocking warning types: the intentional `word-highlight` scroll moment; the level selector's visual coverage (23% on phone and 25% on desktop); generous whitespace between the questions section and footer; and questions-section content at 53.1% versus the checker’s 55% target. The run found no open failures in mobile contrast, split alignment, section height or section heading alignment. This is a visual consistency check, not complete accessibility or interaction acceptance; it does not exercise reduced-motion video fallback, media-loop/pause behavior, auth submissions, or the authenticated `/admin/reports` workflow. Do not serve pages through `file://`.

## Supabase and remaining product routes — 22 November 2026

- `.env.local` was copied from `.env.example` for local development and is ignored by Git. The project Auth health endpoint returned HTTP 200 using the publishable key.
- The app reads `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and keeps the older `NEXT_PUBLIC_SUPABASE_ANON_KEY` as a fallback. No service-role key is required by browser code.
- Added Supabase SSR cookie refresh, email/phone password registration and sign-in, email confirmation, SMS verification for new phone accounts, Google OAuth, password recovery, profile preferences, learner dashboard, account, mistake notebook, raw result and completed-attempt review routes.
- Added independent-platform information, a V7.2 free/premium access matrix and fixed-duration plan preview, and clearly marked legal draft routes. Prices and purchase actions remain disabled; payment instructions and legal terms remain unpublished until approved.
- Added role-gated staff pages for content, authoring/import, review, assets, blueprints, forms, payments, user roles, announcements, reports, support, and audit records. Privileged workflows use guarded database functions and audit events; hosted migration application and multi-role acceptance remain pending.
- The top navigation now shows only sign-in/sign-up while signed out, and Dashboard/Account while signed in. The Staff link appears only for authenticated staff; `/admin` also checks the database role server-side.
- Email signup uses a click-to-confirm token-hash page. Email/password and Google sign-in are enabled for the current testing setup. The phone/SMS path is behind `NEXT_PUBLIC_AUTH_ENABLE_PHONE=false` until the owner configures SMS.
- Added `supabase/migrations/202611220004_first_login_welcome.sql` for a one-time dashboard welcome message across email, phone, and Google-created accounts.
- Added `supabase/migrations/202611220002_auth_and_rls_hardening.sql` for profile/role provisioning, explicit RLS and API grants, a private media bucket, question review, and post-submission answer review. Added `supabase/migrations/202611220003_spec_alignment.sql` for explicit question families, shared-content group ordering, answer-to-form-item integrity, blueprint section durations, and immutable attempt form snapshots. The migrations still need to be applied in the hosted Supabase project after checking migration history; see `docs/supabase-setup.md`.
- `/exams/n5/preview` remains a browser-only demonstration. It is deliberately separate from the saved-attempt, timer, answer-write, and grading workflow.

## V7.2 blueprint gap review — 22 November 2026

The V7.2 blueprint is the current product source of truth. Its proposed defaults may power labeled previews, but they do not replace owner decisions. This repository is a working foundation, not a launch-complete platform.

### Built or partially built

- Public home, N1–N5 level information, Origami Sakura identity, about page, and draft legal routes. Pricing now presents the V7.2 proposed matrix and 30/90/365-day plan structure with pending prices and disabled purchases.
- Email/password and Google sign-in flows, learner dashboard/account shell, mistake notebook, raw result and answer-review routes. Phone/SMS UI is disabled by default pending provider setup.
- The N5 preview itself remains a local interface demo and does not create a database attempt. A separate attempt flow is ready for approved, published frozen forms after hosted migrations are applied.
- Role-gated admin overview and workflows for question authoring, atomic JSON draft import, reviewed assets, blueprint approval, frozen exam-form assembly/publication, account roles, support and audit history are implemented locally. Hosted database application and end-to-end acceptance remain pending.
- Supabase migrations 001–033 define the local schema/RLS implementation and 41 expected public application tables, plus private MFA and payment-sync state. Migration 025 adds AAL2 enforcement to staff role helpers and the `/admin/mfa` TOTP enrollment/challenge flow. Migrations 026 and 031 add optional private payment receipts and support screenshots; uploads use server-side decoding/resizing/re-encoding and audited five-minute viewing links when the server-only service credential is configured. Migration 033 adds the disabled-by-default Sheets outbox/worker. The latest read-only probe on 23 November found 30 of 41 expected public table names present and 11 missing; see [`supabase-setup.md`](supabase-setup.md) for the list. The hosted migration ledger and full function/RLS state are not verified. Reconcile the authenticated Supabase migration ledger before applying anything. Do not run the full sequence or migration 001 blindly.
- A private `/admin/sign-in` entry reuses the regular identity providers and checks existing staff roles before opening `/admin`. It is deliberately absent from public navigation and does not create a separate admin credential system.
- Student support tickets, staff replies/status changes with an audit trail, and the private in-app notification inbox are implemented in migration 005 and the `/support`, `/notifications`, and `/admin/support` routes. Support replies/status changes, published admin announcements, and finalized exam results produce idempotent in-app notices. Payment and account event producers and outbound email delivery remain to be connected.
- The admin-only integration settings route reports configuration presence and the private payment outbox status without displaying secret values. The Google Sheets writer, stable-ID upsert, sync event log, admin retry controls, approved-payment reconciliation and daily cron worker are implemented locally; keep the feature disabled pending the owner destination, authorized-account list, service-account sharing and staging acceptance.
- Vercel `*.vercel.app` is the current shared testing origin. Supabase redirects and Google OAuth origins must be kept aligned with that exact host; the final production domain is pending.
- Public `/faq`, `/how-it-works`, and `/contact` pages now explain current availability and route learners to the existing private support inbox.
- Learner `/exams` library and `/exams/[formId]` details read published Supabase forms and start an attempt only through the server-owned access/deadline checks. `/progress`, `/payments`, and `/subscription` show per-account records only.
- Migration 006 and `/attempts/[attemptId]` add server-owned start, per-section deadlines, answer autosave/flagging, refresh/resume, early section advance, confirmed submission and raw grading for published frozen forms. Correct answers are still released only through the completed-attempt review function. Published form content and the hosted migration are required before learners can use this path.
- `docs/staging-launch-runbook.md` records the hosted setup sequence, manual acceptance walkthrough and production release gates. It is a checklist for later verification, not evidence of hosted end-to-end QA.
- `/admin/questions/new` creates drafts manually or from an atomic JSON batch, supports private media attachment, and submits question and asset records to separate peer-review queues; it also links a clearly labeled original N5 example.
- `/settings` now links profile, security, notifications and privacy request areas. Staff TOTP setup and AAL2 gating are implemented locally. Learners can revoke other Supabase sessions from `/settings/security` while preserving the current session; an existing access token may remain valid until expiry. Learner TOTP step-up is implemented locally; hosted hook activation, recovery-contact ownership, rate-limit review and account-deletion fulfillment remain pending. `/settings/privacy` downloads a private JSON export of the signed-in learner's own profile, practice/exam activity, preferences, inbox, public support messages, bookmarks, payments and entitlements. Account deletion remains a verified support handoff pending the approved retention policy and deletion backend.

### Remaining implementation and launch gates

- **Learner delivery and privacy:** optional outbound email and its event producers remain off until a provider and copy are approved. Privacy export, deletion-request intake, session controls, and learner TOTP setup are implemented locally. Account-deletion fulfillment and support/receipt attachment retention require owner-approved policy; malware scanning is not connected. Payment checkout stays closed until verified recipient details, priced active plans, and payment/access rules are approved.
- **Admin operations:** suspension, recovery, profile correction, complimentary access, general operational writes, email delivery, rate limits, and maintenance controls are not exposed until policies and secure provider paths are approved. Read-only status templates, role-gated admin workflows, account/entitlement/attempt views, reports, authoring/review, staff TOTP, payment operations, and the disabled Sheets outbox are implemented locally. Hosted migration reconciliation, role-boundary acceptance, and the Sheets destination, authorized account list, and service-account sharing remain pending.
- **Content and real exam availability:** the server-authoritative attempt lifecycle and frozen-form workflows are implemented locally. The current configured project returned zero published forms at N1–N5. Reviewed original questions, keys, listening media, provenance/licensing, complete forms, hosted schema, and staging end-to-end acceptance are required before learners can take saved exams. The separate N5 preview remains a browser-only demo.
- **Bilingual coverage:** learner-facing English/Bangla coverage includes the public home page and JLPT timing selector, navigation, dashboard/account/settings, auth/recovery, support and notifications, exam library and attempt controls, results/review, practice, and payment/access views. Remaining student/admin content and human-reviewed translations still need completion; Japanese prompts and supplied sample explanations remain in their authored language.
- **Security and operations:** hosted verification of learner TOTP step-up and staff MFA, rate limits, full authorization/RLS checks, separate staging/production configuration, monitoring, backup/restore, and launch QA remain. TOTP is implemented locally, but its migration and Supabase Custom Access Token Hook are not active in the hosted project. GitHub quality CI run [45206504959](https://github.com/shafayatsaad/JLPT-LMS/actions/runs/45206504959) passed clean migration replay and database policy tests; this does not verify the hosted project. Local Docker was unavailable for replay. Vercel remains the testing origin, not the production domain.
- **Public and legal:** public home, level guides/directory, about, FAQ, how-it-works, contact routing, and legal draft routes exist. Approved legal copy, support contact, final product name, and production domain remain owner inputs.

### Decisions that block live payment collection

The local workflow supports bKash Send Money, fixed-duration plan templates, and reporting exports. Recipient name/number, final plan prices/access matrix, reference requirements, review SLA, refund/access policy, evidence retention, staff assignments and Sheets destination/authorized accounts remain unresolved. Keep checkout and payment-derived premium grants disabled until the relevant details and operations are ready. Never substitute sample payment details or grant access from a submitted form.

### Continuation order

1. Reconcile the live migration ledger and the read-only `npm run supabase:audit` output. Apply only unapplied migrations in numeric order, then validate auth, tagged authoring, bookmarks, profile and notification preferences, announcements, result notices, the mistake notebook, targeted practice, payment-report role boundaries, question editing, attempt monitoring, privacy requests, audit search and attempt lifecycle, dashboard role summaries and audit search with reviewed staging content.
2. After migrations 022-033 are reconciled and applied, complete payment, receipt, account-detail, entitlement-inventory, staff MFA, question-editing, attempt-monitor, privacy-request, dashboard-summary, support-attachment and Sheets outbox acceptance using the staging runbook. Keep checkout off until the owner supplies verified bKash details and approved plan settings. Keep Google Sheets sync disabled until the destination, account list and service account are ready. Add the service-role key only to the server-side environment for private image uploads and the sync worker; the admin integration page reports presence without validating the credential or buckets.
3. Populate and human-review a representative N5 form, including answer keys and listening assets, before opening learner attempts.
4. Complete the remaining bilingual UI/content, operational recovery and production hardening before public launch.

## Continued build checkpoint — 23 November 2026

- Added the authenticated attempt screens and migration 006, including exact blueprint quota, level, answer-key, media and section-duration checks. Shared passage content is rendered in the timed session.
- Added migration 007 and an in-app question draft editor with author submission and a reviewer queue showing the item, key, explanation and provenance.
- Added migration 008 and private question-asset upload, attachment, submit-for-review and reviewer preview/decision flows.
- Added an original N5 authoring example and field guide. At this checkpoint it was labeled as a draft reference; batch import was still pending.
- Updated learner-facing availability copy and added `docs/staging-launch-runbook.md` for the hosted schema setup, manual acceptance walkthrough and production gates.
- `npm run build` completed successfully after the authoring and asset-review UI changes. At that checkpoint, the hosted Supabase database still needed migrations 001–008 and reviewed demo content; no hosted end-to-end QA or production deployment was recorded.

## Content-to-form workflow checkpoint — 23 November 2026

- Migration 009 adds audited blueprint draft creation/submission and independent reviewer approval, plus guarded form assembly, validation and frozen publication. It adds no tables; the application table count remains 31.
- The blueprint workspace provides editable slot structure and a review queue. The starter row is explicitly a structural draft scaffold; full JLPT item quotas and content decisions still require human completion.
- The form workspace selects an approved blueprint and approved questions, limits selection to each required slot quota, sets free/premium access, and submits draft forms for independent validation/publication.
- Database validation checks same-level approved content, exact slot quotas, valid answer keys, approved required media, consistent positive section timing and the approved blueprint. Start-attempt validation remains in place as a second server-side gate.
- The hosted Supabase project still needs migrations 001–011 and reviewed original staging content. No hosted schema changes, manual account-flow acceptance or production deployment are recorded here.

## Admin role management checkpoint — 23 November 2026

- Migration 010 adds a private admin account directory plus grant/revoke operations for staff roles. The admin users page can find accounts by email or UUID and change staff access through an audited RPC.
- The database rejects unknown accounts, blocks student-role changes through this control, serializes administrator-role changes, and prevents revoking the final admin. Initial admin provisioning remains a one-time SQL Editor action.
- The hosted Supabase project still needs migrations 001–011 before these controls can work. Payment verification and other money-related operations remain disabled pending the owner decisions listed in [`decisions-needed.md`](decisions-needed.md).

## Question batch import checkpoint — 23 November 2026

- Migration 011 adds atomic import of up to 100 question drafts through the existing validated authoring function. Each item retains answer-key validation, provenance checks, author ownership and its own audit event; any invalid item rolls back the batch.
- The authoring page previews JSON items before import and supports the supplied single-question example, a top-level list, or a `questions` list. Import never approves content or attaches media.
- The staging runbook now includes batch rollback checks. The feature is locally compiled, but remains unavailable on the hosted database until migrations 001–011 are applied.

## Learner language and bookmarks checkpoint — 23 November 2026

- Migration 012 adds the `profiles.ui_language` preference and updates first-party profile provisioning to accept the validated English/Bangla signup preference. The app remembers the preference locally, syncs it to signed-in profiles, and carries it through Google OAuth via a same-site cookie.
- The language selector and dictionary now cover public navigation, dashboard, account/profile, core settings and email/Google auth/recovery flows. The remaining account services and exam flows are still to be translated before the bilingual launch gate.
- Migration 013 creates `user_bookmarks` with learner-only RLS. Learners can save approved/exam-eligible questions from completed answer reviews and remove them from `/bookmarks`; active exam payloads remain answer-key-free.
- `npm run build` passed after the language, auth, and bookmark changes. The hosted Supabase project still needs migrations 001–013, reviewed content, and manual hosted acceptance; nothing in this checkpoint indicates hosted database changes or a production deployment.

## Skill-tag authoring checkpoint — 23 November 2026

- Migration 014 adds an audited function for assigning up to eight skill tags to an editor's own question draft. Submitting an untagged question for review is rejected at the database boundary.
- The manual authoring form accepts comma-separated tag slugs. Atomic JSON batch imports now require and attach tags for every question; the supplied original N5 example includes `vocabulary` and `kanji-reading` tags.
- This creates the content foundation for the V7.2 “practice similar skill” flow. Targeted practice sessions and mistake filters remain to be built.
- No table was added. The application schema remains 32 tables. The hosted Supabase project still needs migrations 001–014; local build and staging acceptance do not establish hosted readiness.

## Targeted-practice checkpoint — 23 November 2026

- Migration 015 adds two private learner tables and owner-checked RPCs for a five-question practice set, idempotent start, saved answers, submission grading, result review and recent-session listing.
- The practice picker lists only level/skill pairs with at least five approved or exam-eligible questions that have valid answer keys and no attached or inline media. Recently used items rank after alternatives from the prior seven days.
- `/practice` selects a level and tag, `/practice/[sessionId]` supports saved answers and refresh/resume, and `/practice/[sessionId]/review` exposes correct answers and approved explanations only after submission. The flow is available in English and Bangla and links from the learner dashboard.
- The UI labels this as a diagnostic preview. Listening/media practice and final free/premium usage limits still depend on reviewed assets and owner-approved access settings.
- `npm run build` completed successfully with all three practice routes. The local build does not validate SQL execution; the hosted Supabase project still needs migrations 001–015 and the manual acceptance checks in the staging runbook. The application schema now contains 34 tables.

## Mistake-notebook checkpoint — 23 November 2026

- Migration 016 adds a private learner review marker and an owner-scoped RPC over completed exam attempts. It excludes unanswered items, reports a learner's most recent incorrect answer and all-time wrong count, and exposes the original reviewed explanation.
- `/mistakes` now filters by level, skill tag, item type, date range and review status. Each item can be marked reviewed or reopened, bookmarked independently, opened in its full attempt review, or used to start practice at the same level and skill.
- The full attempt review supports question anchors, and targeted practice accepts a preselected level/tag from the notebook.
- The schema now contains 35 application tables. Migration 016 remains local until applied to the hosted Supabase project; SQL execution and manual multi-account acceptance are still required.

## Student display-preferences checkpoint — 23 November 2026

- Migration 017 adds a validated IANA time zone and reduced-motion preference on the existing profile row; it adds no tables, so the schema remains at 35 application tables.
- The account form saves these values to Supabase. Reduced motion is also cached locally and applied to transitions, animation and smooth scrolling; the account, dashboard, practice history and mistake notebook format dates in the saved time zone.
- The mistake notebook passes local date boundaries and the selected IANA zone to its private RPC so date filters work across daylight-saving changes.
- This preference slice compiles locally. Migration 017 and its profile timezone checks remain unverified in the hosted Supabase project.

## Notification-preferences checkpoint — 23 November 2026

- Migration 018 adds an owner-scoped notification-preference table and read/write RPCs. Optional in-app exam/service categories can be hidden. Email learning and product-news choices default off and record opt-in timestamps.
- `/settings/notifications` stores those choices in the authenticated account. Required security, authentication, payment and support notices remain visible. The inbox localizes known event types and status updates in English and Bangla, and formats notice times in the learner's saved time zone.
- The UI states that outbound email is not configured. No email is sent, and optional exam/service notice producers are not yet connected; those controls are ready for the later producer/email-provider work.
- The schema now contains 36 application tables. Migration 018 and all prior changes remain local pending hosted migration application and account-isolation acceptance.

## Admin-announcement checkpoint — 23 November 2026

- Migration 019 adds an admin-only announcements table and guarded RPCs to list, create, edit and publish bilingual notices. Draft edits and publication write `admin_audit_events`; published messages are immutable.
- Publishing inserts one `service_announcement` inbox record per learner with the optional service category enabled. `source_announcement_id` and a unique recipient index make retries idempotent. English and Bangla titles/bodies are stored with the inbox record. No email is sent.
- `/admin/announcements` is visible only to admins and includes a bilingual draft queue, edit form, publish confirmation and published-recipient count.
- The schema now contains 37 application tables. Migration 019 remains local, so publication authorization and delivery behavior still need hosted staging acceptance.

## Payment report export checkpoint — 23 November 2026

- Migration 020 adds the expected-amount snapshot and optional payment fields missing from the report template, plus an append-only export log. Existing rows are backfilled from their current plan; any future submission RPC must capture the plan amount at submission time. Its guarded RPC supplies payment reviewers/admins with date-filtered rows, masks sender numbers by default, allows unmasking only to admins, caps reports at 20,000 rows, and audits format, date range, row count and unmasking.
- `/admin/reports` offers CSV and XLSX download from the signed-in server route. The export is a database reporting copy and cannot approve a payment or change entitlements. Migration 033 adds the Google Sheets queue and sync status while retaining disabled-by-default behavior pending owner setup.
- Dependency audit found a moderate advisory in ExcelJS's transitive `uuid` dependency; the lock now overrides it to patched `uuid@11.1.1`. `npm audit` reports zero vulnerabilities after the override.
- Migration 020 has not been applied to Supabase. The new export flow still needs the role/privacy acceptance steps in `staging-launch-runbook.md` against the hosted project.

## Result notification checkpoint — 23 November 2026

- Migration 021 adds an idempotent, bilingual `result_ready` inbox notice when an exam result is finalized. It respects each learner's optional exam-update preference and links to the matching result route.
- The preference filter now includes result-ready and attempt-submitted notices along with exam publication/update notices. No outbound email is sent; the schema remains at 38 application tables.
- Migration 021 is local only. The result-notice delivery and preference cases have been added to the staging acceptance runbook; hosted database behavior remains unverified until migrations 001–021 are applied.

## Learner workflow localization and keyboard navigation — 23 November 2026

- Localized the active timed-exam controls, progress/status labels, item types, submission confirmations, offline/saving feedback and learner-safe error messages in English and Bangla. Result summaries, score-category labels, answer-review controls, bookmarks, the N5 preview flow and empty/error states are localized too. Japanese prompts, choices and authored explanations remain unchanged. A language selector is available in the exam toolbars and changing it does not change the server-owned attempt state or the demo's browser-tab storage.
- Localized the support center, ticket list/detail, learner replies, support status labels and date formatting. Learner-facing errors no longer display raw database messages.
- Moved the global skip link before the logo so it is the first keyboard stop, and made the target main regions focusable. The timed exam has its own skip link to the question workspace.
- `npm run typecheck` and `npm run build` pass after these changes. Hosted Supabase behavior is still unverified; bilingual workflows and keyboard navigation are included in the staging acceptance checklist.

## Reproducible build checkpoint — 23 November 2026

- Replaced floating `latest` dependency declarations with the exact versions already resolved in `package-lock.json`; pinned the project to Node 22.21.1 and npm 10.9.4.
- Added `npm run typecheck`, a read-only GitHub Actions pull-request/push gate, and [`ci-and-environments.md`](ci-and-environments.md). CI installs from the lockfile, checks npm advisories, builds and type-checks without Supabase secrets or deployment permissions.
- `npm run build` and `npm run typecheck` both pass locally. The workflow does not apply hosted migrations, verify account isolation, or replace the staging acceptance and release checklist.

## Payment and access localization — 23 November 2026

- Localized the learner payment-history and subscription/access pages in English and Bangla, including empty/error states, payment-status labels, currency/date formatting and saved-time-zone date display.
- Payment history remains read-only. Checkout, bKash recipient details, plan prices and entitlement changes stay disabled or unavailable pending owner approval; no payment instructions or records were invented.
- `npm run typecheck` passes after the localization change. Hosted payment operations and full bilingual review remain outstanding.

## Pricing preview localization — 23 November 2026

- Localized the proposed access matrix and 30/90/365-day plan preview in English and Bangla. Plan names and access descriptions remain centralized in the proposal catalog and are clearly labeled as unapproved previews.
- Purchases remain disabled. No prices, bKash details or access promises were added.

## Exam library and progress localization — 23 November 2026

- Localized the published exam library, form details, start/resume controls, progress table, statuses, raw result counts and empty/error states in English and Bangla.
- Publication and attempt dates now use the learner's saved time zone and selected language. Exam-start errors show safe learner-facing messages instead of raw database text.
- Active attempts and result access remain protected by the existing user-scoped Supabase queries and server/database rules; the hosted access checks still need staging acceptance.

## Manual payment operations — 23 November 2026

- Added migration 022 with a blank, default-disabled bKash settings row; zero-price inactive 30/90/365-day plan templates; immutable plan snapshots; and server-side request, idempotency, one-pending-request, transaction-duplicate, cancellation, reviewer, audit, bilingual in-app notice and transactional entitlement-extension operations.
- Added the authenticated bKash request screen and Zod-validated no-store route. It only displays recipient details when database configuration is enabled and a priced active plan exists. Added cancellation requests to learner history.
- Added admin plan/settings/payment-review screens and a direct `/admin/payments/[paymentId]` review route. The queue masks sender numbers, explicit reveal writes an audit event, reviewers cannot review their own request, rejection requires safe English and Bangla copy, and approval uses a single guarded RPC. If a learner requests cancellation after sending payment, the reviewer can verify the funds, approve the request and resolve cancellation in the same audited transaction.
- The work is local only. Migration 022 has not been applied or SQL-validated against the hosted database. Checkout remains disabled by default; no recipient, prices, receipt upload, email delivery or production payment promises have been added.

## Admin account detail checkpoint — 23 November 2026

- Added migration 023 and `/admin/users/[userId]`, a read-only account summary for admins with verification state, profile, roles, exam attempts/results, payment requests, entitlements, support tickets and account-level audit events. Opening a record writes an audit event; secrets, sender numbers and transaction IDs are excluded.
- Linked the account directory to detail pages and added the RPC to staging diagnostics and acceptance steps. Suspension/reactivation, recovery actions, profile corrections and complimentary access remain unavailable pending approved policies and server credentials.
- TypeScript and production builds pass. Migration 023 is local only and has not been validated against the hosted PostgreSQL project.

## Admin entitlement inventory checkpoint — 23 November 2026

- Added migration 024 and `/admin/entitlements`, an admin-only filtered inventory of active, scheduled, expired, cancelled and revoked access records with account and source-payment links. Directory views are audited.
- Kept grant/revoke actions unavailable until reason, duration, permission and complimentary-access policies are approved. Updated Supabase setup, diagnostics, and staging acceptance documentation.
- Migrations 024–025 are local only. Hosted schema, AAL2 role checks and function behavior are still unverified.

## Admin settings readiness templates — 23 November 2026

- Added `/admin/settings` plus general, security, email, notification and maintenance status pages. They distinguish Supabase-managed auth mail from app mail and identify remaining staff MFA/risk-step-up verification work. Maintenance remains disconnected; Google Sheets writes are implemented behind owner configuration and a disabled flag.
- Each page is admin-only and read-only; configuration secrets are not displayed and pending owner/provider decisions are named. No database migration was needed.

## Staff MFA checkpoint — 23 November 2026

- Added `/admin/mfa` with TOTP enrollment for staff accounts that do not yet have a verified factor and a TOTP challenge for subsequent AAL1 staff sessions. Redirects are restricted to local `/admin` paths.
- Added migration 025 to require AAL2 in private staff role helpers, so direct staff RPC/RLS access is gated as well as page rendering. Student-only checks remain usable at AAL1.
- Updated the security settings status, staging runbook and database diagnostics. TOTP still needs to be enabled in Supabase Auth and migration 025 needs to be reconciled/applied to the confirmed staging project before claiming hosted enforcement. SQL has not been run against hosted PostgreSQL.

## Private payment receipt checkpoint — 23 November 2026

- Migration 026 adds a private receipt bucket, size/MIME restrictions, owner-bound upload reservation/attachment, and audited receipt access for admin/payment reviewers using five-minute signed links.
- Added a payment form image picker with a 4 MB limit, input signature checks, image decode/pixel/page limits, resize and WebP re-encoding. A failed optional upload can be retried without creating a second payment request. Receipts do not approve or grant access.
- Added staging acceptance steps and database diagnostics. Migration 026 is local only; external malware scanning and receipt expiry/deletion are not connected, hosted SQL/storage behavior remains unverified, and the owner still needs to approve retention.


## Admin attempt monitoring and question editing — 23 November 2026

- Added migration 027 and `/admin/attempts`, an audited read-only monitor that shows attempt timing, section progress and answer counts without selected answers.
- Added migration 028 and question library/detail/edit pages, plus a read-only form manifest. Authors and admins can edit only draft questions; submitted content is immutable.
- Added staff acceptance steps and database function diagnostics. Both migrations are local only; reconcile the hosted ledger and verify role boundaries before relying on these workflows.


## Account deletion request intake — 23 November 2026

- Added migration 029 with owner-scoped privacy-request intake, withdrawal, audited admin status tracking, and `/admin/privacy`. The data export now includes the learner's request history.
- The workflow explicitly does not delete accounts. Identity verification, retention exceptions and fulfillment remain owner-approved operational policy; all SQL remains local until migration history is reconciled.


## Admin dashboard summary — 23 November 2026

- Added migration 030 and a role-filtered `/admin` operational summary: pending reviews, payments and support are shown only to the roles that can act on them; admins also see aggregate account/access counts and recent audit activity. Published forms are grouped by JLPT level.
- Backup and restore status is called out as unverified until provider configuration and a restore drill are recorded. The function adds no tables and remains local pending hosted migration reconciliation and role acceptance.


## Private support attachments — 23 November 2026

- Added migration 031, an optional private screenshot upload for support replies, server-side image signature/decode validation and WebP re-encoding, owner/staff authorization, five-minute signed viewing, and audited attachment access. Learner data export includes attachment metadata.
- Hosted SQL is still local/unverified. External malware scanning and the owner-approved retention/deletion schedule are required before production use; support text replies continue to work when migration 031 is unavailable.

## Learner session controls and level directory — 23 November 2026

- Ordinary sign-out now explicitly ends only the current browser session. `/settings/security` offers a confirmed action to revoke other Supabase sessions while keeping the current one active; the English/Bangla notices explain that already-issued access tokens can remain valid until expiry.
- Added the missing `/levels` public directory, built from the shared N1–N5 timing data, with links to each level guide and an accurately labeled browser-only N5 preview. The home level section now links to the directory.
- `npm run typecheck` and `npm run build` pass. Hosted session behavior has not been exercised against the configured Supabase project.

## Published exam inventory audit — 23 November 2026

- Added `npm run supabase:content-audit`, a read-only public-schema check that counts published exam forms by JLPT level and compares them with V7.2's three-form launch target. It requests no learner data and prints no form IDs.
- The configured project returned zero published forms at all five levels. The command exits nonzero until each level reaches the count target; this count alone does not establish item completeness or content approval.

## Learner TOTP step-up checkpoint — 23 November 2026

- Added `/auth/continue`, `/auth/mfa`, and `/settings/security` TOTP enrollment/challenge/management flows. Email/password and Google remain first factors; accounts without a verified TOTP factor continue without the challenge.
- Added migration 032 with a private 30-day trusted-device registry (hashed tokens), Supabase Custom Access Token Hook and owner-scoped registration/revocation RPCs. Verified-factor AAL1 sessions receive the `anon` Data API role until TOTP verification or trusted-session refresh. Service-backed account/export/upload routes use the same step-up decision.
- `npm run typecheck` and `npm run build` pass. This is local only: hosted migration history is unreconciled, the Auth Hook is not enabled or tested in Supabase, and recovery policy plus manual Preview acceptance remain open.

## Quality automation checkpoint — 23 November 2026

- Added ESLint flat configuration, eight Node unit tests for JLPT timing, N5 demo scoring, access-catalog previews and EN/BN dictionary parity, and seven Playwright smoke checks for language switching, the hero video/poster, mobile framing, reduced motion, level navigation, N5 demo labeling and Google sign-in entry. Added ten axe-core WCAG A/AA scans across the home in English and Bangla, N5 guide, N5 preview and sign-in pages at desktop and mobile widths.
- Added Supabase pgTAP tests for RLS enabled across all 41 exposed application tables and learner cross-account isolation for profiles, roles, attempts, results, answers, notifications, support tickets/messages/attachments, notification preferences and privacy requests; answer keys remain inaccessible to learner API roles. GitHub Actions now runs the policy tests after a clean local migration replay.
- Local verification passed: production build, TypeScript, lint (zero errors; framework/image/navigation warnings remain), unit tests (8/8), production Playwright suite (19/19, including twelve axe scans), `npm audit` (zero findings), and `supabase config validate`. The axe pass corrected the word-highlight paragraph semantics/contrast and footer CTA overlap found in the first scans.
- GitHub Actions run [45206504959](https://github.com/shafayatsaad/JLPT-LMS/actions/runs/45206504959) passed both jobs: clean Supabase migration replay and 80 pgTAP database tests, plus lint, units, TypeScript, production build and browser checks. Local Docker Desktop remains unavailable. This verifies a clean disposable CI database only; it does not establish hosted migration history, hosted RLS/function state, provider configuration, or staging acceptance.
- CI uses Node 24-compatible major releases of checkout, setup-node and upload-artifact, and the migration replay command no longer passes the deprecated redundant `--local` option. The updated CI run completed without the former Node 20 runtime warning. These checks do not replace hosted staging acceptance, the full role matrix, or the owner/content launch gates above.

## Public home localization checkpoint — 23 November 2026

- Localized the public home, about, FAQ, how-it-works, contact, level directory, and N1–N5 guide copy in English and Bangla. The home keeps its server-rendered account navigation, origami layout, full-view Sakura media, and shared language switch.
- Localized the learner sign-in verification, TOTP challenge and step-up setup screens in English and Bangla. The interactive N5 preview and authenticator controls already use the shared bilingual copy; a fluent human review of Bangla remains a launch gate.
- Localized the legal draft labels and review checklist in both languages. The pages still state that the copy is not approved for publication; no legal terms were invented.
- Added browser checks for in-place language switching and saved Bangla preferences across public information, level-guide, and legal-draft routes. The production build passed; all 19 Playwright checks passed, including twelve desktop/mobile axe scans. Desktop and mobile Bangla screenshots were reviewed for wrapping and overflow.
- Legal text still needs owner/legal review. Audit any remaining learner-facing copy and have a fluent reviewer approve Bangla before launch. V7.2 allows the admin interface to launch in English first.
