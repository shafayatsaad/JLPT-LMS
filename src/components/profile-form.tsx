"use client";

import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ProfileForm({
  userId,
  displayName,
  targetLevel,
  language,
}: {
  userId: string;
  displayName: string;
  targetLevel: string;
  language: string;
}) {
  const [name, setName] = useState(displayName);
  const [level, setLevel] = useState(targetLevel);
  const [preferredLanguage, setPreferredLanguage] = useState(language || "en");
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
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    setBusy(false);
    if (updateError) setError(updateError.message);
    else setMessage("Profile preferences saved.");
  }

  return (
    <form className="auth-form profile-form" onSubmit={submit}>
      <label>Name <span className="field-optional">Optional</span><input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Target JLPT level <span className="field-optional">Optional</span>
        <select value={level} onChange={(event) => setLevel(event.target.value)}>
          <option value="">Not set</option>{["N1", "N2", "N3", "N4", "N5"].map((item) => <option key={item}>{item}</option>)}
        </select>
      </label>
      <label>Explanation language
        <select value={preferredLanguage} onChange={(event) => setPreferredLanguage(event.target.value)}>
          <option value="en">English</option>
          <option value="bn">Bangla</option>
        </select>
        <span className="field-hint">Language choice is saved; explanation availability depends on reviewed content.</span>
      </label>
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {message && <p className="form-message form-message--success" role="status">{message}</p>}
      <button className="btn btn--primary" disabled={busy}>{busy ? "Saving…" : "Save preferences"}</button>
    </form>
  );
}
