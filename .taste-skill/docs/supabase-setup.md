# Supabase setup

The Next.js app uses Supabase Auth, a browser-safe publishable key, Postgres row-level security, and private storage buckets for media and receipts. The service-role key is used only by server-side image upload/cleanup routes and the disabled-by-default Google Sheets payment worker. Keep `SUPABASE_SERVICE_ROLE_KEY` private in `.env.local` and Vercel server environments; never prefix it with `NEXT_PUBLIC_` or expose it to browser code.

## Local environment

`.env.local` has been created from `.env.example` and is ignored by Git. Keep the project URL and publishable key there. `NEXT_PUBLIC_SITE_URL` should be the local origin during development and the deployed site origin in production. `NEXT_PUBLIC_AUTH_ENABLE_PHONE=false` keeps SMS sign-in hidden until a provider is ready. A server-only `SUPABASE_SERVICE_ROLE_KEY` is required for private image uploads and the Sheets worker; without it, those server integrations stay unavailable. Restart Next.js after changing environment variables; on Vercel, redeploy after changing build-time `NEXT_PUBLIC_` values.

The repository now includes `supabase/config.toml` for an isolated local stack. Authenticator-app TOTP and the custom access-token hook are enabled in that local configuration; Google OAuth and SMS still require provider credentials. Run `npm run supabase:config:validate` to validate the config, then `npm run supabase:db:reset` to recreate only the local database and replay migrations without seed data. The reset command is explicitly pinned to `--local`; it does not target the hosted project. Docker Desktop must be running. The GitHub quality workflow also has a separate Supabase CLI job that replays migrations from a clean local database.

Run `npm run supabase:audit` to check whether the 41 expected public-schema table names are present after migrations through 034. The script uses only the publishable key, requests zero rows, and separates readable tables, tables hidden from the public role, missing names, and unknown responses. It does not validate migration history, columns, functions, RLS policies, grants or storage policies. After accessing the project with an authorized Supabase administrator account, run the read-only statements in [`supabase/diagnostics/staging_audit.sql`](../supabase/diagnostics/staging_audit.sql) one at a time to compare the migration ledger, table/RLS inventory, private media and receipt buckets, expected function names, private payment sync and notification-delivery objects, and staff MFA role guards.

Run `npm run supabase:content-audit` to count public `published` forms by JLPT level against the V7.2 target of three per level. It uses the publishable key and fetches at most one public form ID per level; counts do not prove that papers are complete or have passed human review. The command exits nonzero when a level is below target or the count is unavailable.

## Database migrations

Use the Supabase Dashboard SQL Editor with an administrator account. Check migration history first so an already-applied migration is not run twice. Apply these files in order when they are not already recorded:

1. `supabase/migrations/202611220001_initial_platform.sql`
2. `supabase/migrations/202611220002_auth_and_rls_hardening.sql`
3. `supabase/migrations/202611220003_spec_alignment.sql`
4. `supabase/migrations/202611220004_first_login_welcome.sql`
5. `supabase/migrations/202611220005_support_notifications.sql`
6. `supabase/migrations/202611220006_exam_attempt_lifecycle.sql`
7. `supabase/migrations/202611230007_content_authoring_workflow.sql`
8. `supabase/migrations/202611230008_asset_review_workflow.sql`
9. `supabase/migrations/202611230009_blueprint_form_workflow.sql`
10. `supabase/migrations/202611230010_admin_user_role_management.sql`
11. `supabase/migrations/202611230011_question_batch_import.sql`
12. `supabase/migrations/202611230012_student_ui_language.sql`
13. `supabase/migrations/202611230013_student_bookmarks.sql`
14. `supabase/migrations/202611230014_question_skill_tags.sql`
15. `supabase/migrations/202611230015_targeted_practice.sql`
16. `supabase/migrations/202611230016_mistake_notebook.sql`
17. `supabase/migrations/202611230017_student_display_preferences.sql`
18. `supabase/migrations/202611230018_notification_preferences.sql`
19. `supabase/migrations/202611230019_admin_announcements.sql`
20. `supabase/migrations/202611230020_payment_export_reporting.sql`
21. `supabase/migrations/202611230021_exam_result_notifications.sql`
22. `supabase/migrations/202611230022_manual_payment_operations.sql`
23. `supabase/migrations/202611230023_admin_user_details.sql`
24. `supabase/migrations/202611230024_admin_entitlement_directory.sql`
25. `supabase/migrations/202611230025_staff_mfa_assurance.sql`
26. `supabase/migrations/202611230026_private_payment_receipts.sql`
27. `supabase/migrations/202611230027_admin_attempt_monitor.sql`
28. `supabase/migrations/202611230028_question_draft_editing.sql`
29. `supabase/migrations/202611230029_account_deletion_requests.sql`
30. `supabase/migrations/202611230030_admin_dashboard_summary.sql`
31. `supabase/migrations/202611230031_private_support_attachments.sql`
32. `supabase/migrations/202611230032_trusted_device_totp_step_up.sql`
33. `supabase/migrations/202611230033_payment_sheet_sync.sql`
34. `supabase/migrations/202611230034_entitlement_notifications.sql`

