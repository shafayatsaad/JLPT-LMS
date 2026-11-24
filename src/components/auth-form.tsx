"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n";

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

function safeNextPath(defaultPath = "/dashboard") {
  const value = new URLSearchParams(window.location.search).get("next") ?? defaultPath;
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : defaultPath;
}

function callbackUrl(next: string) {
  // Keep the OAuth callback on the exact host that started the flow. Switching
  // between localhost and 127.0.0.1 loses the host-only PKCE verifier cookie.
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", next);
  return callback.toString();
}

export function AuthForm({ mode, defaultNext = "/dashboard" }: { mode: AuthMode; defaultNext?: string }) {
  const phoneEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLE_PHONE === "true";
  const { language, t } = useLocale();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [targetLevel, setTargetLevel] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [signupPending, setSignupPending] = useState<SignupPending>(null);
  const [recoveryPhonePending, setRecoveryPhonePending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const notice = new URLSearchParams(window.location.search).get("notice");
    const messages: Record<string, MessageKey> = {
      "verification-link-invalid": "auth.notice.incomplete",
      "verification-link-expired": "auth.notice.expired",
      "verification-failed": "auth.notice.failed",
      "oauth-cancelled": phoneEnabled ? "auth.notice.googleCancelledPhone" : "auth.notice.googleCancelled",
      "oauth-session-failed": "auth.notice.googleSession",
      "staff-access-required": "auth.notice.staff",
      "recovery-session-missing": "auth.notice.recovery",
    };
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const message = hashParams.has("error") || hashParams.has("error_code")
      ? t("auth.notice.failed")
      : notice && messages[notice]
        ? t(messages[notice])
        : "";
    if (!message) return;
    const timer = window.setTimeout(() => setError(message), 0);
    return () => window.clearTimeout(timer);
  }, [phoneEnabled, t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(t("auth.error.supabase"));
      setBusy(false);
      return;
    }

    const next = mode === "recovery" ? "/auth/update-password" : safeNextPath(defaultNext);
    const redirectTo = callbackUrl(next);
    const parsed = mode === "update-password" ? null : parseIdentifier(identifier);

    if (mode !== "update-password" && (!parsed || (parsed.kind === "phone" && !phoneEnabled))) {
      setError(t(phoneEnabled ? "auth.error.identifierPhone" : "auth.error.identifierEmail"));
      setBusy(false);
      return;
    }

    try {
      if (mode === "register") {
        if (!parsed || (parsed.kind === "phone" && !phoneEnabled)) throw new Error(t("auth.error.signupEmailOnly"));

        if (signupPending === "email" && parsed.kind === "email") {
          const { error: authError } = await supabase.auth.resend({
            type: "signup",
            email: parsed.email,
            options: { emailRedirectTo: redirectTo },
          });
          if (authError) throw authError;
          setMessage(t("auth.message.resendEmail"));
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

        const normalizedSignupPhone = signupPhone.trim().replace(/[\s().-]/g, "");
        if (!/^\+[1-9]\d{7,14}$/.test(normalizedSignupPhone)) {
          throw new Error("Enter a phone number in international format, for example +8801XXXXXXXXX.");
        }
        if (parsed.kind === "phone" && parsed.phone !== normalizedSignupPhone) {
          throw new Error("For phone-based account creation, the sign-in and verification numbers must match.");
        }
        const metadata = { display_name: displayName.trim(), target_level: targetLevel || null, ui_language: language, phone_number: normalizedSignupPhone };
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
        setMessage(t(parsed.kind === "email" ? "auth.message.welcomeEmail" : "auth.message.welcomePhone"));
      } else if (mode === "login") {
        if (!parsed || (parsed.kind === "phone" && !phoneEnabled)) throw new Error(t("auth.error.identifierEmail"));
        const credentials = parsed.kind === "email"
          ? await supabase.auth.signInWithPassword({ email: parsed.email, password })
          : await supabase.auth.signInWithPassword({ phone: parsed.phone, password });
        if (credentials.error) throw credentials.error;
        window.location.assign(safeNextPath(defaultNext));
      } else if (mode === "recovery") {
        if (!parsed || (parsed.kind === "phone" && !phoneEnabled)) throw new Error(t("auth.error.recoveryEmailOnly"));
        if (parsed.kind === "email") {
          const { error: authError } = await supabase.auth.resetPasswordForEmail(parsed.email, { redirectTo });
          if (authError) throw authError;
          setMessage(t("auth.message.resetSent"));
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
          setMessage(t("auth.message.recoveryCode"));
        }
      } else {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        router.replace("/account?notice=password-updated");
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("auth.error.generic"));
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
      setError(t("auth.error.supabase"));
      setBusy(false);
      return;
    }

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl(safeNextPath(defaultNext)),
          queryParams: { prompt: "select_account" },
        },
      });
      if (authError) throw authError;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("auth.error.google"));
      setBusy(false);
    }
  }

  async function resendPhoneCode() {
    const parsed = parseIdentifier(identifier);
    if (!parsed || parsed.kind !== "phone") return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(t("auth.error.supabase"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: authError } = await supabase.auth.resend({ type: "sms", phone: parsed.phone });
      if (authError) throw authError;
      setMessage(t("auth.message.codeResent"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("auth.error.resend"));
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
            {t("auth.field.name")} <span className="field-optional">{t("auth.field.optional")}</span>
            <input autoComplete="name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </label>
          <label>
            Phone number <span className="field-required">Required · SMS verification</span>
            <input required type="tel" autoComplete="tel" inputMode="tel" maxLength={24} placeholder="+8801XXXXXXXXX" value={signupPhone} onChange={(event) => setSignupPhone(event.target.value)} />
            <span className="field-hint">Required for every account, including Google. We verify it after sign-in.</span>
          </label>
          <label>
            {t("auth.field.target")} <span className="field-optional">{t("auth.field.optional")}</span>
            <select value={targetLevel} onChange={(event) => setTargetLevel(event.target.value)}>
              <option value="">{t("auth.field.chooseLater")}</option>
              {(["N1", "N2", "N3", "N4", "N5"] as const).map((level) => <option key={level} value={level}>{level}</option>)}
            </select>
          </label>
        </>
      )}
      {needsIdentifier && (
        <label>
          {mode === "recovery" ? (phoneEnabled ? t("auth.field.recoveryEmail") : t("auth.field.email")) : (phoneEnabled ? t("auth.field.emailPhone") : t("auth.field.email"))}
          <input
            required
            type="text"
            autoComplete={mode === "login" ? "username" : "email"}
            placeholder={phoneEnabled ? t("auth.field.phonePlaceholder") : t("auth.field.emailPlaceholder")}
            readOnly={mode === "register" && signupPending !== null}
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setVerificationCode("");
              setRecoveryPhonePending(false);
            }}
          />
          {mode !== "recovery" && mode !== "login" && <span className="field-hint">{phoneEnabled ? t("auth.field.phoneHint") : t("auth.field.emailHint")}</span>}
        </label>
      )}
      {needsPassword && (
        <label>
          {mode === "update-password" ? t("auth.field.newPassword") : t("auth.field.password")}
          <input required type="password" minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} />
          {mode !== "login" && <span className="field-hint">{t("auth.field.passwordHint")}</span>}
        </label>
      )}
      {(phoneCodeEntry || recoveryCodeEntry) && (
        <label>
          {phoneCodeEntry ? t("auth.field.phoneCode") : t("auth.field.recoveryCode")}
          <input required inputMode="numeric" autoComplete="one-time-code" maxLength={12} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\s/g, ""))} />
        </label>
      )}
      {phoneCodeEntry ? <button className="auth-quiet-action" type="button" disabled={busy} onClick={() => void resendPhoneCode()}>{t("auth.field.resendCode")}</button> : null}
      {mode === "register" && signupPending === "email" && (
        <p className="field-hint">{t("auth.field.confirmHint")}</p>
      )}
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {message && <p className="form-message form-message--success" role="status">{message}</p>}
      {!(mode === "register" && signupPending === "email") && (
        <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>
          {busy ? t("auth.action.wait") : mode === "register"
            ? phoneCodeEntry ? t("auth.action.verifyPhone") : t("auth.action.create")
            : mode === "login" ? t("auth.action.signIn")
              : mode === "recovery" ? recoveryCodeEntry ? t("auth.action.verifyReset") : t("auth.action.sendReset")
                : t("auth.action.savePassword")}
        </button>
      )}
      {mode === "register" && signupPending === "email" && (
        <button className="btn btn--secondary auth-submit" type="submit" disabled={busy}>
          {busy ? t("auth.action.wait") : t("auth.action.resendEmail")}
        </button>
      )}
      {allowGoogle && (
        <>
          <div className="auth-divider"><span>{t("auth.action.or")}</span></div>
          <button className="btn btn--secondary auth-submit auth-google" type="button" disabled={busy} onClick={() => void signInWithGoogle()}>
            <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.24-.16-1.82H9v3.44h4.84a4.14 4.14 0 0 1-1.8 2.72v2.23h2.91c1.7-1.57 2.69-3.88 2.69-6.57Z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.91-2.23c-.8.54-1.82.86-3.05.86-2.35 0-4.34-1.59-5.05-3.73H.94v2.3A9 9 0 0 0 9 18Z" />
              <path fill="#FBBC05" d="M3.95 10.73A5.4 5.4 0 0 1 3.67 9c0-.6.1-1.18.28-1.73v-2.3H.94A9 9 0 0 0 .94 13l3.01-2.27Z" />
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.43 1.35L15 2.36A8.63 8.63 0 0 0 9 0 9 9 0 0 0 .94 4.97l3.01 2.3c.71-2.1 2.7-3.69 5.05-3.69Z" />
            </svg>
            {t("auth.action.google")}
          </button>
        </>
      )}
    </form>
  );
}
