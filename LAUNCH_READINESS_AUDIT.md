# Local launch simulation audit

**Audit date:** 24 November 2026  
**Environment:** local Supabase in Docker; optimized Next.js server at `http://127.0.0.1:3001`. No hosted Supabase project was accessed or modified.

## What was checked

- Production Next.js build completed against the local Supabase configuration.
- 30 Playwright browser tests passed against the production build, including mobile/desktop accessibility checks, English/Bangla, free preview, paid-path return intent, phone-required signup, learner login/dashboard/sign-out, and the admin authenticator challenge.
- The timed exam runner completed a three-section N5 demo attempt, saved three answers, progressed through the section timers and opened the results page.
- Local database tests passed: 92 assertions across four SQL test files. TypeScript passed; unit tests passed 8/8; Supabase configuration validation passed. ESLint passed with 18 warnings and no errors.
- All 29 admin destinations returned a usable staff view under an MFA-authenticated local administrator. The source library, question/media import page and payment review path were also exercised.
- A folder import through the admin question importer created a synthetic, unpublished item, uploaded one image and one audio file, attached both to the draft and placed the content in review.
- The admin source-folder form accepted the supplied N5G PDF, saved a private source packet and archived the temporary QA packet through the UI.
- A learner submitted a sample checkout; an admin approved it; the payment changed to verified and an active entitlement appeared. No external payment provider was called.
- Email/password signup with the required phone, local phone change, fixed test OTP `123456`, and verified-phone state passed. The Google callback enforces the same verified-phone gate.
- The read-only schema audit found all 42 expected public tables, including the source-packet registry. The uploaded source library currently contains four active private reference packets.

## Implemented for local testing

- `/exams/n5/preview/session` is the free first-section entry point. It has a cover/instructions page, candidate fields, a single top-to-bottom vocabulary paper section, a separate answer sheet, five original sample questions, and browser-tab answer persistence. It is a preview, not a complete official or server-timed JLPT section.
- Paid mock links preserve the selected exam. Signed-out learners are sent through sign-in first. The local checkout creates fake payment requests; staff approval immediately grants the test entitlement.
- The timed exam paper shows the active section as one scrollable sheet with candidate lines, directions, question sequence and any attached audio/image. Exam screens keep a restrained test interface; the rest of the public/account site uses the Origami/Sakura theme.
- `/admin/sources` accepts one folder at a time with one PDF and optional MP3/M4A audio. It keeps source papers private and separate from learner content.
- `/admin/questions/new` accepts a folder containing `manifest.json` and referenced image/audio files. Imported content starts as drafts and enters question and asset review queues; the importer does not publish it.
- `npm run demo:local:production:resume` starts local Supabase and the optimized app without resetting existing demo data. It serves on port 3001, separate from the development port. `/dev/test-accounts` lists the local test profiles.

## Supplied reference packets

Four packets are available in the private local source library:

1. N5, July 2013 PDF and MP3.
2. N5, 2010–2011 PDF and M4A.
3. N4, December 2013 PDF and M4A. The parent folder is named N5, but the paper itself is N4, so it is labeled N4.
4. N5G layout reference PDF.

The N5G reference is nine A4 pages. A render inspection found page 2 corrupted, so it cannot safely serve as the sole pixel-accurate layout specification. The packets are stored as source material; their questions have **not** been transcribed into a reviewed production question bank. The only newly imported question/media pair is synthetic QA content and is clearly marked unpublished. Keep the supplied past papers private until redistribution rights are confirmed.

For content production, use the PDFs as private references, extract each question and its answer/audio mapping into a `manifest.json` folder, attach individual media files, preview the import, and send it through the independent content/asset review queues. A PDF upload does not automatically become learner-ready questions.

## Remaining launch gates

1. **Exam inventory and fidelity:** the public catalog has one N5 local six-question demo form; N1–N4 have no published forms. The configured launch target is at least three reviewed full mocks per level. Build and review complete, rights-cleared forms with official item quotas, timing, audio and answer keys before selling full exams. The five-question free preview is original demonstration content, not the official JLPT Section 1.
2. **Reference quality and rights:** obtain a clean replacement for the corrupted N5G page 2 and confirm written rights for storing, adapting and distributing each paper, audio track, image and translation. Rights on the four source packets remain unconfirmed.
3. **Google OAuth:** test the real provider in the intended hosted project with its OAuth client, authorized origins/callback URL, and site redirect allow-list. A live Google credential flow was not exercised in local Docker. Phone verification after OAuth is enforced in the app, but the external provider setup is still required.
4. **Phone/email delivery:** the local Supabase config uses fixed test OTPs and a dummy local SMS provider; no SMS is sent. Before hosted deployment, remove the local OTP map and dummy provider values and configure the production SMS provider. Configure hosted email SMTP, sender/domain authentication, signup/recovery templates and redirect URLs as well.
5. **Real payments:** current bKash flow is a manual request and admin verification simulation. Configure the actual payment provider or approved merchant process, production plan prices, webhook/return verification, reconciliation, refunds/cancellation policy, and security review before accepting money. Never treat a submitted form or screenshot as proof of payment.
6. **Google Sheets:** provide the authorized account/service credentials, spreadsheet ID and destination/tab, then configure and verify the live export. The local integration only exercises its database-backed simulation.
7. **Operational/legal release:** replace draft legal pages with approved privacy/terms/refund content, verify production secrets and backup/restore, monitoring, domain/TLS, rate limits and incident contacts, and complete a final hosted staging run.

## Test limitations

The 29 staff routes were checked for authorization and usable rendering; deeper interaction checks covered the source upload, question/media import, MFA and payment approval workflows. This is a broad local launch simulation, not a click-by-click acceptance sign-off for every admin control or a hosted production certification. The real Google provider, SMS/email delivery, payment rails and Sheets account cannot be proven without their external configuration.

## Lint notes

ESLint has no errors. Its 18 warnings are in the root layout’s existing font/stylesheet loading and existing raw image/internal navigation usage. They do not fail the production build or tests, but should be cleaned up before a strict zero-warning release.
