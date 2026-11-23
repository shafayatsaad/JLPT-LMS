"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/locale-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "loading" | "idle" | "setup" | "challenge" | "active";

const copy = {
  en: {
    loading: "Checking authenticator setup…", unavailable: "Authenticator setup is unavailable. Enable TOTP in this Supabase Auth project, then try again.",
    loadError: "Authenticator status could not be loaded. Refresh the page and try again.", setupIntro: "Add an authenticator app for an extra sign-in check on new or unrecognized sessions. You can use Google Authenticator, 1Password, or another TOTP app.",
    setup: "Set up authenticator", preparing: "Preparing setup…", scan: "Scan this QR code with your authenticator app. If you cannot scan it, enter the secret manually. Keep the secret private.",
    secret: "Manual setup secret", codeSetup: "Enter the six digit code shown by your authenticator", codeVerify: "Authenticator code",
    verify: "Verify and continue", verifying: "Verifying…", active: "Authenticator app is enabled. New or unrecognized sign-ins will ask for a code.",
    verifyRemove: "Verify and remove authenticator", verifyForget: "Verify and forget devices",
    disable: "Remove authenticator", disabling: "Removing…", confirmDisable: "Remove the authenticator from this account? This also revokes remembered devices.",
    forget: "Forget all remembered devices", forgotten: "All remembered devices were revoked.", deviceNeedCode: "Verify your authenticator before revoking remembered devices.",
    trust: "Remember this device for 30 days", challengeIntro: "Enter the current code from your authenticator app to continue.",
    noSupabase: "Supabase is not configured for this environment.", invalidCode: "Enter the current six digit code from your authenticator app.",
    badCode: "That code could not be verified. Check your authenticator clock and try the current code again.",
    unfinished: "A previous setup was not completed. Starting again will remove only that unfinished factor.",
    setupFailed: "An unfinished authenticator setup could not be cleared. Please try again.",
    rememberFailed: "Your code was verified, but this device could not be remembered. You can continue and verify this device again next time.",
    removeFailed: "The authenticator could not be removed. Verify your current code and try again.", removeNeedCode: "Verify your authenticator code before removing it.",
    continue: "Continue", enabled: "Authenticator protection", notEnabled: "Authenticator protection is off.",
  },
  bn: {
    loading: "অথেনটিকেটর সেটআপ যাচাই হচ্ছে…", unavailable: "অথেনটিকেটর সেটআপ পাওয়া যাচ্ছে না। Supabase Auth প্রকল্পে TOTP চালু করে আবার চেষ্টা করুন।",
    loadError: "অথেনটিকেটরের অবস্থা লোড করা যায়নি। পৃষ্ঠা রিফ্রেশ করে আবার চেষ্টা করুন।", setupIntro: "নতুন বা অপরিচিত সাইন-ইন সেশনে অতিরিক্ত যাচাইয়ের জন্য একটি অথেনটিকেটর অ্যাপ যোগ করুন। Google Authenticator, 1Password বা অন্য TOTP অ্যাপ ব্যবহার করতে পারেন।",
    setup: "অথেনটিকেটর সেটআপ করুন", preparing: "সেটআপ প্রস্তুত হচ্ছে…", scan: "আপনার অথেনটিকেটর অ্যাপ দিয়ে QR কোডটি স্ক্যান করুন। স্ক্যান না হলে গোপন কোডটি হাতে লিখুন। কোডটি গোপন রাখুন।",
    secret: "হাতে লেখার গোপন কোড", codeSetup: "অথেনটিকেটর অ্যাপে দেখানো ছয় অঙ্কের কোড লিখুন", codeVerify: "অথেনটিকেটর কোড",
    verify: "যাচাই করে চালিয়ে যান", verifying: "যাচাই হচ্ছে…", active: "অথেনটিকেটর চালু আছে। নতুন বা অপরিচিত সাইন-ইনে কোড চাওয়া হবে।",
    verifyRemove: "যাচাই করে অথেনটিকেটর সরান", verifyForget: "যাচাই করে ডিভাইস বাতিল করুন",
    disable: "অথেনটিকেটর সরান", disabling: "সরানো হচ্ছে…", confirmDisable: "এই অ্যাকাউন্ট থেকে অথেনটিকেটর সরাবেন? এতে মনে রাখা ডিভাইসগুলোও বাতিল হবে।",
    forget: "মনে রাখা সব ডিভাইস বাতিল করুন", forgotten: "মনে রাখা সব ডিভাইস বাতিল করা হয়েছে।", deviceNeedCode: "মনে রাখা ডিভাইস বাতিলের আগে অথেনটিকেটর যাচাই করুন।",
    trust: "এই ডিভাইস ৩০ দিন মনে রাখুন", challengeIntro: "চালিয়ে যেতে অথেনটিকেটর অ্যাপের বর্তমান কোড লিখুন।",
    noSupabase: "এই পরিবেশে Supabase কনফিগার করা নেই।", invalidCode: "অথেনটিকেটর অ্যাপের বর্তমান ছয় অঙ্কের কোড লিখুন।",
    badCode: "কোডটি যাচাই করা যায়নি। অ্যাপের ঘড়ি মিলিয়ে বর্তমান কোডটি আবার চেষ্টা করুন।",
    unfinished: "আগের একটি সেটআপ অসম্পূর্ণ ছিল। নতুন করে শুরু করলে শুধু সেই অসম্পূর্ণ ফ্যাক্টরটি সরানো হবে।",
    setupFailed: "অসম্পূর্ণ অথেনটিকেটর সেটআপ সরানো যায়নি। আবার চেষ্টা করুন।",
    rememberFailed: "কোড যাচাই হয়েছে, কিন্তু এই ডিভাইস মনে রাখা যায়নি। চালিয়ে যেতে পারেন; পরেরবার আবার যাচাই লাগবে।",
    removeFailed: "অথেনটিকেটর সরানো যায়নি। বর্তমান কোড যাচাই করে আবার চেষ্টা করুন।", removeNeedCode: "অথেনটিকেটর সরানোর আগে কোড যাচাই করুন।",
    continue: "চালিয়ে যান", enabled: "অথেনটিকেটর সুরক্ষা", notEnabled: "অথেনটিকেটর সুরক্ষা বন্ধ আছে।",
  },
} as const;

