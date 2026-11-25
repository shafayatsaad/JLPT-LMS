# JLPT LMS product audit

**Snapshot:** 25 November 2026  
**Environment:** Windows workspace, Docker-local Supabase, Next.js production container on port 3002  
**Scope:** all 82 files under `src/app`, route and navigation components, server/client Supabase access, 43 public tables, migrations, demo content, test scripts, and local Docker configuration.

## Summary

The repository is a working Next.js 16.4.6 App Router application with a Docker-local Supabase backend, role-gated staff areas, learner flows, a server-managed exam attempt model, content review, simulated manual payments, and an Origami/Sakura public/account design. The exam interface uses a restrained paper layout. A production Docker image now builds and serves locally.

This is not a launch-ready exam catalog. Local inventory has no published forms for N1–N4, and its 34 N5 published forms include 33 QA-generated records. Counts do not establish item quotas, rights, answer-key quality, audio completeness, or independent review. Supplied past-paper PDFs and recordings remain private references.

## Route and workflow inventory

The route source contains 82 page and handler files. Dynamic admin routing maps additional admin destinations through `/admin/[[...section]]/page.tsx`; the 22 admin route files therefore cover more than 22 destinations. Core routes below are grouped by journey. The full file-level route list is available from `rg --files src/app`.

| Area | Routes | Current behavior and verification | Gaps / disposition |
|---|---|---|---|
| Public | `/`, `/about`, `/contact`, `/faq`, `/how-it-works`, `/levels`, `/levels/[level]`, `/pricing`, `/legal/[policy]` | Origami/Sakura marketing and information pages; homepage has one loopable hero video with still/reduced-motion fallback. Desktop/mobile accessibility checks cover key public pages. | Pricing outside local demo remains a planning preview pending owner-approved prices and payment provider. Legal pages are draft text. Keep and refine. |
| Authentication | `/auth/login`, `/auth/register`, `/auth/callback`, `/auth/confirm`, `/auth/continue`, `/auth/forgot-password`, `/auth/update-password`, `/auth/phone`, `/auth/mfa`, `/auth/step-up-unavailable`, `/admin/sign-in`, `/admin/mfa` | Local student sign-in/sign-out, Google option visibility, no phone requirement for Google/email account creation, and mandatory staff TOTP challenge are covered in browser tests. Server-side role and staff MFA checks exist. | Live Google OAuth, SMTP and SMS are not verified against hosted provider settings. Phone delivery is a local demo simulation. |
| Learner | `/dashboard`, `/account`, `/settings`, `/settings/notifications`, `/settings/privacy`, `/settings/privacy/export`, `/settings/security`, `/notifications`, `/exams`, `/exams/[formId]`, `/subscription`, `/payments`, `/upgrade`, `/upgrade/bkash`, `/support`, `/support/[ticketId]` | Dashboard, profile, sign-out, student nav, support/payment destinations, and main exam discovery are implemented. Local checkout is explicitly marked simulated. | Not every control, empty state, denial, support transition, export, and payment state has a browser action test. The old `/payments` route redirects to `/subscription`; retain as a compatibility route. |
| Practice and results | `/practice`, `/practice/[sessionId]`, `/practice/[sessionId]/review`, `/bookmarks`, `/mistakes`, `/progress`, `/leaderboard`, `/results/[attemptId]`, `/review/[attemptId]` | Practice, saved questions, mistake review, result/review views, progress, and pseudonymous leaderboard are database-backed. Learner navigation consolidates these destinations. | Full result/review correctness and privacy preference branches need a wider acceptance pass with varied completed attempts. |
| Free sample | `/exams/n5/preview`, `/exams/n5/preview/instructions`, `/exams/n5/preview/session`, `/exams/n5/preview/results`, `/exams/n5/preview/review` | Five original sample items in a scrollable paper section, a separate answer sheet, browser persistence, and mobile layout. The sample is clearly labeled as a demonstration. | Not a complete JLPT section and has no listening recording. Do not market it as a complete mock. |
| Staff content | `/admin`, `/admin/content`, `/admin/questions`, `/admin/questions/new`, `/admin/questions/[questionId]`, `/admin/reviews`, `/admin/assets`, `/admin/sources` | Role-filtered staff overview; question authoring/editing; private media; import-to-draft; separate question and asset review; private source packets. | Folder/JSON/CSV/XLSX/ZIP import is now available; broad file-safety, spreadsheet edge-case, and all role permutations still need regression coverage. PDFs remain reference-only. |
| Staff exams | `/admin/blueprints`, `/admin/exam-forms`, `/admin/exam-forms/[formId]`, `/admin/exam-preview`, `/admin/attempts` | Blueprint-based form assembly, validation, preview, frozen publication, and attempt monitor. The primary admin workflow is tested. Published forms reject mutation. | Preview route is a fixed N5 sample rather than a live preview of the currently selected form. Complete-form inventory and authoring volume remain launch blockers. |
| Staff students/support | `/admin/users`, `/admin/staff`, `/admin/support`, `/admin/support/[ticketId]`, `/admin/privacy` | Admin role checks, learner/staff directory, support requests, privacy requests and staff-management destinations exist. | Role changes, every support status transition, deletion-request lifecycle and attachment-denial cases are not fully tested. |
| Staff payments/reporting/settings | `/admin/payments`, `/admin/payments/[paymentId]`, `/admin/plans`, `/admin/entitlements`, `/admin/reports`, `/admin/reports/export`, `/admin/audit`, `/admin/announcements`, `/admin/settings`, `/admin/settings/email`, `/admin/settings/general`, `/admin/settings/maintenance`, `/admin/settings/notifications`, `/admin/settings/security`, `/admin/settings/integrations`, `/admin/settings/payments` | Local fake checkout and admin approval previously exercised; payment and entitlement tables/RPCs are present. Navigation now exposes six top-level areas: Overview, Content, Exams, Students, Payments, Reports & Settings. | Some settings are status/integration surfaces and need a clear action-by-action acceptance pass. Live bKash, Sheets, SMTP, monitoring, and production secrets are not configured. |
| API and jobs | `/api/admin/google-sheets/payment-sync`, `/api/auth/step-up`, `/api/auth/trusted-device`, `/api/jobs/entitlement-notifications`, `/api/jobs/google-sheets/payment-sync`, `/api/payment-requests`, `/api/payment-requests/[paymentId]/receipt`, `/api/support/messages/[messageId]/attachment` | Server routes use Supabase-backed authorization and local job settings; payments, private receipts/attachments, step-up and integration endpoints are implemented. | Scheduled delivery and external integrations are not live. Test API role denial, rate limits, upload spoofing and provider failures before launch. |

