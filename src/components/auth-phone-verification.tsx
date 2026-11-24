"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function safeNextPath() {
  const value = new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/dashboard";
}

export function AuthPhoneVerification() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (cancelled) return;
      if (authError || !data.user) {
        router.replace(`/auth/login?next=${encodeURIComponent(safeNextPath())}`);
        return;
      }
      if (data.user.phone && data.user.phone_confirmed_at) {
        router.replace(safeNextPath());
        return;
      }
      const metadataPhone = typeof data.user.user_metadata?.phone_number === "string" ? data.user.user_metadata.phone_number : "";
      setPhone(data.user.phone ?? metadataPhone);
    });
    return () => { cancelled = true; };
  }, [router]);

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = phone.trim().replace(/[\s().-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      setError("Use international format, for example +8801XXXXXXXXX.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured in this browser session.");
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ phone: normalized });
      if (updateError) throw updateError;
      setPhone(normalized);
      setStage("code");
      setMessage(`A verification code was sent to ${normalized}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The verification code could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured in this browser session.");
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ phone, token: code.trim(), type: "phone_change" });
      if (verifyError) throw verifyError;
      window.location.assign(safeNextPath());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That verification code could not be confirmed.");
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={(event) => void (stage === "phone" ? sendCode(event) : verifyCode(event))}>
      {stage === "phone" ? <label>Mobile number<input required type="tel" autoComplete="tel" inputMode="tel" maxLength={24} placeholder="+8801XXXXXXXXX" value={phone} onChange={(event) => setPhone(event.target.value)} /><span className="field-hint">Use the country code. We verify this once before opening your learner workspace.</span></label> : <><p className="field-hint">Enter the code sent to <strong>{phone}</strong>.</p><label>Verification code<input required inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={code} onChange={(event) => setCode(event.target.value.replace(/\s/g, ""))} /></label></>}
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
      <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : stage === "phone" ? "Send verification code" : "Verify and continue"}</button>
      {stage === "code" ? <button className="text-link" type="button" disabled={busy} onClick={() => { setStage("phone"); setCode(""); setMessage(""); }}>Change phone number</button> : null}
    </form>
  );
}
