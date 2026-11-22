# JLPT practice platform build plan

## Confirmed direction

- Product kind: software. Product: an independent JLPT preparation and mock-exam platform.
- Audience: learners preparing for JLPT N1–N5.
- Main action: **Choose a JLPT level**. The level selector shows the official test-section timing and scoring-category mapping.
- Hero: use only `kling_20261122_VIDEO_Animate_th_2406_0.mov` as the moving hero media, rendered as a muted 1280×720 H.264 loop that plays forward and back. Show the full video frame in an unframed 16:9 space; do not crop or mask it. Use the supplied origami Sakura artwork (optimized WebP derived from the supplied PNG) as the video poster and the static fallback when playback is unavailable or reduced motion is requested.
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

1. Hero — one screen. JLPT mock-exam category and N1–N5 scope; static Sakura image on the right; primary action to the level selector, secondary action to the practice interface.
2. Practice interface — one screen. The actual product UI: a question view beside a review view. Any displayed question is an original interface preview and is not a published exam item.
3. Review process — one screen. Show the test → answer review → targeted practice flow. Use the dealt `line-carries-colour` moment in this marketing section only; keep content visible without JavaScript and under reduced motion.
4. Level formats — one screen. N1–N5 selector, verified timed sections and score categories. Include the official JLPT source link.
5. Questions — one screen. Open FAQ answers; no accordion or invented testimonials.
6. Closing footer — one screen. Repeat the main action, show the independent-platform statement, and keep legal/policy links out until approved policy pages exist.

Navigation words: Practice, Review, Levels, Questions. Every link lands on a real section.

## Implementation order

1. Record the verified N1–N5 format matrix, logical data model, question schema, and content QA rubric.
2. Add the Supabase foundation migration with RLS, immutable reviewed content, frozen forms, attempts/results, payments, and audit tables.
3. Build the public experience and product-interface preview using the taste system, followed by the N5 exam vertical slice.
4. Keep unspecified plan/pricing, payment-provider, OTP, policy, and product-name values configurable until decided.

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

Use the Taste Skill checker, layout checker, screenshot runner, performance checker, and finish gate against the local Next.js HTTP page. Do not serve the page through `file://`.

## Supabase and remaining product routes — 22 November 2026

