"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AssetReviewItem = {
  id: string;
  storage_path: string;
  media_type: string;
  status: string;
  duration_seconds: number | null;
  uploaded_by: string | null;
  created_at: string;
  question_id: string;
  purpose: string;
  question_prompt: unknown;
};

function renderPrompt(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(renderPrompt).join("");
  if (!value || typeof value !== "object") return "";
  const block = value as Record<string, unknown>;
  if (block.type === "text") return String(block.text ?? block.value ?? "");
  if (block.type === "ruby") return `${renderPrompt(block.base ?? block.text)} (${renderPrompt(block.reading ?? block.rt)})`;
  if (block.type === "line_break") return "\n";
  if ("content" in block) return renderPrompt(block.content);
  if ("text" in block) return renderPrompt(block.text);
  return "";
}

export function AssetReviewQueue({ rows }: { rows: AssetReviewItem[] }) {
  const router = useRouter();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadPreviews() {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;
      const entries = await Promise.all(rows.map(async (row) => {
        const { data, error: signError } = await supabase.storage.from("jlpt-question-assets").createSignedUrl(row.storage_path, 600);
        return [row.id, signError ? "" : data?.signedUrl ?? ""] as const;
      }));
      if (!cancelled) setUrls(Object.fromEntries(entries));
    }
    void loadPreviews();
    return () => { cancelled = true; };
  }, [rows]);

  async function decide(row: AssetReviewItem, decision: "approved" | "rejected" | "needs_changes") {
    setError("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured in this browser session.");
      return;
    }
    setBusyId(row.id);
    const { error: reviewError } = await supabase.rpc("review_content_asset", {
      p_asset_id: row.id,
      p_decision: decision,
      p_notes: notes[row.id]?.trim() || null,
    });
    setBusyId("");
    if (reviewError) setError(reviewError.message);
    else {
      setReviewedIds((current) => current.includes(row.id) ? current : [...current, row.id]);
      router.refresh();
    }
  }

  const visibleRows = rows.filter((row) => !reviewedIds.includes(row.id));
  if (!visibleRows.length) return <div className="empty-state"><p>No media assets are waiting for review.</p></div>;

  return (
    <div className="asset-review-queue">
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {visibleRows.map((row) => (
        <article className="asset-review-queue__item" key={`${row.id}:${row.question_id}`}>
          <div className="review-queue__meta"><span>{row.media_type}</span><span>{row.status}</span><span>{row.purpose.replaceAll("_", " ")}</span><code>{row.id.slice(0, 8)}</code></div>
          <div className="asset-review-queue__question"><strong>Attached question</strong><p lang="ja">{renderPrompt(row.question_prompt)}</p><code>{row.question_id}</code></div>
          <div className="asset-review-queue__preview">
            {urls[row.id] ? row.media_type.startsWith("audio/")
              ? <audio controls preload="metadata" src={urls[row.id]}>Audio playback is not supported by this browser.</audio>
              : row.media_type.startsWith("image/") ? <img src={urls[row.id]} alt="Uploaded question asset for review" /> : <p>Preview is not available for this media type.</p>
              : <p>Loading a private review preview…</p>}
          </div>
          <p className="asset-review-queue__meta">Uploaded {new Date(row.created_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} · Uploader {row.uploaded_by ?? "legacy record"}{row.duration_seconds ? ` · ${row.duration_seconds}s` : ""}</p>
          <label className="review-queue__notes">Review note <span className="field-optional">Optional</span><textarea maxLength={2000} value={notes[row.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} /></label>
          <div className="review-queue__actions">
            <button className="btn btn--primary" type="button" disabled={busyId === row.id} onClick={() => void decide(row, "approved")}>{busyId === row.id ? "Saving…" : "Approve asset"}</button>
            <button className="btn btn--secondary" type="button" disabled={busyId === row.id} onClick={() => void decide(row, "needs_changes")}>Return for changes</button>
            <button className="btn btn--secondary" type="button" disabled={busyId === row.id} onClick={() => void decide(row, "rejected")}>Reject asset</button>
          </div>
        </article>
      ))}
    </div>
  );
}
