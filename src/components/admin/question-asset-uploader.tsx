"use client";

import { useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const allowedTypes = new Set([
  "audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm",
  "image/jpeg", "image/png", "image/webp",
]);
const maxBytes = 25 * 1024 * 1024;

export function QuestionAssetUploader({ questionId, onPendingChange }: { questionId: string; onPendingChange: (pending: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [purpose, setPurpose] = useState("question_audio");
  const [assetId, setAssetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function upload() {
    setError("");
    setMessage("");
    if (!file) {
      setError("Choose an audio or image file first.");
      return;
    }
    if (!allowedTypes.has(file.type)) {
      setError("Use MP3, MP4, AAC, OGG, WAV, WebM, JPEG, PNG or WebP media.");
      return;
    }
    if (file.size <= 0 || file.size > maxBytes) {
      setError("The file must be between 1 byte and 25 MB.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured in this browser session.");
      return;
    }
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) {
      setError("Sign in again before uploading question media.");
      return;
    }

    setBusy(true);
    const extension = file.name.includes(".") ? file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) : "";
    const storagePath = `${userResult.user.id}/${questionId}/${crypto.randomUUID()}${extension ? `.${extension}` : ""}`;
    const { error: uploadError } = await supabase.storage.from("jlpt-question-assets").upload(storagePath, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) {
      setBusy(false);
      setError(uploadError.message);
      return;
    }

    const { data, error: registerError } = await supabase.rpc("register_question_asset", {
      p_question_id: questionId,
      p_storage_path: storagePath,
      p_media_type: file.type,
      p_purpose: purpose,
      p_duration_seconds: null,
    });
    if (registerError || !data) {
      await supabase.storage.from("jlpt-question-assets").remove([storagePath]);
      setBusy(false);
      setError(registerError?.message ?? "The uploaded file could not be attached to the question.");
      return;
    }
    setAssetId(String(data));
    onPendingChange(true);
    setMessage("Private asset uploaded and attached as a draft. Submit it for a separate review before publishing a form.");
    setBusy(false);
  }

  async function submitForReview() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase || !assetId || busy) return;
    setBusy(true);
    setError("");
    const { error: submitError } = await supabase.rpc("submit_content_asset_for_review", { p_asset_id: assetId });
    setBusy(false);
    if (submitError) {
      setError(submitError.message);
      return;
    }
    setMessage("Asset submitted. A different reviewer must approve it before it can be used in an exam.");
    setAssetId("");
    setFile(null);
    onPendingChange(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="question-asset-uploader" aria-labelledby="question-assets-heading">
      <div><h3 id="question-assets-heading">Question media</h3><p>Upload private audio or image content. Each asset goes through separate review.</p></div>
      <div className="question-asset-uploader__fields">
        <label>Media file<input ref={inputRef} type="file" accept="audio/*,image/jpeg,image/png,image/webp" disabled={busy || Boolean(assetId)} onChange={(event) => { const nextFile = event.target.files?.[0] ?? null; setFile(nextFile); onPendingChange(Boolean(nextFile)); }} /></label>
        <label>Purpose<select value={purpose} disabled={busy || Boolean(assetId)} onChange={(event) => setPurpose(event.target.value)}><option value="question_audio">Question audio</option><option value="question_image">Question image</option><option value="stimulus_audio">Shared stimulus audio</option><option value="stimulus_image">Shared stimulus image</option></select></label>
      </div>
      {assetId ? <p className="question-authoring-form__id">Draft asset ID <code>{assetId}</code></p> : null}
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
      <div className="product-cta-row">
        {!assetId ? <button className="btn btn--secondary" type="button" disabled={busy} onClick={() => void upload()}>{busy ? "Uploading…" : "Upload and attach"}</button> : <button className="btn btn--primary" type="button" disabled={busy} onClick={() => void submitForReview()}>{busy ? "Submitting…" : "Submit asset for review"}</button>}
        {file && !assetId ? <button className="text-link" type="button" disabled={busy} onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; onPendingChange(false); }}>Clear selected file</button> : null}
      </div>
    </section>
  );
}
