# Google Sheets reporting setup

This is the owner handoff template for the V7.2 reporting integration. The platform database remains authoritative. No live Sheets reads or writes are connected yet, and sync is disabled by default.

## Owner details to supply

- Destination spreadsheet URL or ID.
- Exact worksheet/tab name and its header row, or approval for the integration to create a dedicated tab.
- Google accounts authorized to open the spreadsheet (admin users only).
- Name/email of the person who owns the destination and can administer access.
- Whether payment rows, other admin reports, or both should be synced.
- Confirmation that a dedicated service account may be added as an editor to this spreadsheet.

## Access model

- Share the spreadsheet directly with only the named Google accounts the owner authorizes as administrators. Supabase app roles do not automatically grant access in Google Drive.
- Use a dedicated Google Cloud service account for server-to-server sync. Share only this spreadsheet with its service-account email and grant the minimum required editor access.
- Store its private key only in Vercel server-side environment variables and local `.env.local` for private development. Do not commit either file or expose credentials in browser code.
- Sync is an export/reporting copy. Spreadsheet edits must never approve a payment or grant premium access.

## Vercel environment template

Set these in the Vercel project’s environment settings for the intended deployment target. Start with Preview only; keep Production disabled until the owner approves live operation.

```dotenv
GOOGLE_SHEETS_SYNC_ENABLED=false
GOOGLE_SHEETS_SPREADSHEET_ID=
GOOGLE_SHEETS_CLIENT_EMAIL=
GOOGLE_SHEETS_PRIVATE_KEY=
```

The private key should preserve newlines or use escaped `\n` characters according to the eventual server adapter. The current admin Integration Settings page checks only whether values are present and never displays their contents. It does not connect or write to Sheets.

## Implementation still required

The admin `/admin/reports` route now downloads audited CSV and XLSX copies directly from PostgreSQL. Before enabling Sheets sync, build the separate server-only adapter, administrator authorization, stable payment-request ID upsert, append/update policy, retry-safe job, sync log with last status and error, and operational retry control. A failed sync must not block payment review. The spreadsheet destination and named access list must be supplied before those choices are finalized.
