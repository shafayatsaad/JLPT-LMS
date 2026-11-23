"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "loading" | "ready" | "setup" | "verify";

export function AdminMfaChallenge({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState("");
  const [hasUnverifiedFactor, setHasUnverifiedFactor] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadFactors() {
      if (!supabase) {
        if (active) {
          setMessage("Supabase is not configured for this environment.");
          setMode("ready");
        }
        return;
      }
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (error) {
        setMessage("Authenticator status could not be loaded. Refresh the page and try again.");
        setMode("ready");
        return;
      }
      const verified = data.totp[0];
      if (verified) {
        setFactorId(verified.id);
        setMode("verify");
        return;
      }
      setHasUnverifiedFactor(data.all.some((factor) => factor.factor_type === "totp" && factor.status === "unverified"));
      setMode("ready");
    }
    void loadFactors();
    return () => { active = false; };
  }, [supabase]);

  async function startEnrollment() {
    if (!supabase) {
      setMessage("Supabase is not configured for this environment.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { data: current, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setMessage("Authenticator setup could not be started. Refresh the page and try again.");
      setBusy(false);
      return;
    }
    if (current.totp[0]) {
      setFactorId(current.totp[0].id);
      setMode("verify");
      setBusy(false);
      return;
    }

    for (const factor of current.all.filter((item) => item.factor_type === "totp" && item.status === "unverified")) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) {
        setMessage("An unfinished authenticator setup must be cleared in the account before a new one can begin.");
        setBusy(false);
        return;
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "JLPT Practice Authenticator", issuer: "JLPT Practice" });
    if (error || !data?.totp?.qr_code || !data.totp.secret) {
      setMessage("Authenticator setup is unavailable. Enable TOTP factors in this Supabase Auth project, then retry.");
      setBusy(false);
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setHasUnverifiedFactor(false);
    setMode("setup");
    setBusy(false);
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !factorId || !/^\d{6}$/.test(code.trim())) {
      setMessage("Enter the current numeric code from your authenticator app.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) {
      setMessage("That code could not be verified. Check the authenticator clock and try the current code again.");
      setBusy(false);
      return;
    }
    router.replace(nextPath);
    router.refresh();
  }

  if (mode === "loading") return <p role="status">Checking authenticator setup…</p>;

  return (
    <div className="admin-mfa-challenge">
      {mode === "ready" ? (
        <>
          <p>Staff accounts need an authenticator app before they can open the admin workspace. You can use Google Authenticator, 1Password, or another TOTP app.</p>
          {hasUnverifiedFactor ? <p className="inline-notice">A previous authenticator setup was not completed. Starting again will remove only that unfinished factor.</p> : null}
          <button className="btn btn--primary auth-submit" type="button" disabled={busy || !supabase} onClick={() => void startEnrollment()}>{busy ? "Preparing setup…" : "Set up authenticator"}</button>
        </>
      ) : null}

      {mode === "setup" ? (
        <>
          <p>Scan this QR code with your authenticator app. If you cannot scan it, enter the secret manually. Keep the secret private.</p>
          <div className="admin-mfa-challenge__setup">
            <img className="admin-mfa-challenge__qr" src={qrCode} alt="Authenticator setup QR code" />
            <div><span className="field-hint">Manual setup secret</span><code className="admin-mfa-challenge__secret">{secret}</code></div>
          </div>
          <form className="auth-form" onSubmit={(event) => void verify(event)}>
            <label htmlFor="admin-mfa-code">Enter the six digit code shown by your authenticator
              <input id="admin-mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required />
            </label>
            <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify and continue"}</button>
          </form>
        </>
      ) : null}

      {mode === "verify" ? (
        <form className="auth-form" onSubmit={(event) => void verify(event)}>
          <p>Enter the current code from your registered authenticator app.</p>
          <label htmlFor="admin-mfa-code">Authenticator code
            <input id="admin-mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required />
          </label>
          <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify and continue"}</button>
        </form>
      ) : null}

      {message ? <p className="form-message form-message--error" role="alert">{message}</p> : null}
    </div>
  );
}
