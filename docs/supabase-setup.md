# Supabase setup

The Next.js app uses Supabase Auth, a browser-safe publishable key, Postgres row-level security, and a private storage bucket for question media. The service-role key is not needed by the current app and must never be added to a `NEXT_PUBLIC_` variable.

## Local environment

`.env.local` has been created from `.env.example` and is ignored by Git. Keep the project URL and publishable key there. `NEXT_PUBLIC_SITE_URL` should be the local origin during development and the deployed site origin in production. Restart Next.js after changing environment variables.

## Database migrations

Use the Supabase Dashboard SQL Editor with an administrator account. Check migration history first so an already-applied migration is not run twice. Apply these files in order when they are not already recorded:

1. `supabase/migrations/202611220001_initial_platform.sql`
2. `supabase/migrations/202611220002_auth_and_rls_hardening.sql`
3. `supabase/migrations/202611220003_spec_alignment.sql`
4. `supabase/migrations/202611220004_first_login_welcome.sql`
5. `supabase/migrations/202611220005_support_notifications.sql`

For a new, empty project, run all five: create a new SQL Editor query for each file, paste the full file contents, and run them in order. `.env.local` only connects the web app to Supabase; it never creates database tables. Afterward, confirm the tables appear in Database → Table Editor. Do not run migration 001 twice.

The migrations create the platform tables for profiles and roles; versioned question families/revisions, answer keys, passages/groups, tags, media and reviews; blueprints and frozen forms; attempts, sections, answers, results and mistake statistics; plans, payment submissions, entitlements and audit trails. They also add RLS policies, profile/role provisioning, a private `jlpt-question-assets` bucket, transactional question review, post-submission answer review, grouped-question ordering, and frozen-form snapshots on attempts.

The 30 application tables are:

- Identity: `profiles`, `user_roles`.
- Content: `question_families`, `questions` (immutable revisions), `question_answer_keys`, `tags`, `question_tags`, `passage_groups`, `content_group_items`, `content_assets`, `question_assets`, `question_reviews`.
- Exam setup: `exam_blueprints`, `blueprint_slots`, `exam_forms`, `exam_form_items`.
- Learner activity: `exam_attempts`, `attempt_sections`, `attempt_answers`, `exam_results`, `user_question_stats`.
- Plans and operations: `plans`, `payment_submissions`, `user_entitlements`, `payment_audit_events`, `admin_audit_events`.
- Learner communications: `notifications`, `support_tickets`, `support_messages`, `support_audit_events`.

Migration 004 adds an atomic one-time welcome claim so the dashboard can greet each newly provisioned account once. Migration 005 adds the student support inbox, in-app notifications, audited support status changes, and the `support_agent` role. Ticket creation/replies and notification read state use authenticated database functions; raw browser writes to these tables are denied. The schema is the database foundation. Applying it does not by itself finish the exam engine or payment operations.

## Auth settings

In Authentication → URL Configuration, set Site URL to the active canonical site origin (use `http://localhost:3000` while testing locally) and add the local and deployed URLs to the redirect allow list:

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/confirm`
- `http://127.0.0.1:3000/auth/callback`
- `http://127.0.0.1:3000/auth/confirm`
- `https://YOUR_DEPLOYED_HOST/auth/callback`
- `https://YOUR_DEPLOYED_HOST/auth/confirm`

Enable email confirmations. In the **Confirm signup** template, use a link that opens the app's confirmation page, where the learner has to press a button before the one-time token is consumed. This avoids email security scanners silently consuming links:

```html
<h2>Welcome to JLPT Practice</h2>
<p>Your account is almost ready. Confirm your email address to start practicing.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email&amp;next=/dashboard">Confirm email</a></p>
```

For **Reset password**, use a link to `/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery&amp;next=/auth/update-password`. The app has a separate `/auth/callback` handler for Google OAuth. Email login uses the account password; there is no email one-time-code sign-in.

Configure SMTP before inviting real learners. Disable link tracking/rewriting for Supabase auth emails. After email confirmation, the app takes the learner to the dashboard and shows the welcome message once. Use the provider's recommended Auth rate limits and abuse protection before launch.

## Phone and password accounts

The forms accept email or phone plus password. Enter phone numbers in international E.164 format, for example `+8801712345678`. Phone accounts receive an SMS verification code at registration; after confirmation, normal login is phone plus password. Phone password recovery also uses an SMS verification step.

In Supabase Authentication → Providers → Phone, enable phone accounts and configure a supported SMS provider such as Twilio, Twilio Verify, Vonage, or MessageBird. Set an SMS template such as `Welcome to JLPT Practice. Your verification code is {{ .Code }}`. Configure SMS rate limits and CAPTCHA before public launch. Without an SMS provider, phone signup and phone recovery cannot send codes.

## Google sign-in

The app includes a **Continue with Google** option on sign-in and sign-up. To enable it:

1. Create a Google OAuth **Web application** client in Google Cloud and set its authorized JavaScript origins to `http://localhost:3000` and the deployed site origin.
2. In Supabase Authentication → Providers → Google, enable the provider and enter the Google client ID and client secret.
3. Copy the Supabase callback URI shown on that provider screen (normally `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`) into the Google client's **Authorized redirect URIs**.
4. Confirm the app URLs above are in Supabase's redirect allow list. Set `NEXT_PUBLIC_SITE_URL` to the same canonical origin for the environment and restart Next.js. The app returns OAuth to the exact origin where sign-in started so the PKCE cookie survives; use the same hostname throughout the flow, and allow that origin in Supabase (for example, do not start on `127.0.0.1` and return on `localhost`).

Google OAuth credentials belong in the provider dashboards, not in browser environment variables or source control. Google sign-in creates/uses a Supabase Auth user; the profile/role trigger provisions a student row after migration 002 is applied.

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

The support inbox is restricted to users with `support_agent` or `admin` roles. Assign `support_agent` only to named staff who are approved to handle support. Payment, plan, user-management, and exam operations remain separately restricted until their audited server actions are implemented.

The admin pages read data using the signed-in session. Question review decisions use a database function that writes the decision, status transition, and audit event in one transaction. Support replies and status changes use authenticated functions and append-only audit records. Payment and exam-form operations remain read-only until their rules and transactional server actions are implemented.