**Latest configured-project audit — 23 November 2026:** the read-only PostgREST probe against the project URL in `.env.local` found 30 of the 41 expected table names present and 11 missing from the exposed public schema: `practice_sessions`, `practice_session_items`, `user_question_reviews`, `manual_payment_settings`, `announcements`, `admin_exports`, `user_notification_preferences`, `user_bookmarks`, `content_asset_reviews`, `account_deletion_requests`, and `support_attachments`. The earlier pre-022 probe found 30 of the 38 then-expected names; the current list includes the local migration 022, 029 and 031 tables. `questions` was readable with the publishable key; the other detected tables returned permission-denied responses for the public role. These checks establish table-name visibility only. They do not prove which migrations were applied or whether existing objects have the required columns, functions, grants, RLS or storage policies. Confirm that `.env.local` points to the intended staging project before applying or reconciling migrations.

**Published content audit — 23 November 2026:** `npm run supabase:content-audit` found zero publicly visible published forms for N1, N2, N3, N4 and N5. The project is below the V7.2 launch target of three reviewed full mocks at every level. The audit does not inspect form items, answer keys, assets, rights records or reviewer decisions.

Do not run all thirty-four files against a partly populated project and do not infer migration versions from table presence. First inspect the Supabase migration ledger in the Dashboard or through an authenticated database connection, reconcile it with the SQL files, then apply only unapplied migrations in numeric order. `.env.local` only connects the web app to Supabase; it never creates database tables. The current checkout has no confirmed service-role key, database URL/password or Supabase CLI, so it cannot inspect the migration ledger from the shell. If a separate target project is independently confirmed empty, run all thirty-four files there once: create a new SQL Editor query for each file, paste its full contents, and run them in order. Never rerun migration 001 on an initialized project.

The migrations create the platform tables for profiles and roles; versioned question families/revisions, answer keys, passages/groups, tags, media and reviews; blueprints and frozen forms; attempts, sections, answers, results and mistake statistics; plans, payment submissions, entitlements and audit trails. They also add RLS policies, profile/role provisioning, a private `jlpt-question-assets` bucket, transactional question review, post-submission answer review, grouped-question ordering, and frozen-form snapshots on attempts. Migration 006 adds server-timed attempt start/answer/flag/section/submit operations, validates blueprint quotas, level, answer keys, section timing and required assets, records raw grading, checks premium/free form access, returns resume payloads without answer keys, and scopes signed media access to the learner's attempt. Migration 007 adds audited draft authoring, documented content provenance, author-only submission, and a reviewer-only queue with answer details. Migration 008 adds private asset registration, attachment, submission and separate reviewer approval with an audit record.

The 41 application tables are:

- Identity: `profiles`, `user_roles`.
- Content: `question_families`, `questions` (immutable revisions), `question_answer_keys`, `tags`, `question_tags`, `passage_groups`, `content_group_items`, `content_assets`, `question_assets`, `question_reviews`.
- Exam setup: `exam_blueprints`, `blueprint_slots`, `exam_forms`, `exam_form_items`.
- Learner activity: `exam_attempts`, `attempt_sections`, `attempt_answers`, `exam_results`, `user_question_stats`, `practice_sessions`, `practice_session_items`, `user_question_reviews`.
- Plans and operations: `plans`, `manual_payment_settings`, `payment_submissions`, `user_entitlements`, `payment_audit_events`, `admin_audit_events`, `announcements`, `admin_exports`.
- Learner communications: `notifications`, `support_tickets`, `support_messages`, `support_audit_events`, `support_attachments`, `user_notification_preferences`.
- Learner preferences: `user_bookmarks`.
- Content operations: `content_asset_reviews`.

