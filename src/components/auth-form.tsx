"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthMode = "register" | "login" | "recovery" | "update-password";
type Identifier = { kind: "email"; email: string } | { kind: "phone"; phone: string };
type SignupPending = "email" | "phone" | null;

function parseIdentifier(value: string): Identifier | null {
  const trimmed = value.trim();
  if (trimmed.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
      ? { kind: "email", email: trimmed.toLowerCase() }
      : null;
  }

  const phone = trimmed.replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(phone) ? { kind: "phone", phone } : null;
}

function safeNextPath() {
  const value = new URLSearchParams(window.location.search).get("next") ?? "/dashboard";
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/dashboard";
}

function callbackUrl(next: string) {
  // Keep the OAuth callback on the exact host that started the flow. Switching
  // between localhost and 127.0.0.1 loses the host-only PKCE verifier cookie.
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", next);
  return callback.toString();
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [targetLevel, setTargetLevel] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [signupPending, setSignupPending] = useState<SignupPending>(null);
  const [recoveryPhonePending, setRecoveryPhonePending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const notice = new URLSearchParams(window.location.search).get("notice");
    const messages: Record<string, string> = {
      "verification-link-invalid": "That verification link is incomplete. Request a fresh confirmation email.",
      "verification-link-expired": "That verification link has expired or was already used. Request a fresh email.",
      "verification-failed": "We couldn't complete verification. Request a fresh email and try again.",
      "oauth-cancelled": "Google sign-in was cancelled. You can try again or use your email or phone and password.",
      "oauth-session-failed": "Google returned successfully, but this browser could not restore the sign-in session. Start again from this same site address.",
      "staff-access-required": "This account does not have staff access. Please sign in with an authorized staff account.",
      "recovery-session-missing": "The password reset session expired. Request a new reset link.",
    };
    if (notice && messages[notice]) setError(messages[notice]);

    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    if (hashParams.has("error") || hashParams.has("error_code")) {
      setError("The account link could not be completed. It may have expired. Request a fresh email and try again.");
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

    const next = mode === "recovery" ? "/auth/update-password" : safeNextPath();
    const redirectTo = callbackUrl(next);
    const parsed = mode === "update-password" ? null : parseIdentifier(identifier);

    if (mode !== "update-password" && !parsed) {
      setError("Enter a valid email address or an international phone number such as +8801712345678.");
      setBusy(false);
      return;
    }

    try {
      if (mode === "register") {
        if (!parsed) throw new Error("Enter a valid email address or phone number.");

        if (signupPending === "email" && parsed.kind === "email") {
          const { error: authError } = await supabase.auth.resend({
            type: "signup",
            email: parsed.email,
            options: { emailRedirectTo: redirectTo },
          });
          if (authError) throw authError;
          setMessage("A fresh confirmation email is on its way. Open its link and press Confirm to finish.");
          return;
        }

        if (signupPending === "phone" && parsed.kind === "phone") {
          const { error: authError } = await supabase.auth.verifyOtp({
            phone: parsed.phone,
            token: verificationCode.trim(),
            type: "sms",
          });
          if (authError) throw authError;
          window.location.assign("/dashboard");
          return;
        }

        const metadata = { display_name: displayName.trim(), target_level: targetLevel || null };
        const signup = parsed.kind === "email"
          ? await supabase.auth.signUp({
              email: parsed.email,
              password,
              options: { emailRedirectTo: redirectTo, data: metadata },
            })
          : await supabase.auth.signUp({
              phone: parsed.phone,
              password,
              options: { channel: "sms", data: metadata },
            });

        if (signup.error) throw signup.error;
        if (signup.data.session) {
          window.location.assign("/dashboard");
          return;
        }

        setSignupPending(parsed.kind);
        setMessage(parsed.kind === "email"
          ? "Welcome! We sent a confirmation email. Open the link and press Confirm email to activate your account."
          : "Welcome! We sent a text with a verification code. Enter it below to activate your phone account.");
      } else if (mode === "login") {
        if (!parsed) throw new Error("Enter a valid email address or an international phone number.");
        const credentials = parsed.kind === "email"
          ? await supabase.auth.signInWithPassword({ email: parsed.email, password })
          : await supabase.auth.signInWithPassword({ phone: parsed.phone, password });
        if (credentials.error) throw credentials.error;
        window.location.assign(safeNextPath());
      } else if (mode === "recovery") {
        if (!parsed) throw new Error("Enter the email address or phone number on your account.");
        if (parsed.kind === "email") {
          const { error: authError } = await supabase.auth.resetPasswordForEmail(parsed.email, { redirectTo });
          if (authError) throw authError;
          setMessage("If the address belongs to an account, a password reset link has been sent.");
        } else if (recoveryPhonePending) {
          const { error: authError } = await supabase.auth.verifyOtp({
            phone: parsed.phone,
            token: verificationCode.trim(),
            type: "sms",
          });
          if (authError) throw authError;
          window.location.assign("/auth/update-password");
          return;
        } else {
          const { error: authError } = await supabase.auth.signInWithOtp({
            phone: parsed.phone,
            options: { shouldCreateUser: false, channel: "sms" },
          });
          if (authError) throw authError;
          setRecoveryPhonePending(true);
          setMessage("We sent a recovery code by text. Verify it to continue to the new-password page.");
        }
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

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl(safeNextPath()),
          queryParams: { prompt: "select_account" },
        },
      });
      if (authError) throw authError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Google sign-in could not be started.");
      setBusy(false);
    }
  }

  async function resendPhoneCode() {
    const parsed = parseIdentifier(identifier);
    if (!parsed || parsed.kind !== "phone") return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured. Copy the project values into .env.local, then restart the app.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await supabase.auth.resend({ type: "sms", phone: parsed.phone });
      if (authError) throw authError;
      setMessage("A fresh verification text has been sent.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The verification text could not be resent.");
    } finally {
      setBusy(false);
    }
  }

  const registering = mode === "register" && signupPending === null;
  const phoneCodeEntry = mode === "register" && signupPending === "phone";
  const recoveryCodeEntry = mode === "recovery" && recoveryPhonePending;
  const needsIdentifier = mode !== "update-password";
  const needsPassword = registering || mode === "login" || mode === "update-password";
  const allowGoogle = mode === "login" || registering;

  return (
    <form className="auth-form" onSubmit={submit}>
      {registering && (
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
      {needsIdentifier && (
        <label>
          {mode === "recovery" ? "Email address or phone number" : "Email or phone number"}
          <input
            required
            type="text"
            autoComplete={mode === "login" ? "username" : "email"}
            placeholder="Email or +880 phone"
            readOnly={mode === "register" && signupPending !== null}
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setVerificationCode("");
              setRecoveryPhonePending(false);
            }}
          />
          {mode !== "recovery" && mode !== "login" && <span className="field-hint">Use an email address or a phone number with country code (E.164 format).</span>}
        </label>
      )}
      {needsPassword && (
        <label>
          {mode === "update-password" ? "New password" : "Password"}
          <input required type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} />
          {mode !== "login" && <span className="field-hint">Use at least 8 characters.</span>}
        </label>
      )}
      {(phoneCodeEntry || recoveryCodeEntry) && (
        <label>
          {phoneCodeEntry ? "Phone verification code" : "SMS recovery code"}
          <input required inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\s/g, ""))} />
        </label>
      )}
      {phoneCodeEntry ? <button className="auth-quiet-action" type="button" disabled={busy} onClick={() => void resendPhoneCode()}>Resend verification text</button> : null}
      {mode === "register" && signupPending === "email" && (
        <p className="field-hint">Check your inbox and press the Confirm email button in the welcome email. This page will activate your account and take you to the dashboard.</p>
      )}
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {message && <p className="form-message form-message--success" role="status">{message}</p>}
      {!(mode === "register" && signupPending === "email") && (
        <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "register"
            ? phoneCodeEntry ? "Verify phone and continue" : "Create account"
            : mode === "login" ? "Sign in"
              : mode === "recovery" ? recoveryCodeEntry ? "Verify and reset password" : "Send reset instructions"
                : "Save new password"}
        </button>
      )}
      {mode === "register" && signupPending === "email" && (
        <button className="btn btn--secondary auth-submit" type="submit" disabled={busy}>
          {busy ? "Please wait…" : "Resend confirmation email"}
        </button>
      )}
      {allowGoogle && (
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
