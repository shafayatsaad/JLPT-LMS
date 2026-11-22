"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "register" | "login" | "recovery" | "update-password";

function safeNextPath() {
  const value = new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/dashboard";
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [targetLevel, setTargetLevel] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [signupAwaitingCode, setSignupAwaitingCode] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const notice = new URLSearchParams(window.location.search).get("notice");
    const messages: Record<string, string> = {
      "verification-link-invalid": "That verification link is incomplete. Request a new email and use its confirmation button or code.",
      "verification-link-expired": "That verification link has expired or was already used. Request a fresh email.",
      "verification-failed": "We couldn't complete verification. Request a new email and try again.",
      "oauth-cancelled": "Google sign-in was cancelled. You can try again or use email sign-in.",
      "staff-access-required": "This account does not have staff access. Please sign in with an authorized staff account.",
    };
    if (notice && messages[notice]) setError(messages[notice]);

    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (hashParams.has("error") || hashParams.has("error_code")) {
      setError("The email link could not be completed. It may have expired or been opened by an email link scanner. Request a fresh email and use its code or confirmation button.");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured. Copy the project values into .env.local, then restart the app.");
      setBusy(false);
      return;
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const callback = new URL("/auth/callback", siteUrl);
    callback.searchParams.set("next", mode === "recovery" ? "/auth/update-password" : safeNextPath());

    try {
      if (mode === "register") {
        if (signupAwaitingCode) {
          const { error: authError } = await supabase.auth.verifyOtp({
            email,
            token: verificationCode.trim(),
            type: "email",
          });
          if (authError) throw authError;
          window.location.assign(safeNextPath());
          return;
        }

        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: callback.toString(),
            data: { display_name: displayName.trim(), target_level: targetLevel || null },
          },
        });
        if (authError) throw authError;
        if (data.session) {
          window.location.assign(safeNextPath());
          return;
        }
        setSignupAwaitingCode(true);
        setMessage("We sent a confirmation email. Use its code here, or open its link and press Confirm email to finish creating your account.");
      } else if (mode === "login") {
        if (otpSent) {
          const { error: authError } = await supabase.auth.verifyOtp({ email, token: verificationCode.trim(), type: "email" });
          if (authError) throw authError;
          router.replace(safeNextPath());
          router.refresh();
        } else {
          const { error: authError } = await supabase.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: false, emailRedirectTo: callback.toString() },
          });
          if (authError) throw authError;
          setOtpSent(true);
          setMessage("A sign-in email was sent. Enter its one-time code below, or use its link if the email template includes one.");
        }
      } else if (mode === "recovery") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: callback.toString(),
        });
        if (authError) throw authError;
        setMessage("If the address belongs to an account, recovery instructions have been sent.");
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        router.replace("/account?notice=password-updated");
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request could not be completed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setMessage("");
    setError("");
    setBusy(true);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured. Copy the project values into .env.local, then restart the app.");
      setBusy(false);
      return;
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const callback = new URL("/auth/callback", siteUrl);
    callback.searchParams.set("next", safeNextPath());

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callback.toString(),
          queryParams: { prompt: "select_account" },
        },
      });
      if (authError) throw authError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in could not be started.");
      setBusy(false);
    }
  }

  const needsEmail = mode !== "update-password";
  const needsPassword = (mode === "register" && !signupAwaitingCode) || mode === "update-password";
  const enteringRegistration = mode === "register" && !signupAwaitingCode;

  return (
    <form className="auth-form" onSubmit={submit}>
      {enteringRegistration && (
        <>
          <label>
            Name <span className="field-optional">Optional</span>
            <input autoComplete="name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label>
            Target level <span className="field-optional">Optional</span>
            <select value={targetLevel} onChange={(event) => setTargetLevel(event.target.value)}>
              <option value="">Choose later</option>
              {(["N1", "N2", "N3", "N4", "N5"] as const).map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </label>
        </>
      )}
      {needsEmail && (
        <label>
          Email address
          <input required type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setOtpSent(false); setVerificationCode(""); }} />
        </label>
      )}
      {mode === "login" && otpSent && (
        <label>
          Email one-time code
          <input required inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\s/g, ""))} />
          <span className="field-hint">Use the code from the latest email. You can request another by reloading this page.</span>
        </label>
      )}
      {mode === "register" && signupAwaitingCode && (
        <label>
          Email confirmation code
          <input required inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\s/g, ""))} />
          <span className="field-hint">You can enter the email code here, or use the confirmation link from that same email.</span>
        </label>
      )}
      {needsPassword && (
        <label>
          {mode === "update-password" ? "New password" : "Password"}
          <input required type="password" minLength={8} autoComplete={mode === "update-password" ? "new-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} />
          <span className="field-hint">Use at least 8 characters.</span>
        </label>
      )}
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {message && <p className="form-message form-message--success" role="status">{message}</p>}
      <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>
        {busy ? "Please wait…" : mode === "register" ? (signupAwaitingCode ? "Confirm email and continue" : "Create account") : mode === "login" ? (otpSent ? "Verify code" : "Send one-time code") : mode === "recovery" ? "Send recovery email" : "Save new password"}
      </button>
      {(mode === "login" || (mode === "register" && !signupAwaitingCode)) && (
        <>
          <div className="auth-divider"><span>or</span></div>
          <button className="btn btn--secondary auth-submit auth-google" type="button" disabled={busy} onClick={() => void signInWithGoogle()}>
            <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.24-.16-1.82H9v3.44h4.84a4.14 4.14 0 0 1-1.8 2.72v2.23h2.91c1.7-1.57 2.69-3.88 2.69-6.57Z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.91-2.23c-.8.54-1.82.86-3.05.86-2.35 0-4.34-1.59-5.05-3.73H.94v2.3A9 9 0 0 0 9 18Z" />
              <path fill="#FBBC05" d="M3.95 10.73A5.4 5.4 0 0 1 3.67 9c0-.6.1-1.18.28-1.73v-2.3H.94A9 9 0 0 0 .94 13l3.01-2.27Z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.43 1.35L15 2.36A8.63 8.63 0 0 0 9 0 9 9 0 0 0 .94 4.97l3.01 2.3c.71-2.1 2.7-3.69 5.05-3.69Z" />
            </svg>
            Continue with Google
          </button>
        </>
      )}
    </form>
  );
}