Migration 004 adds an atomic one-time welcome claim so the dashboard can greet each newly provisioned account once. Migration 005 adds the student support inbox, in-app notifications, audited support status changes, and the `support_agent` role. Migration 006 finishes the backend attempt lifecycle over published frozen forms; actual exam availability still depends on reviewed forms, populated blueprints and entitlements. Ticket creation/replies, answer writes, deadlines, grading and notification read state use authenticated database functions; raw browser writes to these tables are denied. Manual payment operations are added later by migration 022.

Migrations 007–009 complete the first content-to-form workflow without adding tables. Editors author and submit question/media drafts; different reviewers approve questions, assets and blueprints. Editors assemble forms only from approved questions using an approved blueprint and exact quotas. A different reviewer validates the form's answer keys, required reviewed media, level and section timing, then publishes it frozen. Only admins may mark a form free; premium is the default. Each sensitive operation writes to `admin_audit_events`. These RPCs remain unavailable until migration 009 has been applied to the connected Supabase project.

Migration 010 adds an administrator-only account directory and audited staff-role grant/revoke operations. It prevents removal of the last administrator and does not allow the admin page to manage the baseline student role. The first admin must still be assigned through the SQL Editor.

Migration 011 adds an atomic batch importer for one to 100 JSON question drafts. It calls the same validated draft-creation path for every item, records each question plus a batch audit event, and rolls back the full batch if any item fails. Imported questions are never approved automatically.

Migration 020 adds an expected-amount snapshot plus optional payment sender-name, reference-number and transaction-time fields; an administrator-readable export history; and an audited payment report RPC for CSV/XLSX. Existing rows are backfilled with the current plan amount. Any future payment-submission operation must snapshot the plan amount when the request is created. The export RPC is limited to admins and payment reviewers, masks sender numbers unless an admin explicitly requests unmasked numbers, enforces a 366-day range and 20,000-row cap, and never updates payment state or entitlements. The route requires this migration and records both a dedicated export row and an admin audit event.

Migration 012 adds the English/Bangla interface preference to learner profiles and carries signup metadata through first-party profile provisioning. The language choice is kept on the device for signed-out browsing and synced to a signed-in profile; applying the migration is required for cross-device sync.

Migration 013 adds learner-owned bookmarks for approved questions. Row-level security limits reads and deletes to the owner and only allows new bookmarks for approved or exam-eligible content. The completed-attempt review and `/bookmarks` page expose the learner workflow without revealing answer keys in active exams.

Migration 014 adds audited skill-tag assignment to owned question drafts, requires at least one skill tag before review submission, and extends atomic batch import to attach tags. These approved skill tags drive the targeted-practice selector.

Migration 015 adds private five-question practice sessions with resumable answer saves, tag/level selection, recent-question avoidance, idempotent session creation, scoring on submit, and post-submit review. Its RPCs expose no answer keys during the active session. The current implementation is a text-question diagnostic preview; audio/media and final free/premium usage limits are not enabled by this migration.

Migration 016 adds learner-owned mistake review markers and a private notebook RPC. It lists incorrect answers from completed exam attempts with the learner's selected answer, approved key/explanation, last-missed date, miss count and skill tags. Filters support level, skill, question type, date range and review status. Marking a mistake reviewed is audited by state and a later wrong answer reopens it. The web app links to the full attempt review and to targeted practice for the same skill.

Migration 017 adds a validated IANA time-zone preference and a reduced-motion setting to each learner profile. The profile form stores both in Supabase; the motion preference is also remembered on the current device and applied across routes. The account, dashboard, practice history and mistake dates use the learner's selected time zone, including the notebook's date-filter boundaries.

