"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type PaymentSheetSyncStatus = {
  payment_submission_id: string;
  submitted_at: string;
  student_name: string | null;
  student_email: string | null;
  plan_code: string;
  payment_status: string;
  sync_status: string;
  attempt_count: number;
  last_attempt_at: string | null;
  last_synced_at: string | null;
  last_error_code: string | null;
  updated_at: string;
};

type Readiness = {
  enabled: boolean;
  hasSpreadsheetId: boolean;
  hasClientEmail: boolean;
  hasPrivateKey: boolean;
  hasServiceRoleKey: boolean;
  hasCronSecret: boolean;
  sheetName: string;
  configured: boolean;
};

function statusLabel(status: string) {
  switch (status) {
    case "queued": return "Queued";
    case "syncing": return "Syncing";
    case "synced": return "Synced";
    case "failed": return "Failed";
    default: return status;
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" });
}

export function PaymentSheetSyncPanel({
  readiness,
  rows,
  migrationAvailable,
}: {
  readiness: Readiness;
  rows: PaymentSheetSyncStatus[];
  migrationAvailable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"sync" | "retry_failed" | "reconcile" | null>(null);
  const [message, setMessage] = useState("");
  const [reconciliation, setReconciliation] = useState<{
    databaseApprovedCount: number;
    sheetApprovedCount: number;
    missingInSheetCount: number;
    duplicateSheetRows: number;
    missingRequestIds: string[];
  } | null>(null);

  async function run(action: "sync" | "retry_failed" | "reconcile") {
    setBusy(action);
    setMessage("");
    try {
      const response = await fetch("/api/admin/google-sheets/payment-sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json().catch(() => ({})) as {
        error?: string;
        claimed?: number;
        synced?: number;
        failed?: number;
        retried?: number;
        state?: string;
        reconciliation?: {
          databaseApprovedCount: number;
          sheetApprovedCount: number;
          missingInSheetCount: number;
          duplicateSheetRows: number;
          missingRequestIds: string[];
        };
      };
      if (!response.ok) throw new Error(result.error || "The sync request could not be completed.");
      if (result.state === "disabled" || result.state === "configuration_incomplete") {
        throw new Error("Sync remains disabled until the integration settings are complete.");
      }
      if (action === "reconcile" && result.reconciliation) {
        setReconciliation(result.reconciliation);
        setMessage("Reconciled approved database payments against the sheet.");
      } else {
        setMessage(action === "retry_failed"
          ? "Retried " + (result.retried ?? 0) + " failed record(s). Synced " + (result.synced ?? 0) + " in this batch."
          : "Processed " + (result.claimed ?? 0) + " due record(s): " + (result.synced ?? 0) + " synced, " + (result.failed ?? 0) + " failed.");
        router.refresh();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The sync request could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  const failedCount = rows.filter((row) => row.sync_status === "failed").length;
  const queuedCount = rows.filter((row) => row.sync_status === "queued" || row.sync_status === "syncing").length;
  const syncedCount = rows.filter((row) => row.sync_status === "synced").length;

  return (
    <div className="payment-sheet-sync">
      <div className="integration-checks">
        <div><span>Automatic sync</span><strong>{readiness.enabled ? "Enabled" : "Disabled"}</strong></div>
        <div><span>Spreadsheet destination</span><strong>{readiness.hasSpreadsheetId ? "Present" : "Missing"}</strong></div>
        <div><span>Service account email</span><strong>{readiness.hasClientEmail ? "Present" : "Missing"}</strong></div>
        <div><span>Private key</span><strong>{readiness.hasPrivateKey ? "Present" : "Missing"}</strong></div>
        <div><span>Supabase service key</span><strong>{readiness.hasServiceRoleKey ? "Present" : "Missing"}</strong></div>
        <div><span>Scheduled job secret</span><strong>{readiness.hasCronSecret ? "Present" : "Missing"}</strong></div>
        <div><span>Sheet tab</span><strong>{readiness.sheetName}</strong></div>
        <div><span>Queue in latest 100</span><strong>{queuedCount} queued · {failedCount} failed · {syncedCount} synced</strong></div>
      </div>
      {!migrationAvailable ? <p className="section-note">Migration 033 or its required access grants are not available in this Supabase project yet. Reconcile and apply the migration before using the queue.</p> : null}
      {!readiness.configured ? <p className="section-note">No Google API calls are made until the owner supplies and enables the spreadsheet destination, service account credentials, and server-side Supabase service key.</p> : null}
      {readiness.configured && !readiness.hasCronSecret ? <p className="section-note">Manual sync is available, but the scheduled worker will not run until a server-side CRON_SECRET is configured.</p> : null}
      <div className="payment-sheet-actions">
        <button className="btn btn--primary" type="button" onClick={() => run("sync")} disabled={!readiness.configured || !migrationAvailable || busy !== null}>
          {busy === "sync" ? "Syncing…" : "Sync due batch"}
        </button>
        <button className="btn btn--secondary" type="button" onClick={() => run("retry_failed")} disabled={!readiness.configured || !migrationAvailable || failedCount === 0 || busy !== null}>
          {busy === "retry_failed" ? "Retrying…" : "Retry failed"}
        </button>
        <button className="btn btn--secondary" type="button" onClick={() => run("reconcile")} disabled={!readiness.configured || !migrationAvailable || busy !== null}>
          {busy === "reconcile" ? "Reconciling…" : "Reconcile approved payment IDs"}
        </button>
      </div>
      {message ? <p className="section-note" role="status" aria-live="polite">{message}</p> : null}
      {reconciliation ? <div className="payment-sheet-reconciliation" role="status">
        <h3>Latest reconciliation</h3>
        <p>{reconciliation.databaseApprovedCount} approved database payments · {reconciliation.sheetApprovedCount} matching sheet rows · {reconciliation.missingInSheetCount} missing · {reconciliation.duplicateSheetRows} duplicate IDs</p>
        {reconciliation.missingRequestIds.length ? <p>Missing request IDs (first {reconciliation.missingRequestIds.length}): <code>{reconciliation.missingRequestIds.join(", ")}</code></p> : null}
      </div> : null}
      {!rows.length ? (
        <div className="empty-state"><p>{migrationAvailable ? "No payment sync records are available yet." : "The sync queue will appear after migration 033 and its access grants are applied."}</p></div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Payment request</th><th>Learner</th><th>Plan</th><th>Payment</th><th>Sync</th><th>Attempts</th><th>Last synced</th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.payment_submission_id}>
                <td><code>{row.payment_submission_id.slice(0, 8)}</code><br /><span>{formatDate(row.submitted_at)}</span></td>
                <td>{row.student_name || "Learner"}<br /><span>{row.student_email || "—"}</span></td>
                <td>{row.plan_code}</td>
                <td>{row.payment_status}</td>
                <td><span className={"status-chip" + (row.sync_status === "failed" ? " status-chip--danger" : row.sync_status === "synced" ? "" : " status-chip--muted")}>{statusLabel(row.sync_status)}</span>{row.last_error_code ? <><br /><span>{row.last_error_code}</span></> : null}</td>
                <td>{row.attempt_count}</td>
                <td>{formatDate(row.last_synced_at)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <p className="section-note">The queue is the latest 100 requests by change time. Sender phone numbers are masked in the sheet; Google access still depends on sharing the sheet with the dedicated service account and limiting the spreadsheet audience.</p>
    </div>
  );
}