export function LearnerMfa({ variant, nextPath = "/dashboard" }: { variant: "challenge" | "settings"; nextPath?: string }) {
  const router = useRouter();
  const { language } = useLocale();
  const text = copy[language];
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [mode, setMode] = useState<Mode>("loading");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [hasUnverified, setHasUnverified] = useState(false);
  const [assuranceLevel, setAssuranceLevel] = useState("aal1");
  const [pendingRemoval, setPendingRemoval] = useState(false);
  const [pendingForget, setPendingForget] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!supabase) {
        if (active) { setMessage(text.noSupabase); setIsError(true); setMode("idle"); }
        return;
      }
      const [{ data, error }, { data: assurance }] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      if (!active) return;
      if (error) { setMessage(text.loadError); setIsError(true); setMode("idle"); return; }
      const verified = data.totp.find((item) => item.status === "verified");
      const unverified = data.all.find((item) => item.factor_type === "totp" && item.status === "unverified");
      setAssuranceLevel(assurance?.currentLevel ?? "aal1");
      setHasUnverified(Boolean(unverified));
      if (verified) {
        setFactorId(verified.id);
        setMode(variant === "challenge" ? "challenge" : "active");
      } else {
        setMode(variant === "challenge" ? "idle" : "idle");
      }
    }
    void load();
    return () => { active = false; };
  }, [supabase, text.loadError, text.noSupabase, variant]);

  async function startEnrollment() {
    if (!supabase) { setMessage(text.noSupabase); setIsError(true); return; }
    setBusy(true); setMessage(""); setIsError(false);
    const { data: current, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) { setMessage(text.loadError); setIsError(true); setBusy(false); return; }
    const existing = current.totp.find((item) => item.status === "verified");
    if (existing) { setFactorId(existing.id); setMode(variant === "challenge" ? "challenge" : "active"); setBusy(false); return; }
    for (const factor of current.all.filter((item) => item.factor_type === "totp" && item.status === "unverified")) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) { setMessage(text.setupFailed); setIsError(true); setBusy(false); return; }
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "JLPT Practice Authenticator", issuer: "JLPT Practice" });
    if (error || !data?.totp?.qr_code || !data.totp.secret) { setMessage(text.unavailable); setIsError(true); setBusy(false); return; }
    setFactorId(data.id); setQrCode(data.totp.qr_code); setSecret(data.totp.secret); setHasUnverified(false); setMode("setup"); setBusy(false);
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !factorId || !/^\d{6}$/.test(code.trim())) { setMessage(text.invalidCode); setIsError(true); return; }
    setBusy(true); setMessage(""); setIsError(false);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) { setMessage(text.badCode); setIsError(true); setBusy(false); return; }
    setAssuranceLevel("aal2");
    if (rememberDevice) {
      const response = await fetch("/api/auth/trusted-device", { method: "POST", credentials: "same-origin", cache: "no-store" });
      if (!response.ok) { setMessage(text.rememberFailed); setIsError(true); }
    }
    if (variant === "settings") {
      if (pendingRemoval) {
        const revoked = await fetch("/api/auth/trusted-device", { method: "DELETE", credentials: "same-origin", cache: "no-store" });
        if (!revoked.ok) { setMessage(text.removeFailed); setIsError(true); setMode("active"); setBusy(false); return; }
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
        if (unenrollError) { setMessage(text.removeFailed); setIsError(true); setMode("active"); setBusy(false); return; }
        setFactorId(""); setMode("idle"); setCode(""); setAssuranceLevel("aal1"); setPendingRemoval(false); setMessage(text.notEnabled); router.refresh(); setBusy(false); return;
      }
      if (pendingForget) {
        const revoked = await fetch("/api/auth/trusted-device", { method: "DELETE", credentials: "same-origin", cache: "no-store" });
        if (!revoked.ok) { setMessage(text.removeFailed); setIsError(true); setMode("active"); setBusy(false); return; }
        setPendingForget(false); setMode("active"); setMessage(text.forgotten); router.refresh(); setBusy(false); return;
      }
      setMode("active"); setBusy(false); router.refresh(); return;
    }
    window.location.replace(nextPath);
  }

  async function removeAuthenticator() {
    if (!supabase || !factorId) return;
    if (assuranceLevel !== "aal2") { setPendingRemoval(true); setPendingForget(false); setRememberDevice(false); setCode(""); setMode("challenge"); setMessage(text.removeNeedCode); setIsError(false); return; }
    if (!window.confirm(text.confirmDisable)) return;
    setBusy(true); setMessage(""); setIsError(false);
    const revoked = await fetch("/api/auth/trusted-device", { method: "DELETE", credentials: "same-origin", cache: "no-store" });
    if (!revoked.ok) { setMessage(text.removeFailed); setIsError(true); setBusy(false); return; }
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) { setMessage(text.removeFailed); setIsError(true); setBusy(false); return; }
    setFactorId(""); setMode("idle"); setCode(""); setAssuranceLevel("aal1"); setMessage(text.notEnabled); router.refresh(); setBusy(false);
  }

  async function forgetDevices() {
    if (assuranceLevel !== "aal2") { setPendingForget(true); setPendingRemoval(false); setRememberDevice(false); setCode(""); setMode("challenge"); setMessage(text.deviceNeedCode); setIsError(false); return; }
    setBusy(true); setMessage(""); setIsError(false);
    const response = await fetch("/api/auth/trusted-device", { method: "DELETE", credentials: "same-origin", cache: "no-store" });
    if (!response.ok) { setMessage(text.removeFailed); setIsError(true); setBusy(false); return; }
    setMessage(text.forgotten); setBusy(false); router.refresh();
  }

  if (mode === "loading") return <p role="status">{text.loading}</p>;

  return <div className="admin-mfa-challenge">
    {variant === "settings" && mode === "active" ? <>
      <div className="security-row"><span><strong>{text.enabled}</strong><br />{text.active}</span></div>
      <button className="btn btn--secondary" type="button" disabled={busy} onClick={() => void forgetDevices()}>{text.forget}</button>
      <button className="btn btn--secondary" type="button" disabled={busy} onClick={() => void removeAuthenticator()}>{busy ? text.disabling : text.disable}</button>
    </> : null}

    {mode === "idle" ? <>
      <p>{variant === "challenge" ? text.challengeIntro : text.setupIntro}</p>
      {hasUnverified ? <p className="inline-notice">{text.unfinished}</p> : null}
      <button className="btn btn--primary auth-submit" type="button" disabled={busy || !supabase} onClick={() => void startEnrollment()}>{busy ? text.preparing : text.setup}</button>
    </> : null}

    {mode === "setup" ? <>
      <p>{text.scan}</p>
      <div className="admin-mfa-challenge__setup">
        <img className="admin-mfa-challenge__qr" src={qrCode} alt="Authenticator setup QR code" />
        <div><span className="field-hint">{text.secret}</span><code className="admin-mfa-challenge__secret">{secret}</code></div>
      </div>
      <form className="auth-form" onSubmit={(event) => void verify(event)}>
        <label>{text.codeSetup}<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
        {variant === "challenge" ? <label className="checkbox-row"><input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} />{text.trust}</label> : null}
        <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>{busy ? text.verifying : text.verify}</button>
      </form>
    </> : null}

    {mode === "challenge" ? <form className="auth-form" onSubmit={(event) => void verify(event)}>
      <p>{text.challengeIntro}</p>
      <label>{text.codeVerify}<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required /></label>
      {!pendingRemoval && !pendingForget ? <label className="checkbox-row"><input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} />{text.trust}</label> : null}
      {variant === "settings" ? <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>{busy ? text.verifying : pendingRemoval ? text.verifyRemove : pendingForget ? text.verifyForget : text.verify}</button> : <button className="btn btn--primary auth-submit" type="submit" disabled={busy}>{busy ? text.verifying : text.continue}</button>}
      {variant === "settings" && assuranceLevel === "aal2" ? <button className="btn btn--secondary" type="button" disabled={busy} onClick={() => void removeAuthenticator()}>{text.disable}</button> : null}
    </form> : null}

    {message ? <p className={`form-message ${isError ? "form-message--error" : "form-message--success"}`} role={isError ? "alert" : "status"}>{message}</p> : null}
  </div>;
}
