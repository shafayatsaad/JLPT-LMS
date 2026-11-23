"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/i18n/locale-provider";
import { applyReducedMotionPreference } from "@/lib/display-preferences";

export function ProfileForm({
  userId,
  displayName,
  targetLevel,
  language,
  uiLanguage,
  preferredTimezone,
  reducedMotion,
}: {
  userId: string;
  displayName: string;
  targetLevel: string;
  language: string;
  uiLanguage: "en" | "bn";
  preferredTimezone: string;
  reducedMotion: boolean;
}) {
  const { t, setLanguage } = useLocale();
  const [name, setName] = useState(displayName);
  const [level, setLevel] = useState(targetLevel);
  const [preferredLanguage, setPreferredLanguage] = useState(language || "en");
  const [preferredUiLanguage, setPreferredUiLanguage] = useState<"en" | "bn">(uiLanguage);
  const [timezone, setTimezone] = useState(preferredTimezone);
  const [minimizeMotion, setMinimizeMotion] = useState(reducedMotion);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured for this browser session.");
      return;
    }
    setBusy(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim() || null,
        target_level: level || null,
        explanation_language: preferredLanguage,
        ui_language: preferredUiLanguage,
        preferred_timezone: timezone.trim(),
        reduced_motion: minimizeMotion,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    setBusy(false);
    if (updateError) setError(updateError.message);
    else {
      await setLanguage(preferredUiLanguage);
      applyReducedMotionPreference(minimizeMotion);
      setMessage(t("common.saved"));
    }
  }

  return (
    <form className="auth-form profile-form" onSubmit={submit}>
      <label>{t("profile.name")} <span className="field-optional">{t("profile.optional")}</span><input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>{t("profile.targetLevel")} <span className="field-optional">{t("profile.optional")}</span>
        <select value={level} onChange={(event) => setLevel(event.target.value)}>
          <option value="">{t("profile.notSet")}</option>{["N1", "N2", "N3", "N4", "N5"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label>{t("profile.uiLanguage")}
        <select value={preferredUiLanguage} onChange={(event) => { const value = event.target.value as "en" | "bn"; setPreferredUiLanguage(value); void setLanguage(value); }}>
          <option value="en">{t("common.english")}</option>
          <option value="bn">{t("common.bangla")}</option>
        </select>
      </label>
      <label>{t("profile.explanationLanguage")}
        <select value={preferredLanguage} onChange={(event) => setPreferredLanguage(event.target.value)}>
          <option value="en">{t("common.english")}</option>
          <option value="bn">{t("common.bangla")}</option>
        </select>
        <span className="field-hint">{t("profile.languageHint")}</span>
      </label>
      <label>{t("profile.timezone")}
        <input list="jlpt-timezone-options" value={timezone} onChange={(event) => setTimezone(event.target.value)} maxLength={64} autoComplete="off" required />
        <datalist id="jlpt-timezone-options">
          {["Asia/Dhaka", "Asia/Kolkata", "Asia/Tokyo", "Asia/Singapore", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC"].map((zone) => <option key={zone} value={zone} />)}
        </datalist>
        <span className="field-hint">{t("profile.timezoneHint")}</span>
      </label>
      <label className="profile-checkbox"><input type="checkbox" checked={minimizeMotion} onChange={(event) => setMinimizeMotion(event.target.checked)} /><span>{t("profile.reducedMotion")}</span></label>
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {message && <p className="form-message form-message--success" role="status">{message}</p>}
      <button className="btn btn--primary" disabled={busy}>{busy ? t("common.saving") : t("common.save")}</button>
    </form>
  );
}
