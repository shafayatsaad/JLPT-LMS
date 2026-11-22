"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function safeNext(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/dashboard";
}

export function ConfirmEmail() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setError("");
    setBusy(true);

    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const tokenType = params.get("type");
    if (!tokenHash) {
      setError("This confirmation link is incomplete. Go back to sign up and request a new email.");
      setBusy(false);
      return;
    }
    if (tokenType !== "email" && tokenType !== "recovery") {
      setError("This account link has an unsupported action. Request a fresh email and try again.");
      setBusy(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured in this app. Please contact the site administrator.");
      setBusy(false);
      return;
    }

    try {
      const { error: authError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tokenType });
      if (authError) throw authError;
      window.location.assign(safeNext(params.get("next")));
    } catch {
      setError("This confirmation link may have expired or already been used. Request a fresh confirmation email and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="confirm-email">
      <p>Press the button to continue the account action from your email. This extra step helps prevent email security scanners from consuming a one-time link before you open it.</p>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      <button className="btn btn--primary" type="button" disabled={busy} onClick={() => void confirm()}>
        {busy ? "Confirming…" : "Continue securely"}
      </button>
    </div>
  );
}
