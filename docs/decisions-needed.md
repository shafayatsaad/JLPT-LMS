# V7.2 owner inputs and launch gates

The V7.2 blueprint is the product source of truth. Its proposed defaults are usable for demos, but they are not confirmed business facts. The app must continue to label them as previews until approved.

## Confirmed for the current testing phase

- Supabase Auth: Google sign-in and email/password are enabled. Phone/SMS is deferred and hidden in the UI until configured.
- Hosting: a Vercel `*.vercel.app` deployment is used for sharing with testers. It is a testing origin, not the final public domain.
- Product design: Origami/Sakura surfaces; exam-taking views stay clear and high contrast.
- V7.2 confirms bKash Send Money, optional receipt upload, fixed-duration premium plans, English/Bangla student UI, and CSV/XLSX plus Google Sheets reporting.
- PostgreSQL remains authoritative. Google Sheets is not an access-control or payment-approval system.

## Proposed defaults currently shown in the app

- A free/premium access matrix follows the V7.2 proposal and remains marked as subject to owner approval and content inventory.
- Premium plan preview uses 30, 90 and 365 days. Prices are pending; purchase buttons are disabled.
- Sheets integration configuration remains disabled and read-only until the owner supplies the destination, authorized Google account list, and service-account setup.

## Owner-supplied details still required

- Support screenshot malware-scanning provider and retention/deletion schedule.
- Final product name/domain and canonical launch origin.
- bKash recipient display name, number, Send Money instructions and reference-number behavior.
- BDT prices and final access matrix; confirm 30/90/365-day durations and proposed extension behavior.
- Staffable review target, payment reviewer assignments, refunds/cancellations and local legal/accounting review.
- Receipt retention and access policy.
- Content inventory, provenance/licenses, N1–N5 review schedule, Bangla coverage and human translation review.
- Named staff accounts/roles, MFA/recovery plan, support contact, incident lead/backup, operator identity and approved legal copy.
- **Implemented locally:** learner step-up uses authenticator-app TOTP after password or Google sign-in. Verified TOTP accounts are challenged on unrecognized sessions; the current proposed remembered-device default is 30 days. Still needed before production: owner approval of the duration, lost-authenticator recovery/fallback procedure, and any additional risk signals beyond device recognition. See the [Supabase MFA guide](https://supabase.com/docs/guides/auth/auth-mfa).
- Verified email sender identity/provider and approved email-template copy before enabling outbound product or payment notifications.
- Google Sheets destination/tab, authorized admin Google accounts, and permission to add a dedicated service account.

## Launch boundary

Do not enable checkout, publish placeholder bKash details, promise a review SLA, grant premium access from an unreviewed submission, or present draft legal text as approved. Keep the current Vercel deployment suitable for testing and add its exact host to Supabase redirect allow lists. Production launch waits for owner, content, security, operational and legal gates in V7.2.
