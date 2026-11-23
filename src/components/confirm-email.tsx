"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/i18n/locale-provider";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/dashboard";
}

export function ConfirmEmail() {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setError("");
    setBusy(true);

    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const tokenType = params.get("type");
    if (!tokenHash) {
      setError(t("auth.confirm.incomplete"));
      setBusy(false);
      return;
    }
    if (tokenType !== "email" && tokenType !== "recovery") {
      setError(t("auth.confirm.unsupported"));
      setBusy(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(t("auth.confirm.unconfigured"));
      setBusy(false);
      return;
    }

    try {
      const { error: authError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tokenType });
      if (authError) throw authError;
      window.location.assign(safeNext(params.get("next")));
    } catch {
      setError(t("auth.confirm.expired"));
      setBusy(false);
    }
  }

  return (
    <div className="confirm-email">
      <p>{t("auth.confirm.body")}</p>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      <button className="btn btn--primary" type="button" disabled={busy} onClick={() => void confirm()}>
        {busy ? t("auth.confirm.busy") : t("auth.confirm.button")}
      </button>
    </div>
  );
}
