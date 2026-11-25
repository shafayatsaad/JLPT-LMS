# Implementation status

**Updated:** 25 November 2026  
**Project status:** usable local test platform; not ready for public paid launch.

## Completed and verified in the local environment

- Public Origami/Sakura site and reduced-motion still-image behavior; exam screens remain paper-oriented.
- Student account/profile, dashboard, exam discovery, practice/review destinations, results, bookmarks, notifications, settings, support, progress and privacy-safe leaderboard.
- Student Google and email account creation are not blocked on entering a phone number. Staff sign-in requires TOTP. Live Google OAuth provider configuration remains unverified.
- Local test profiles now separate the subscribed demo learner from a free learner with no entitlements, allowing realistic premium-lock and free-exam testing without changing existing payment history.
- Staff navigation reduced to six areas while preserving role-based destinations.
- Content authoring/editing, JSON manifest and folder import, CSV/XLSX parsing, ZIP package extraction with path/file-size restrictions, private asset upload and independent review queues.
- Exam form assembly, blueprint validation, preview, frozen publication and server-managed attempt records.
- Candidate cover, server-timed five-minute preparation, scrollable paper section, separate answer sheet, answer persistence/retry, listening play limit, section timing and results flow.
- Active attempts now confirm browser Back and sign-out; refresh/tab close use a browser-native beforeunload warning while keeping the server attempt and answers intact.
- Local simulated payment request and admin verification. The sandbox is labeled and does not call a real provider.
- Docker-local Supabase plus production Next.js app container. `npm run demo:local:docker` starts the app without resetting local database volumes; current container health passes on port 3002.
- Local schema audit sees 43/43 expected tables; five SQL test files pass 124 assertions.
- Production-container E2E passes 32/32; unit tests pass 16/16; typecheck passes; ESLint has 0 errors and 19 warnings.

## Implemented but not fully verified

- CSV/XLSX/ZIP content intake supports one data sheet/file with nested JSON cells and optional referenced media. Happy-path import and media review pass in the production-container E2E; adversarial ZIP and spreadsheet cases still need security tests.
- All student and admin destinations exist, but current E2E coverage does not exercise every action, role, error, empty state, API denial, or mobile workflow.
- Admin preview remains the fixed N5 preview rather than the actual selected form.
- Local source library contains five private reference packets, but no supplied paper was transcribed into approved launch question content.
- Docker app health is checked; database backup/restore has not been drilled.

## Launch blockers and external inputs

- Rights-cleared complete mock inventory and independent content reviewers. Current local published inventory is 0 forms N1–N4 and 36 N5 forms, including 35 synthetic QA forms; counts are not a content-quality or launch-readiness measure.
- Owner-approved break schedule, listening failure policy and candidate-number policy.
- Live Google OAuth credentials and redirect configuration; email delivery; SMS provider when enabled; real payment provider and recipient/prices; Google Sheets account/destination; monitoring and support/legal owner decisions.
- Production migration review, RLS and storage authorization audit, rate-limit review, data-retention rules, backup/restore procedure and staging acceptance.

## This audit turn

- Corrected the schema/content audit scripts so they always target the local Docker Supabase stack, not `.env.local`.
- Consolidated admin primary navigation into Overview, Content, Exams, Students, Payments, and Reports & Settings.
- Expanded question import to JSON, CSV, XLSX, ZIP, and folder packages; PDFs are rejected as question imports and remain source references.
- Added a no-entitlement local learner, preserving the existing learner’s simulated subscription and history; tested premium lock, free exam start, answer persistence, listening and result submission.
- Added browser Back/sign-out confirmation and native refresh/tab-close warning for active exam attempts; the production-container browser suite verifies all three paths.
- Added a Docker-local payment E2E: a learner submits a simulated checkout, staff approves it, and the linked entitlement becomes active. It sends no real payment.
- Rebuilt and started the optimized app in Docker on port 3002 without resetting Supabase data; the complete 32-test production-container browser suite passed. The free learner remains separate from the subscribed account used in payment testing.