Migration 018 adds owner-scoped notification preferences through RPCs. Optional in-app exam notices and service announcements can be hidden from the inbox; essential account, security, payment and support notices remain visible. Optional email choices default off and their opt-in timestamps are stored, but email delivery remains off until an approved provider is configured.

Migration 019 adds an admin-only bilingual announcement workflow. Admins can create/edit drafts and publish in-app notices through audited, idempotent RPCs. Publishing writes English/Bangla notice content to each learner's inbox if that learner has not disabled service notices; it does not send email. Published notices are immutable, and repeated publish requests do not duplicate inbox records.

Migration 021 creates one bilingual, learner-owned `result_ready` notice when an exam result is finalized. Delivery is idempotent per attempt and respects the learner's optional in-app exam-update preference. It adds no application table and sends no email.

Migration 034 adds a private delivery ledger and a service-role-only function that writes one bilingual `premium_expiring` notice inside the configured 1–30 day window and one `premium_expired` notice after the latest active entitlement ends. Repeated daily runs do not duplicate notices. The Vercel route `/api/jobs/entitlement-notifications` is scheduled daily at 03:15 UTC, but Vercel Cron only invokes production deployments; call the Preview endpoint manually with `Authorization: Bearer $CRON_SECRET` for staging acceptance. Set `ENTITLEMENT_NOTIFICATIONS_ENABLED=true` only after migration 034 is reconciled/applied and that acceptance succeeds. The default reminder window is seven days. This workflow only writes to the in-app inbox; no email is sent.

Migration 022 prepares the manual bKash Send Money workflow. It seeds the three proposed plans as inactive with zero BDT prices and creates a blank, disabled `manual_payment_settings` row. Admin-only RPCs configure plans and recipient instructions; authenticated learner RPCs fetch options, submit idempotent requests with server-snapshotted price/duration/features, and request cancellation. Payment reviewers can filter a masked queue, inspect details, reveal a sender number with an audit event, mark requests under review, return them to pending, reject with bilingual learner messages, verify once, or close a student-requested cancellation after checking no funds arrived. Verification and entitlement extension happen in one transaction; notifications are in-app only. The new `/upgrade/bkash`, `/admin/plans`, `/admin/settings/payments`, `/admin/payments`, and `/admin/payments/[paymentId]` screens use those operations. Checkout remains off until the owner supplies verified values. Private receipt upload, retention/deletion automation, outbound email and hosted staging acceptance are still pending.

Migration 033 adds a private, trigger-fed Google Sheets outbox and per-attempt event history for payment rows. It masks sender numbers in the integration payload, supports idempotent stable-ID upserts, records sync status separately from payment state, and exposes a bounded status view, failed-row retry, and approved-payment-ID reconciliation to AAL2 administrators. Service-role-only claim/complete/reconciliation RPCs are used by the server worker. The migration also updates the CSV/XLSX report sync-status field. Keep the integration disabled until the owner supplies the spreadsheet, service-account sharing and authorized Google account list; do not apply migration 033 over an unreconciled staging migration ledger.

Migration 023 adds an admin-only `get_admin_user_detail` RPC and `/admin/users/[userId]` read-only account view. It summarizes authentication verification/state, profile, roles, attempt results, payment requests, entitlements, support tickets and account-level admin audit history. Each view is audited; passwords, OTPs, recovery tokens, sender numbers and transaction IDs are excluded. Suspension, recovery and complimentary access actions remain unavailable until their policies and service credentials are approved.

Migration 024 adds an audited, admin-only `get_admin_entitlement_directory` RPC and `/admin/entitlements` read-only inventory with status and account/plan filters. It links to account detail and (for another learner) the source payment review. It does not grant or revoke access; those controls remain pending approved reason, duration and permission policies.

Migration 025 replaces the private staff-role helpers so `admin`, `content_editor`, `reviewer`, `payment_reviewer` and `support_agent` checks require a Supabase JWT with `aal2`. Student-only role checks remain available at `aal1`. The `/admin/mfa` page lets authorized staff enroll a TOTP authenticator once or verify a code on later visits; staff routes and the payment export route redirect there until the session reaches AAL2. Enable TOTP as an allowed factor in Supabase Auth before staging acceptance. The migration changes no tables and has not been applied to hosted Supabase.

