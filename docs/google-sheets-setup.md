# Google Sheets reporting setup

This is the owner handoff and configuration guide for the V7.2 payment reporting integration. PostgreSQL remains authoritative. The server-only Sheets adapter, private outbox, retry log, admin status/retry controls, and scheduled worker are implemented locally, but sync is disabled by default and no Google API calls are made until all required server environment values are present and enabled.

## Owner details to supply

- Destination spreadsheet URL or ID.
- Exact existing worksheet/tab name. The integration initializes its header row when that tab is empty; it does not create or rename tabs.
- Google accounts authorized to open the spreadsheet (admin users only).
- Name/email of the person who owns the destination and can administer access.
- Whether payment rows, other admin reports, or both should be synced.
- Confirmation that a dedicated service account may be added as an editor to this spreadsheet.
- Final confirmation that the sheet should contain payment rows, including learner name/email and transaction/reference IDs. Sender phone is masked to its last four digits.

## Access model

- Share the spreadsheet directly with only the named Google accounts the owner authorizes as administrators. Supabase app roles do not automatically grant access in Google Drive.
- Use a dedicated Google Cloud service account for server-to-server sync. Share only this spreadsheet with its service-account email and grant the minimum required editor access.
- Store its private key only in Vercel server-side environment variables and local `.env.local` for private development. Do not commit either file or expose credentials in browser code.
- Sync is an export/reporting copy. Spreadsheet edits must never approve a payment or grant premium access.
- The export outbox and event history live in the private Supabase schema. Client roles cannot query them directly; the server worker uses service-role-only RPCs.
- Stable Payment Request IDs are used to update existing rows or append a new row, so retries do not intentionally create duplicates. Payment changes bump the outbox revision and are re-synced.
- The worker writes with RAW input mode, initializes an empty tab with the expected headers, and stops safely if a non-empty header row differs.
- Sync errors are recorded separately from payment state. Review, approval and entitlement activation continue even when Google Sheets is unavailable.

## Vercel environment template

Set these in the Vercel project’s environment settings for the intended deployment target. Start with Preview only; keep Production disabled until the owner approves live operation.

```dotenv
GOOGLE_SHEETS_SYNC_ENABLED=false
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_SHEET_NAME=Payments
GOOGLE_SHEETS_CLIENT_EMAIL=
GOOGLE_SHEETS_PRIVATE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

Use a dedicated Google Cloud service account and enable the Google Sheets API in its project. Share only the approved spreadsheet with the service-account email as an editor. Preserve private-key newlines or use escaped `\n`; the adapter converts escaped newlines. Set `CRON_SECRET` to a long random value. Keep `GOOGLE_SHEETS_SYNC_ENABLED=false` until the owner has reviewed the exact destination, tab headers, data fields and Google access list. Never paste the key into chat, source code or a spreadsheet.

## Implemented behavior

Migration `202611230033_payment_sheet_sync.sql` creates the private queue and event log, queues existing and new payment requests, and adds admin-only status/retry RPCs. The cron endpoint processes one bounded batch per run; `/admin/settings/integrations` also offers manual sync, failed-record retry and a read-only reconciliation comparing approved database payment IDs with sheet IDs (including missing and duplicate counts) for admins with AAL2. The reconciliation does not change either system. The scheduled endpoint requires `Authorization: Bearer <CRON_SECRET>`.

The Vercel schedule is daily at 03:00 UTC, suitable for a low-frequency starter schedule. Vercel scheduled functions run on Production deployments; the admin control can be used for an authorized Preview check after the migration and credentials are configured. The scheduled route safely returns without claiming records while sync is disabled or configuration is incomplete.

The Google sheet includes payment request ID, UTC and Bangladesh submission time, student identity, plan and amount, payment method, sender name, masked sender number, transaction/reference IDs, payment and review status, reviewer, safe rejection reason code, entitlement period, and sync status. Do not share the destination beyond the named accounts approved by the owner.

## Still needed before an end-to-end acceptance

The owner must provide/approve the destination spreadsheet and tab, authorized Google accounts, dedicated service account and sharing, and confirm the reporting fields. Then reconcile and apply migration 033, configure Preview-only secrets, and verify the status and audit flow with a non-sensitive test payment. Production should stay disabled until the owner accepts that Preview result and explicitly supplies Production environment values.
