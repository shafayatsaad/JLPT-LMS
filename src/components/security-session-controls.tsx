"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/i18n/locale-provider";

export function RevokeOtherSessionsButton() {
  const { t } = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function revokeOtherSessions() {
    const supabase = createSupabaseBrowserClient();
    setMessage("");
    setError("");
    if (!supabase) {
      setError(t("security.sessionsRevokeFailed"));
      return;
    }

    setBusy(true);
    try {
      const { error: revokeError } = await supabase.auth.signOut({ scope: "others" });
      if (revokeError) throw revokeError;
      setMessage(t("security.sessionsRevoked"));
      setConfirming(false);
    } catch {
      setError(t("security.sessionsRevokeFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="session-management">
      <p className="section-note">{t("security.sessionsDescription")}</p>
      {message ? <p className="inline-notice" role="status">{message}</p> : null}
      {error ? <p className="inline-notice" role="alert">{error}</p> : null}
      {confirming ? (
        <div className="session-management__confirm" role="group" aria-label={t("security.sessionsTitle")}>
          <p>{t("security.sessionsConfirm")}</p>
          <div className="product-cta-row">
            <button className="btn btn--primary" type="button" disabled={busy} onClick={() => void revokeOtherSessions()}>
              {busy ? t("security.sessionsRevoking") : t("security.sessionsConfirmAction")}
            </button>
            <button className="btn btn--secondary" type="button" disabled={busy} onClick={() => setConfirming(false)}>
              {t("security.sessionsCancel")}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn btn--secondary" type="button" onClick={() => { setMessage(""); setError(""); setConfirming(true); }}>
          {t("security.sessionsRevokeAction")}
        </button>
      )}
    </div>
  );
}