Migration 026 adds an optional private receipt image to a payment request, a separate `jlpt-payment-receipts` bucket (WebP, 4 MB maximum), owner-scoped upload reservation with stale reservation recovery, and payment-reviewer/admin access through a five-minute signed link with an admin audit event. The server checks the input signature, decodes it, rejects animated/oversized images, resizes it and re-encodes to WebP without carrying metadata. Images do not verify payment. External malware scanning and receipt retention/deletion automation remain launch gates; retention depends on owner approval. The migration adds no application tables and remains local until the migration ledger is reconciled.

Migration 027 adds an audited, read-only `/admin/attempts` monitor for admins and reviewers. It returns learner/form identifiers, status, server timing, section progress and answer counts only; it never returns selected answer values or answer keys. Migration 028 adds audited question-draft read/update operations and `/admin/questions` library/detail/edit pages. Only the author or an admin can edit a question while it is still a draft; content becomes immutable after submission. Both migrations add functions only and remain local until the hosted ledger is reconciled.

Migration 032 adds a private 30-day trusted-device registry and a Custom Access Token Hook that limits verified-TOTP accounts to the `anon` Data API role on unrecognized AAL1 sessions. Successful TOTP challenges and explicitly remembered device sessions receive the normal `authenticated` role. The hook is not active from SQL alone: apply the migration, configure the Supabase Auth Hook in the Dashboard, enable TOTP, and only then set `SUPABASE_TOTP_STEP_UP_ENABLED=true` for the Preview deployment. The app's `/auth/continue` route handles trusted-device revalidation and token refresh; `/auth/mfa` handles learner enrollment/challenge, and `/settings/security` manages TOTP. Keep recovery and hosted policy verification as production gates.

Migration 029 adds the owner-scoped `account_deletion_requests` table and audited request/withdrawal/admin-review RPCs. The workflow records and tracks requests but never deletes accounts or records. It remains local until the hosted ledger is reconciled; the retention and identity-verification policy must be approved before manual fulfillment.

Migration 031 adds a private support screenshot bucket and an owner/staff-only attachment workflow. Authenticated users cannot write directly to either image bucket; the server upload routes validate and re-encode files, then use the server-only service-role credential for storage writes. The server accepts PNG/JPEG/WebP input, verifies the signature, rejects animated or oversized images, strips metadata by re-encoding to WebP, and grants five-minute signed links after an audited access check. Only non-internal support messages can have one image attachment. No malware scanning or retention/deletion job runs until those are configured and approved. The feature remains local until migration history is reconciled.

Migration 030 adds `get_admin_dashboard_summary`, which returns role-filtered operational counts, per-level published-form totals, and a minimal recent audit list for admins. It omits learner-level records and returns sensitive counts only to the role that can manage that queue. Backup/restore state is explicitly shown as unverified until operations are connected and a restore drill is recorded.

## Auth settings

In Authentication → URL Configuration, set Site URL to the active testing origin (use `http://localhost:3000` locally; for shared testing use the exact current `https://YOUR_PROJECT.vercel.app` host) and add the local and deployed URLs to the redirect allow list:

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/confirm`
- `http://127.0.0.1:3000/auth/callback`
- `http://127.0.0.1:3000/auth/confirm`
- `https://YOUR_PROJECT.vercel.app/auth/callback`
- `https://YOUR_PROJECT.vercel.app/auth/confirm`

Enable email confirmations. In the **Confirm signup** template, use a link that opens the app's confirmation page, where the learner has to press a button before the one-time token is consumed. This avoids email security scanners silently consuming links:

```html
<h2>Welcome to JLPT Practice</h2>
<p>Your account is almost ready. Confirm your email address to start practicing.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email&amp;next=/dashboard">Confirm email</a></p>
```

For **Reset password**, use a link to `/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery&amp;next=/auth/update-password`. The app has a separate `/auth/callback` handler for Google OAuth. Email login uses the account password; there is no email one-time-code sign-in.

Configure SMTP before inviting real learners. Disable link tracking/rewriting for Supabase auth emails. After email confirmation, the app takes the learner to the dashboard and shows the welcome message once. Use the provider's recommended Auth rate limits and abuse protection before launch.

