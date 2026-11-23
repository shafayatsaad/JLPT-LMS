# Staging and launch runbook

This checklist separates the current tester deployment from a public production launch. The current `*.vercel.app` host is for shared testing. The latest read-only probe on 23 November 2026 found 30 of the 41 expected table names present and 11 missing from the exposed schema, including the tables defined by local migrations 022, 029 and 031. The same-day public content audit found zero published forms at N1–N5; the V7.2 target is three reviewed full mocks per level. Confirm that `.env.local` targets the intended staging project and reconcile the migration ledger before applying anything. The ledger and full RLS/function state are not accessible from the current shell credentials, so database-backed workflows remain unverified.

## 1. Prepare the staging environment

- Use the current Vercel testing hostname as the canonical staging origin.
- Add that exact host to Supabase Auth's Site URL and redirect allow list. Configure the Google OAuth JavaScript origin and keep the Supabase callback URI as the OAuth redirect URI.
- Set `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the Vercel Preview environment. Keep `NEXT_PUBLIC_AUTH_ENABLE_PHONE=false`.
- Add `SUPABASE_SERVICE_ROLE_KEY` only to the server-side Preview environment if tester uploads are enabled. Keep service credentials server-only; never add a service-role key to browser code or a `NEXT_PUBLIC_` variable. The app uses it only for validated private image storage writes.
- Configure email confirmation templates and SMTP. Verify both a new email account and Google sign-in return to the deployed dashboard.

## 2. Create the database schema

1. Run `npm run supabase:audit` and `npm run supabase:content-audit`; save the outputs with the staging acceptance record and confirm at least three published forms per JLPT level. Counts do not replace the manual completeness and approval review below.
2. In Supabase, inspect the migration ledger and compare applied versions with `supabase/migrations/`.
3. Apply only unapplied migrations in numeric order using the steps in [`supabase-setup.md`](supabase-setup.md). Do not apply the full sequence to the partially populated project or rerun migration 001.
4. Run the read-only statements in [`supabase/diagnostics/staging_audit.sql`](../supabase/diagnostics/staging_audit.sql) and confirm all 41 application tables, expected RLS settings, the private question, payment-receipt and support-attachment buckets, and required function names exist.
5. Assign the owner account the first `admin` role using the documented SQL only after that account is confirmed. Assign other roles to named staff individually.
6. Confirm an ordinary learner cannot read another learner's profile, attempt, support ticket or payment record, and cannot read an answer key before submission.
7. As an administrator, open a user from `/admin/users` and confirm profile, verification, attempt/result summaries, payments, entitlements, support tickets and account audit history render. Confirm the read event is logged, sensitive auth/payment secrets are absent, and a non-admin is denied both the route and `get_admin_user_detail` RPC.
8. As an administrator, filter `/admin/entitlements` by status and learner/email/plan; confirm account and source-payment links resolve and the directory view is audited. Confirm no grant/revoke controls are available and a non-admin cannot call `get_admin_entitlement_directory`.
9. Review `/admin/settings` and its general/security/email/notification/maintenance pages. Confirm they show status only, do not expose secrets, do not imply email/rate-limit/maintenance controls are active, and do not change external provider configuration.
10. Search `/admin/audit` by action, entity type, actor ID and UTC date range. Confirm results are capped at 100, this route requires admin AAL2, and filters never expose audit records to learners or other staff roles.
11. Open `/admin` with admin, reviewer, payment-reviewer and support-agent accounts. Confirm each role sees only its authorized pending counts, administrators see recent audit activity, published forms are grouped by level, and backup/restore status remains unverified until the provider restore drill is documented.
12. Enable TOTP as an allowed factor in Supabase Auth. Enroll an authorized staff account at `/admin/mfa`, sign out and back in, and confirm an AAL1 session is sent to the authenticator challenge before any staff route or staff RPC succeeds. Complete the challenge and verify staff routes, payment exports and staff-only RLS data work at AAL2. Confirm student-only practice remains available without MFA and that a non-staff account cannot enroll through `/admin/mfa`.
13. Open `/admin/settings/integrations`. Confirm Google Sheets remains disabled, secret values are never displayed, and the private image-storage row reports credential presence only without claiming that the value or Supabase buckets have been verified.
14. In `/settings/security`, use the two-step “Sign out other devices” control. Confirm the current browser stays signed in, other sessions must refresh or sign in again, and the UI states that already-issued access tokens remain valid until they expire. Verify ordinary “Sign out” ends only the current device session.
15. Test learner TOTP enrollment, unrecognized-device challenge, remembered-device behavior, TOTP removal, rate limits, and the owner-approved recovery procedure. This implementation treats an unrecognized session as the risk signal; other signals require a separate approved provider or policy.

### Learner TOTP step-up activation

Migration `202611230032_trusted_device_totp_step_up.sql` adds the trusted-device registry and `public.custom_access_token_hook`. Apply it only after reconciling the hosted migration ledger. In Supabase Dashboard, first inspect any existing Custom Access Token Hook so this function does not replace unrelated claim logic; then open **Authentication → Hooks → Custom Access Token Hook** and select `public.custom_access_token_hook`. Enable TOTP under **Authentication → Multi-Factor Authentication**. Deploy Preview with `SUPABASE_TOTP_STEP_UP_ENABLED=true` only after the hook and migration are active.

Learners opt in from **Settings → Sign-in and security**. Accounts with a verified TOTP factor receive a restricted `anon` Data API role on new sessions until TOTP succeeds or the learner explicitly remembers that device for 30 days. Test sign-in with password and Google, first-time enrollment, untrusted-device challenge, remembered-device refresh, device revocation, TOTP removal, direct table/RPC access while challenged, staff MFA, and the recovery support procedure. The Auth Hook must be enabled and tested before relying on this gate; enabling the app flag alone is not sufficient. Existing access tokens are not retroactively changed, so revoke test sessions or wait for them to expire after hook rollout.

## 3. Prepare one staging exam

- Create a clearly labeled, original N5 demo form using the active blueprint and the authoring page/reference at [`question-authoring-template.md`](question-authoring-template.md).
- Provide enough approved questions for every blueprint section, one valid answer key per question, and reviewed listening assets for listening items.
- Validate section durations, question counts, score-category mappings, rights/provenance and Japanese copy before freezing the form.
- Keep the demo form `free` only in staging. New forms default to premium; no real entitlement or payment flow is needed for this demo.
- Do not copy official JLPT questions, recordings or commercial prep-book content without a valid license.

## 4. Manual acceptance walkthrough

Use two learner accounts and one staff account. Record the deployment URL, account role, browser, date, visible result and any errors.

- Open `/levels`, confirm all five level guides resolve and use the JLPT timing data, and confirm the N5 preview is labeled as browser-only rather than a saved or published exam.
- Create/confirm an email account and sign in with Google; both should reach the learner dashboard.
- Sign in as an editor, create a question draft, submit it, then sign in as a different reviewer and verify the prompt, choices, answer key and provenance are visible. Confirm the author cannot approve their own draft.
- Import the supplied original JSON example and a small batch, confirm all imported records are drafts, and confirm a deliberately invalid item rolls back the entire batch.
- Confirm every imported question has at least one skill tag; try an invalid or missing tag and confirm the entire batch rolls back. Confirm an untagged manual draft cannot be submitted for review.
- Upload an audio or image asset to a draft question, submit it for review, approve it as a different reviewer, and confirm the published-form workflow only accepts approved assets.
- Create a complete blueprint draft, submit it, and approve it from another reviewer account. Confirm the author cannot approve their own blueprint and that approved slots cannot be edited.
- Assemble a form from that approved blueprint with the exact number of reviewed questions, validate it as a different reviewer, and publish it. Confirm missing keys, required media, wrong slot counts or inconsistent timing block validation and that published content is frozen.
- Open a question owned by the editor at `/admin/questions/[questionId]`, edit and save while it remains a draft, and confirm the change is audited. Confirm another editor cannot edit it, an admin can, and no one can change its content after it is submitted for review.
- Open `/admin/exam-forms/[formId]` and confirm the manifest shows its frozen questions and blueprint quotas without exposing answer keys or mutation controls.
- Open `/admin/attempts`, filter by status and learner/form text, and confirm the monitor reports timing, section progress and answer counts but never selected answers or answer keys. Confirm non-review staff and learners are denied access.
- Submit an account-deletion request from `/settings/privacy`, confirm the learner can see and withdraw only their own request, and confirm an admin can review and update its status with an audit event. Verify the queue does not perform deletion and that no request details are visible to another learner.
- Start the staging form, select and change answers, flag an item, refresh, and confirm the saved selection and remaining server time return.
- Finish one section early and confirm the next section receives its own deadline. Let a separate attempt section expire and confirm the server advances or closes the attempt without accepting late answers.
- Submit an attempt and confirm raw result counts, section/category breakdown, and answer review appear only after closure.
- Confirm the learner receives one bilingual `result_ready` inbox notice per completed attempt, the link opens that learner's result, repeat finalization does not duplicate it, and disabling optional exam updates hides it.
- Confirm another learner cannot load or resume that attempt, and that answer keys never appear in active exam payloads.
- Confirm support messages and notifications are visible only to their owner and authorized support staff.
- Save and remove a bookmark from a completed review, confirm it appears on `/bookmarks`, and verify a second learner cannot read or remove it.
- Switch the interface to Bangla, refresh, and sign out/in again; confirm the local preference persists and the account preference syncs after migration 012.
- Open an active attempt in Bangla, switch to English and back from the exam toolbar, and confirm the timer and saved answers continue unchanged while the JLPT question content remains Japanese.
- Open a completed result and answer review in Bangla. Confirm raw score labels, section/category names, response controls, bookmark actions and empty states are translated; authored question explanations remain in their supplied language.
- Switch the N5 demo to Bangla across its overview, instructions, session, sample result and review. Confirm the demo remains explicitly labeled as browser-only and never appears as a saved account attempt.
- Switch support center language and verify the request list, new-request form, ticket details, reply controls, status labels and displayed dates follow the selected language.
- Save a valid IANA time zone and reduced-motion preference in profile settings; verify date rendering and notebook date filters use that zone, and that reduced motion is applied after refresh/sign-in.
- Update notification preferences. Confirm optional exam/service items follow the selected in-app controls while payment, security, authentication and support notices remain visible. Verify optional email preferences start off, save per account, and do not claim that email was sent.
- As an admin, create a bilingual announcement draft, edit it, and publish once. Confirm opted-in learner accounts receive one notification with the right English/Bangla copy, opted-out learners receive none, repeated publish does not duplicate, and non-admin users cannot list or publish announcements.
- From `/practice`, choose a level and tag with five eligible approved questions, start the set, save answers, refresh, and resume. Verify the active RPC payload contains no answer key or explanation.
- Submit the practice set and confirm raw correct/incorrect/unanswered counts plus approved explanations appear only at `/practice/[sessionId]/review`. Repeat a set and confirm recently used questions are avoided when enough alternatives exist.
- Verify a second learner and an unsigned request cannot load, change or review the first learner's practice session.
- Complete mocks with correct and incorrect answers, then check the mistake notebook. Confirm level, skill, question-type, date and review-state filters work, the selected and correct answers plus explanation match the completed attempt, and bookmarks remain independent.
- Mark a missed question reviewed, filter to reviewed items, and then miss it again on a later mock; confirm it returns to the needs-review filter.
- Confirm a second learner cannot load the first learner's mistake list or change their review markers.
- Download a JSON export from `/settings/privacy`. Confirm it contains only the signed-in account's profile/activity/support/payment records, excludes internal staff notes, has private no-store headers, and is not saved by the application. Repeat as a second learner and confirm the first learner's IDs and records are absent.
- Before owner-approved payment configuration, confirm pricing remains a preview, payment checkout stays closed, no payment-derived entitlement can be granted, and Sheets sync remains disabled.
- As a payment reviewer and as an admin, download CSV and XLSX payment reports for bounded date ranges. Confirm phone numbers are masked for both roles by default, only admins can request unmasked numbers, invalid/overlong ranges fail, each successful export appears in `admin_exports` and `admin_audit_events`, and the export never changes payment or entitlement state.
- Confirm the default payment settings row has checkout disabled, recipient fields blank, and all seeded plans inactive at zero price. Do not use real bKash account information or enable collection until the owner has supplied and approved those values.
- In an isolated staging database after owner-approved test configuration, submit one request and verify the submitted amount, plan name, duration and included features are snapshotted by the database. Retry the same idempotency key and confirm the same request is returned; try a second active request and a duplicate transaction ID and confirm both are rejected.
- Attach a valid PNG/JPEG/WebP receipt no larger than 4 MB. Confirm the object is private, its stored version is resized/re-encoded WebP without metadata, the learner history shows it is attached, the request remains pending, and the admin audit records reviewer access. Reject oversized, unsupported-MIME, animated, decompression-limit and incorrect-signature files. Simulate an abandoned upload reservation and confirm it can be retried after 30 minutes. Confirm a different learner and a support agent cannot obtain or open the receipt; confirm the signed link expires after five minutes.
- Attach a PNG/JPEG/WebP screenshot to a public support reply. Confirm signature checks, animated/pixel/size limits, WebP re-encoding, private storage, five-minute signed viewing, access audit records, and denial to a different learner or unauthorized staff role. Confirm internal notes have no attachment control.
- Reject oversized, unsupported, animated, malformed, and incorrect-signature support images. Confirm a failed upload can be retried after the reservation expires and does not erase the text reply.
- Confirm support attachment retention and external malware scanning remain off until the owner approves the schedule and scanning provider.
- Confirm the learner can request cancellation while a request is pending, but it stays open and blocks a second request until a payment reviewer either confirms that no funds arrived and closes it, or verifies that funds arrived and approves it. Confirm approval resolves the cancellation request and creates one entitlement. Confirm a requester cannot review their own payment.
- As a payment reviewer, confirm the queue masks sender numbers and open requests from both the queue and direct `/admin/payments/[paymentId]` routes. Reveal a number and verify the reveal is recorded in `admin_audit_events`. Test under-review, return-to-pending, bilingual rejection, approval, repeat approval, and cancellation. Approval must create one entitlement from the immutable plan snapshot, extend from a current active expiry, and create one in-app notice. Repeat approval must not extend the entitlement again.
- Confirm inactive/zero-price plans and disabled settings keep `/upgrade/bkash` closed and show no recipient number or instructions. Confirm receipt upload is optional and never approves payment. External malware scanning, receipt retention/deletion and outbound email remain unavailable in this build.

This is a manual release checklist, not evidence that the flows have already been exercised against the hosted Supabase project. Run it after migrations and demo content are available.

## 5. Production release gates

Do not switch the public audience to Production until the owner has supplied the domain, final name, prices/access matrix, bKash recipient and instructions, refund/access rules, receipt retention period, legal copy, support contact, staff roster, Sheets destination/authorized admins and content rights/review plan. Then configure production URLs and OAuth separately, confirm the hosted AAL2 migration and TOTP policy, connect receipt malware scanning and approved retention/deletion, check rate limits, configure monitoring/backups, review restore procedures, and complete accessibility, security and device/browser QA.