## Data, roles, and local environment

- Docker-local migration history is fully applied through `202611250054`; a read-only catalog query found 43 public tables, and the local expected-table audit reports 43/43.
- Local Supabase SQL tests pass 124 assertions across five files. This is not a full security audit of all RLS and storage policies.
- Local content inventory reports 0 published forms for N1, N2, N3, N4 and 34 for N5, of which 33 have synthetic `N5-PHASE*` QA codes. N5 is not a rights-cleared inventory.
- Local demo accounts include a subscribed learner and a separate no-entitlement learner for checking premium gates; these are local-only accounts.
- Five private source packets are registered in the local database. The locally supplied paper folders and PDFs/audio are not automatically learner content.
- Local checkout and payment verification are simulations. No real money is accepted or sent.
- Docker has a production Next.js app container on `127.0.0.1:3002` and the Supabase CLI manages its own local service containers. This uses the persistent local Supabase volumes; the app launcher does not reset them.
- At audit time Supabase DB, Auth, Storage, Studio, Realtime, and Analytics reported healthy. The Vector log collector had recently restarted because it could not reach Docker's optional host log endpoint; this does not currently block database/auth/storage requests.

## Prioritized issues

### P0 — security, data integrity, exam integrity

- No P0 issue was confirmed by the current checks. This does not certify production security: hosted OAuth, production RLS/storage behavior, external provider secrets, backup/restore, monitoring, and full route authorization have not been audited end to end.

### P1 — required before launch

1. **Exam inventory:** create complete, independently reviewed and rights-cleared exam forms for the intended launch levels. No N1–N4 forms currently exist; N5's local count is polluted by QA fixtures.
2. **Exam fidelity gaps:** per-form section breaks are not modeled; listening is not preflighted before the section; a disconnected browser is not finalized by a scheduled worker. Browser Back now opens a confirmation and refresh/tab-close use the native warning, but behavior remains browser-controlled.
3. **Content approval:** confirm source licenses/permissions, replace the corrupted N5G reference page 2, complete question/audio/answer-sheet review, and keep PDFs private until rights are clear.
4. **Production integrations:** live OAuth, email/SMS delivery, payment provider, Google Sheets, operations monitoring, and restore drills need credentials/configuration and owner acceptance.
5. **Testing breadth:** the current browser suite verifies key journeys rather than every route/action/role/error branch. Build a route/action acceptance matrix and close the remaining branches.

### P2 — important workflow improvements

- Review the more than 80 route files against empty/error/loading states, keyboard flow, device sizes and translated content.
- Replace the fixed admin N5 sample preview with preview of the selected draft form using the learner renderer.
- Test the new import parsers against malformed spreadsheets, duplicate IDs, malformed/hostile ZIPs, large files, missing audio and storage failure.
- Add durable attempt finalization, audio readiness checks, and approved break behavior once policy decisions are confirmed.

### P3 — polish

- Continue Origami/Sakura visual refinement, animation tuning, and responsive spacing outside the active paper-style exam. No cosmetic change should alter save behavior or paper readability.

## Scope note and audit correction

The earlier `supabase:audit` script read `.env.local`, which pointed at the hosted Supabase URL. During baseline discovery it issued read-only table-presence requests with `limit=0`; it fetched no rows and performed no writes. Both schema and content audit scripts have been changed to read the Docker-local API URL/key from `supabase status` and to reject non-loopback URLs. Subsequent audits and tests used local Docker only.

## Existing detailed records

- [Phase 2 workflow audit](../PHASE2_WORKFLOW_AUDIT.md)
- [Phase 3 workflow audit](../PHASE3_WORKFLOW_AUDIT.md)
- [Launch readiness audit](../LAUNCH_READINESS_AUDIT.md)