## Phone and password accounts (deferred)

The code supports phone plus password, but the current UI hides phone registration, sign-in, and recovery. Set `NEXT_PUBLIC_AUTH_ENABLE_PHONE=true` only after SMS is enabled and configured in Supabase, then redeploy. Enter phone numbers in international E.164 format, for example `+8801712345678`. Phone accounts receive an SMS verification code at registration; after confirmation, normal login is phone plus password. Phone password recovery also uses an SMS verification step.

When ready, enable phone accounts and configure a supported SMS provider in Supabase Authentication → Providers → Phone. Set an SMS template such as `Welcome to JLPT Practice. Your verification code is {{ .Code }}`. Configure SMS rate limits and CAPTCHA before public launch. Without an SMS provider, phone signup and phone recovery cannot send codes.

## Google sign-in

The app includes a **Continue with Google** option on sign-in and sign-up. The owner has enabled Google for the current Supabase project. Verify the allowed origins and callback URLs below for every testing deployment:

1. Create a Google OAuth **Web application** client in Google Cloud and set its authorized JavaScript origins to `http://localhost:3000` and the deployed site origin.
2. In Supabase Authentication → Providers → Google, enable the provider and enter the Google client ID and client secret.
3. Copy the Supabase callback URI shown on that provider screen (normally `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`) into the Google client's **Authorized redirect URIs**.
4. Confirm the app URLs above are in Supabase's redirect allow list. Set `NEXT_PUBLIC_SITE_URL` to the same canonical origin for the environment and restart Next.js. The app returns OAuth to the exact origin where sign-in started so the PKCE cookie survives; use the same hostname throughout the flow, and allow that origin in Supabase (for example, do not start on `127.0.0.1` and return on `localhost`).

Google OAuth credentials belong in the provider dashboards, not in browser environment variables or source control. Google sign-in creates/uses a Supabase Auth user; the profile/role trigger provisions a student row after migration 002 is applied.

## Vercel testing environment

- Keep the current `*.vercel.app` URL as the shared testing origin and add its exact callback/confirmation routes to Supabase Auth’s redirect allow list.
- Set `NEXT_PUBLIC_SITE_URL` to that same testing origin for the deployment. Keep Preview and Production environment variables separate.
- Google OAuth must list the test origin as an authorized JavaScript origin; the Supabase callback URL remains the provider redirect URI.
- Do not treat the Vercel preview URL as the permanent product domain. Confirm the canonical domain before production email, OAuth, and legal launch setup.
- Keep phone disabled until SMS is configured. Google Sheets variables remain disabled until a destination and authorized account list are supplied; see `docs/google-sheets-setup.md`.

The first Dashboard visit also shows the in-app welcome card once for email, phone, and Google-created accounts. The confirmation email can welcome email registrants; sending a separate follow-up email after Google signup requires an outbound email provider or Supabase Edge Function, which has not been configured.

## Assign the first administrator

New registrations receive the `student` role only. After the owner account is verified, replace the placeholder email and run this once in the SQL Editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role
from auth.users
where lower(email) = lower('OWNER_EMAIL@example.com')
on conflict (user_id, role) do nothing;
```

The private `/admin/sign-in` entry is omitted from public navigation and uses the same account providers as learner login; there is no separate admin signup or password system. Only a trusted database role grants access, and `/admin` checks it server-side. Hiding the link is a usability choice, not the security boundary. After assigning a role, staff can sign in from `/admin/sign-in`; authorized staff also see a Staff link in the authenticated navigation. Never grant a role from browser form data.

The support inbox is restricted to users with `support_agent` or `admin` roles. Assign `support_agent` only to named staff who are approved to handle support. Staff role assignment is available from the admin users page after migration 010; first-admin provisioning still uses the SQL Editor. Payment reconciliation and plan-management operations remain disabled until their audited workflows and business rules are approved.

The admin pages read data using the signed-in session. Question, asset, blueprint and exam-form review decisions use authenticated database functions that enforce roles, prevent self-review, validate transitions and write audit events. The account directory and staff-role actions are restricted to admins and audited. Support replies and status changes use authenticated functions and append-only audit records. Payment operations remain read-only until their provider and owner decisions are approved.