- `.env.local` was copied from `.env.example` for local development and is ignored by Git. The project Auth health endpoint returned HTTP 200 using the publishable key.
- The app reads `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and keeps the older `NEXT_PUBLIC_SUPABASE_ANON_KEY` as a fallback. No service-role key is required by browser code.
- Added Supabase SSR cookie refresh, email/phone password registration and sign-in, email confirmation, SMS verification for new phone accounts, Google OAuth, password recovery, profile preferences, learner dashboard, account, mistake notebook, raw result and completed-attempt review routes.
- Added independent-platform information, a V7.2 free/premium access matrix and fixed-duration plan preview, and clearly marked legal draft routes. Prices and purchase actions remain disabled; payment instructions and legal terms remain unpublished until approved.
- Added role-gated staff pages for content, authoring/import, review, assets, blueprints, forms, payments, user roles, and audit records. Question-review decisions use a transactional Postgres function; other privileged operations remain unavailable until their server actions are implemented.
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
- Role-gated admin overview and inventory pages; editors can create question drafts with provenance, upload private audio/images, and submit content for separate review. Reviewers see question keys and rights notes and can preview/review assets. JSON import and form/blueprint operations remain unimplemented.
- Supabase migrations 001–009 define the core schema and current RLS/auth foundation. The hosted testing project was last confirmed to have no application tables; apply all nine migrations there before using database-backed features.
- A private `/admin/sign-in` entry reuses the regular identity providers and checks existing staff roles before opening `/admin`. It is deliberately absent from public navigation and does not create a separate admin credential system.
- Student support tickets, staff replies/status changes with an audit trail, and the private in-app notification inbox are implemented in migration 005 and the `/support`, `/notifications`, and `/admin/support` routes. At present, support replies and status changes are the notification producers; payment, exam, and account event producers remain to be connected.
- The admin-only integration settings route shows whether server-side Google Sheets environment fields are present. It does not read/write Sheets; sync remains disabled pending the owner destination, authorized-account list, and server sync worker.
- Vercel `*.vercel.app` is the current shared testing origin. Supabase redirects and Google OAuth origins must be kept aligned with that exact host; the final production domain is pending.
- Public `/faq`, `/how-it-works`, and `/contact` pages now explain current availability and route learners to the existing private support inbox.
- Learner `/exams` library and `/exams/[formId]` details read published Supabase forms and start an attempt only through the server-owned access/deadline checks. `/progress`, `/payments`, and `/subscription` show per-account records only.
- Migration 006 and `/attempts/[attemptId]` add server-owned start, per-section deadlines, answer autosave/flagging, refresh/resume, early section advance, confirmed submission and raw grading for published frozen forms. Correct answers are still released only through the completed-attempt review function. Published form content and the hosted migration are required before learners can use this path.
- `docs/staging-launch-runbook.md` records the hosted setup sequence, manual acceptance walkthrough and production release gates. It is a checklist for later verification, not evidence of hosted end-to-end QA.
- `/admin/questions/new` creates a draft, supports private media attachment, and submits question and asset records to separate peer-review queues; it also links a clearly labeled original N5 example. Batch import remains pending.
- `/settings` now links profile, security, notifications and privacy request areas. Security controls are transparent about pending MFA/session workflows; privacy export/deletion is a support handoff template pending the approved policy and backend workflow.

### Still to build

- **Student shell:** bookmarks, targeted practice, complete security/preferences/privacy workflows, payment submission and subscription operations, and optional private support attachments. Read-only exam library/details, server-authoritative attempt lifecycle, progress, payment history and subscription records are present. Notifications and support conversations are implemented as the first account-services slice.
- **Admin operations:** payment reconciliation and approval, user detail/actions, staff-role management, plan management, announcement queue, functional settings and exports remain. Question, asset, blueprint and exam-form authoring/review operations are implemented with guarded RPCs and audit events; hosted database application and end-to-end QA remain.
- **Real exam loop:** core attempt start, deadlines, autosave/resume, submission, raw grading and result generation are implemented over approved frozen forms. Blueprint and form workflows can prepare those forms, but the hosted schema, reviewed source content, operational evidence and end-to-end QA are still needed. The separate N5 preview remains a local demo.
- **Bilingual experience:** English and Bangla student interface and approved translated content support.
- **Security and operations:** risk-based login step-up, mandatory staff MFA, rate limits, complete authorization/RLS verification, CI, staging/production separation, monitoring, backup/restore, and launch QA. Vercel testing is active; production hardening remains open.
- **Public routes:** any remaining product-detail pages and final approved legal/contact copy from V7. FAQ, how-it-works, and contact routing now exist.

### Decisions that block payment implementation

The blueprint confirms bKash Send Money, optional proof upload, fixed-duration plans, and reporting exports/Sheets. Recipient name/number, final plan prices/access matrix, reference requirements, review SLA, refund/access policy, evidence retention, staff assignments and Sheets destination/authorized accounts remain unresolved. Keep checkout, premium activation and Sheets writes disabled until the relevant details and operations are ready. Never substitute sample payment details or grant access from a submitted form.

### Continuation order

1. Apply migrations 001–009 to the staging Supabase project after checking its migration history, then validate auth and the attempt lifecycle with a reviewed staging form.
2. Turn the remaining payment, user, plan, announcement and export inventory pages into audited operations after the required owner decisions are available.
3. Populate and human-review a representative N5 form, including answer keys and listening assets, before opening learner attempts.
4. Implement payment and entitlement workflow after the owner decisions in `docs/decisions-needed.md` are confirmed.
5. Complete bilingual UI/content, staff MFA, operational recovery and production hardening before public launch.

## Continued build checkpoint — 23 November 2026

- Added the authenticated attempt screens and migration 006, including exact blueprint quota, level, answer-key, media and section-duration checks. Shared passage content is rendered in the timed session.
- Added migration 007 and an in-app question draft editor with author submission and a reviewer queue showing the item, key, explanation and provenance.
- Added migration 008 and private question-asset upload, attachment, submit-for-review and reviewer preview/decision flows.
- Added an original N5 authoring example and field guide. The admin page labels it as a draft reference; batch import remains pending.
- Updated learner-facing availability copy and added `docs/staging-launch-runbook.md` for the hosted schema setup, manual acceptance walkthrough and production gates.
- `npm run build` completed successfully after the authoring and asset-review UI changes. The hosted Supabase database still needs migrations 001–008 and reviewed demo content; no hosted end-to-end QA or production deployment is recorded here.

## Content-to-form workflow checkpoint — 23 November 2026

- Migration 009 adds audited blueprint draft creation/submission and independent reviewer approval, plus guarded form assembly, validation and frozen publication. It adds no tables; the application table count remains 31.
- The blueprint workspace provides editable slot structure and a review queue. The starter row is explicitly a structural draft scaffold; full JLPT item quotas and content decisions still require human completion.
- The form workspace selects an approved blueprint and approved questions, limits selection to each required slot quota, sets free/premium access, and submits draft forms for independent validation/publication.
- Database validation checks same-level approved content, exact slot quotas, valid answer keys, approved required media, consistent positive section timing and the approved blueprint. Start-attempt validation remains in place as a second server-side gate.
- The hosted Supabase project still needs migrations 001–009 and reviewed original staging content. No hosted schema changes, manual account-flow acceptance or production deployment are recorded here.
