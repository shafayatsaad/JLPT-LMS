"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminAccountDeletionRequest = {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  status: "received" | "under_review" | "awaiting_owner_policy" | "withdrawn";
  created_at: string;
  updated_at: string;
};

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date);
}

export function PrivacyDeletionQueue({ requests }: { requests: AdminAccountDeletionRequest[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function updateStatus(requestId: string, status: "received" | "under_review" | "awaiting_owner_policy") {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured for this session.");
      return;
    }
    setBusy(requestId);
    setError("");
    setNotice("");
    try {
      const { error: updateError } = await supabase.rpc("set_admin_account_deletion_request_status", {
        p_request_id: requestId,
        p_status: status,
      });
      if (updateError) {
        setError("The request status could not be updated. Confirm migration 029 and administrator access.");
        return;
      }
      setNotice("Privacy request status updated. This action does not delete account data.");
      router.refresh();
    } catch {
      setError("The request status could not be updated. Please try again.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="privacy-deletion-queue">
      <div className="privacy-deletion-queue__notice">
        <strong>Request intake only.</strong>
        <p>This queue does not delete accounts or data. Verify the requester and follow the owner-approved retention and deletion procedure outside this screen.</p>
      </div>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {notice ? <p className="form-message form-message--success" role="status">{notice}</p> : null}
      {requests.length ? <div className="privacy-deletion-queue__list">{requests.map((request) => (
        <article className="privacy-deletion-record" key={request.id}>
          <div className="privacy-deletion-record__heading">
            <div><span className={`status-chip ${request.status === "withdrawn" ? "status-chip--muted" : ""}`}>{request.status.replaceAll("_", " ")}</span><h2>{request.display_name || "Learner account"}</h2><p>{request.email || "No email address on account"}</p></div>
            <code>{request.id.slice(0, 8)}</code>
          </div>
          <dl><div><dt>Account ID</dt><dd><code>{request.user_id}</code></dd></div><div><dt>Submitted · UTC</dt><dd>{dateTime(request.created_at)}</dd></div><div><dt>Last updated · UTC</dt><dd>{dateTime(request.updated_at)}</dd></div></dl>
          {request.status !== "withdrawn" ? <div className="privacy-deletion-record__actions">
            {request.status !== "received" ? <button className="btn btn--secondary" type="button" disabled={Boolean(busy)} onClick={() => void updateStatus(request.id, "received")}>Mark received</button> : null}
            {request.status !== "under_review" ? <button className="btn btn--secondary" type="button" disabled={Boolean(busy)} onClick={() => void updateStatus(request.id, "under_review")}>{busy === request.id ? "Saving…" : "Mark in review"}</button> : null}
            {request.status !== "awaiting_owner_policy" ? <button className="btn btn--secondary" type="button" disabled={Boolean(busy)} onClick={() => void updateStatus(request.id, "awaiting_owner_policy")}>Waiting for approved policy</button> : null}
          </div> : null}
        </article>
      ))}</div> : <div className="empty-state"><p>No deletion requests match this filter.</p></div>}
      {requests.length === 200 ? <p className="section-note">Showing the newest 200 requests. Filter by status to narrow the queue.</p> : null}
    </div>
  );
}
