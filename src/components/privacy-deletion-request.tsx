"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AccountDeletionRequestSummary = {
  id: string;
  status: "received" | "under_review" | "awaiting_owner_policy" | "withdrawn";
  created_at: string;
  updated_at: string;
};

const requestStatusMessages: Record<AccountDeletionRequestSummary["status"], MessageKey> = {
  received: "privacy.status.received",
  under_review: "privacy.status.under_review",
  awaiting_owner_policy: "privacy.status.awaiting_owner_policy",
  withdrawn: "privacy.status.withdrawn",
};

function isRequestSummary(value: unknown): value is AccountDeletionRequestSummary {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string"
    && typeof row.status === "string"
    && typeof row.created_at === "string"
    && typeof row.updated_at === "string";
}

export function PrivacyDeletionRequest({
  initialRequest,
  unavailable = false,
}: {
  initialRequest: AccountDeletionRequestSummary | null;
  unavailable?: boolean;
}) {
  const router = useRouter();
  const { language, t } = useLocale();
  const [request, setRequest] = useState(initialRequest);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isOpen = Boolean(request && request.status !== "withdrawn");
  const dateLabel = request
    ? new Intl.DateTimeFormat(language === "bn" ? "bn-BD" : "en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(request.created_at))
    : "";

  async function submit(action: "request" | "withdraw") {
    const supabase = createSupabaseBrowserClient();
    if (!supabase || unavailable) {
      setError(t("privacy.requestError"));
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data, error: rpcError } = action === "request"
        ? await supabase.rpc("request_account_deletion")
        : await supabase.rpc("withdraw_account_deletion_request", { p_request_id: request?.id });
      if (rpcError || !isRequestSummary(data)) {
        setError(t("privacy.requestError"));
        return;
      }
      setRequest(data);
      setConfirmed(false);
      setNotice(action === "request" ? t("privacy.requestReceived") : t("privacy.requestWithdrawn"));
      router.refresh();
    } catch {
      setError(t("privacy.requestError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="privacy-request-workflow">
      <p><strong>{t("privacy.requestExplanation")}</strong></p>
      {unavailable ? <p className="inline-notice" role="status">{t("privacy.requestError")}</p> : null}
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {notice ? <p className="form-message form-message--success" role="status">{notice}</p> : null}
      {request ? <div className="privacy-request-workflow__current">
        <span className="status-chip">{t(requestStatusMessages[request.status])}</span>
        <p>{t("privacy.requestSubmitted", { date: dateLabel })}</p>
      </div> : null}
      {!isOpen ? <>
        <label className="privacy-request-workflow__confirm">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={busy || unavailable} />
          <span>{t("privacy.confirmRequest")}</span>
        </label>
        <button className="btn btn--secondary" type="button" disabled={busy || unavailable || !confirmed} onClick={() => void submit("request")}>
          {busy ? t("common.saving") : t("privacy.submitRequest")}
        </button>
      </> : <button className="btn btn--secondary" type="button" disabled={busy || unavailable} onClick={() => void submit("withdraw")}>
        {busy ? t("common.saving") : t("privacy.withdrawRequest")}
      </button>}
    </div>
  );
}
