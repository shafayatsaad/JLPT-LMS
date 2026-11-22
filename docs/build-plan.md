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

## Current implementation checkpoint — 22 November 2026

- The homepage and N1–N5 section selector are in place, using the single latest Sakura hero video and the supplied still as its fallback.
- `/levels/[level]` shows the verified timed sections and score-category mapping for each level.
- The N5 preview flow covers details, instructions, a sample question workspace, a sample result, and answer review.
- The N5 flow is interface preview content only. It uses two original sample questions, browser-tab answer storage, an illustrative local timer, and a listening placeholder. It is not a published form or a saved attempt.
- The exam workspace uses a plain high-contrast layout. Public, level, result, and review pages use the Origami Sakura styling and reduced-motion-aware fold reveals.
- The authenticated exam vertical slice still requires configured Supabase Auth, server-side attempt/timer actions, approved exam content, and listening assets before it can be treated as a real mock exam.

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
- Added independent-platform information, pricing/access placeholder, and clearly marked legal draft routes. Prices, payment instructions, plan terms, and legal terms remain unpublished until approved.
- Added role-gated staff pages for content, authoring/import, review, assets, blueprints, forms, payments, user roles, and audit records. Question-review decisions use a transactional Postgres function; other privileged operations remain unavailable until their server actions are implemented.
- The top navigation now shows only sign-in/sign-up while signed out, and Dashboard/Account while signed in. The Staff link appears only for authenticated staff; `/admin` also checks the database role server-side.
- Email signup uses a click-to-confirm token-hash page. Login uses email or phone plus password; phone verification codes are used only to confirm new phone accounts and recover phone accounts. Sign-in and sign-up include Google OAuth; the Google provider and SMS provider still must be configured in Supabase for those options to complete.
- Added `supabase/migrations/202611220004_first_login_welcome.sql` for a one-time dashboard welcome message across email, phone, and Google-created accounts.
- Added `supabase/migrations/202611220002_auth_and_rls_hardening.sql` for profile/role provisioning, explicit RLS and API grants, a private media bucket, question review, and post-submission answer review. Added `supabase/migrations/202611220003_spec_alignment.sql` for explicit question families, shared-content group ordering, answer-to-form-item integrity, blueprint section durations, and immutable attempt form snapshots. The migrations still need to be applied in the hosted Supabase project after checking migration history; see `docs/supabase-setup.md`.
- The exam preview remains a browser-only demonstration. It is not connected to the saved-attempt, timer, answer-write, or grading workflow.
