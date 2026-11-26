# Local test profiles

The local demo creates test learner, reviewer and administrator profiles in the local Supabase stack. It does not create accounts in the hosted project or Vercel.

## Start the demo

1. Install dependencies with `npm install`.
2. Start Docker Desktop. The development demo uses port `3000`; stop another server on that port before starting it.
3. Run `npm run demo:local` from the project folder.
4. Open `http://127.0.0.1:3000/dev/test-accounts`.

The command starts local Supabase, resets its local database, applies the migrations, loads the demo seed, and starts Next.js with local credentials in that process. It leaves `.env.local` unchanged. Resetting local Supabase removes data stored in that local database.

For a production-mode launch simulation, use `npm run demo:local:production:resume`. It builds and starts the optimized Next.js server against the local Docker Supabase stack on port `3001`, applies pending migrations without resetting test data, and keeps the demo payment and account screens enabled only because the configured Supabase URL is localhost. Its `.next-production-demo` build folder is separate from development output. `npm run demo:local:production` deliberately resets local data first.

For trusted testers on the same private Wi-Fi/VPN, run `npm run demo:local:docker:lan`. It prints the computer's LAN URL, reconfigures the browser's Supabase URL for that network, and binds the app on port 3002. The tester's device must be on that same network; this is not an internet link. Share only with people you trust because the local staff test account is available in the demo workspace. On another computer use the learner credentials from `/dev/test-accounts`; payments are fake and send no money. To switch back to private local access, run `npm run demo:local:docker`.

## Profiles

| Profile | Email | Password | Roles |
|---|---|---|---|
| Learner | `student@n5.test` | `N5learn26` | Student · N5 target |
| Free learner | `free-student@n5.test` | `N5free26` | Student · N5 target · no entitlement |
| Administrator | `admin@n5.test` | `N5admin26` | Student · Admin · N5 target |
| Reviewer | `reviewer@n5.test` | `N5review26` | Student · Reviewer · N5 target |

The current Docker database already has a verified authenticator factor on the seeded admin profile; use the authenticator previously enrolled for `admin@n5.test`. The reviewer must enroll a separate authenticator at `/admin/mfa` before opening staff pages. If you intentionally reset the local database, set up new factors for staff accounts before using staff pages.

Temporary admin identities used to exercise append-only audit workflows may remain as banned, staff-less local users so audit rows retain their actor references. Do not use those accounts to sign in.

The student, admin and reviewer seed accounts have verified local test phones `+15550000001`, `+15550000002` and `+15550000005`. New local phone verification uses `123456` with `+15550000003` or `+15550000004`.

## Included demo flows

- The learner has a seeded completed N5 attempt for progress, answer review, mistake notebook and bookmarks, plus an active local demo plan. Use the separate Free learner to test premium access locks and free-form eligibility.
- `/exams` includes a separate six-question local demo form that can be started and submitted as a saved attempt. Its listening item is transcript-only until reviewed audio is added.
- `/pricing` and `/upgrade/bkash` show clearly labeled local plan prices and a fill-sample button. Submitting creates an ordinary local payment request; no money is sent.
- The learner has a seeded verified fake purchase and two additional locally simulated checkouts that were submitted through the learner UI and approved through the admin review screen. They created active entitlements for testing; no money was sent and no payment provider was contacted.
- `/admin/settings/integrations` provides a local Google Sheets simulation after admin MFA. Sync and reconciliation actions exercise the queue and mirror in the local database; they never contact Google. Real Sheets sync still needs the spreadsheet and service-account values from the project owner.
- A sample support ticket, notification, published announcement, draft question and demo exam form populate the related learner and staff areas.
- `/admin/sources` accepts one paper folder at a time (one PDF and optional audio) and stores it in a private source bucket. Four source packets are already loaded: July 2013 N5, 2010–2011 N5, December 2013 N4, and the N5G layout reference. Keep the December 2013 packet marked N4 and rights unconfirmed.
- `/admin/questions/new` accepts a folder with `manifest.json` plus the image/audio files named by each question's `assets` array. PDFs belong in the private source library; extract and review individual questions before creating publishable question records.
- The question and media review queues contain one clearly labeled, synthetic local import example with a generated Sakura image and test audio. It was uploaded through the folder importer, remains unpublished, and is not official JLPT content.
- Use the reviewer profile to approve or return questions and media authored by the administrator, and to validate/publish an administrator-created draft exam. Authors cannot review their own content or exam form.
- Playwright's admin workflow test creates synthetic `N5-PHASE2-*` published forms and `[PHASE 2 QA/IMPORT]` question rows in the local database. They are test artifacts, not complete exams or launch inventory. Published snapshots are immutable and remain visible in the local demo until an intentional local database reset.

Use `/dev/test-accounts` for credentials and direct workflow links. Resetting the local database restores this sample state; it does not change hosted Supabase or Vercel data.

The public N5 sample at `/exams/n5/preview/session` demonstrates the first N5 vocabulary section as a scrollable paper with a separate bubble answer sheet, explicit answer clearing, scoring and browser-tab persistence. It uses five original demonstration questions and is not a complete official section, published exam or server-saved/timed attempt. The six-question premium form is a separate local test form, not a launch-ready JLPT paper.
### Continue without resetting local test data

Run `npm run demo:local:resume` to start the Docker-backed Supabase services and apply pending migrations without clearing the local database. Use `npm run demo:local` only when you intentionally want to reset the local Supabase database and reload the sample accounts.

Local phone verification uses fixed test-only OTP `123456` for the reserved numbers `+15550000001` through `+15550000004`; no SMS is sent. `supabase/config.toml` also contains dummy Twilio placeholders solely to enable the local provider. Remove the fixed OTP map and all three placeholders before pushing auth configuration to a hosted Supabase project, then add the real provider credentials using hosted secrets.
