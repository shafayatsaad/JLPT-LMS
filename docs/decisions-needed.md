# V7 decisions and launch dependencies

The V7 blueprint is the current source of truth. Confirmed choices can be implemented; unresolved choices stay out of payment logic and public promises.

## Confirmed

- Payment method: bKash **Send Money**.
- Payment proof upload: optional; an image alone never verifies a payment.
- Premium plans use fixed durations; exact plan options remain open.
- Reporting requires CSV/XLSX export and Google Sheets sync. PostgreSQL remains authoritative.
- Student interface languages: English and Bangla. Scope of bilingual question explanations and content must be set before content production.
- Login step-up is risk-based; triggers are open. Staff MFA is mandatory.

## Still needed

- Verified bKash recipient account name/number and exact Send Money instructions.
- Plan names, BDT prices, exact durations, feature matrix, entitlement start/extension rules, and whether multiple pending payments are allowed.
- Whether the Send Money flow uses a reference number; keep it conditional until confirmed.
- Payment review time that can be promised, refund/cancellation rules, and access handling after a refund.
- Receipt retention period and staff access policy.
- Named staff assignments for payment review, support, content, and security roles.
- English/Bangla content coverage and approved Japanese-question explanations.
- Risk-based login OTP triggers, SMS/email provider configuration, rate limits, and abuse controls.
- Hosting provider, canonical domain, privacy/terms/refund policy text, support contact, and incident ownership.

## Build boundary

Do not enable checkout, display sample bKash details, promise a review SLA, grant premium access from a submission, or publish draft legal copy until the related decision is supplied. Optional receipt uploads also need private storage and a retention policy before implementation.
