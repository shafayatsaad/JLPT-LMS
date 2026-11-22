"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type ReviewQueueItem = {
  id: string;
  level: string;
  test_section_code: string;
  item_type_code: string;
  created_at: string;
};

export function ReviewQueue({ rows }: { rows: ReviewQueueItem[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function decide(id: string, decision: "approved" | "rejected" | "needs_changes") {
    setError("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured in this browser session.");
      return;
    }
    setBusyId(id);
    const { error: rpcError } = await supabase.rpc("review_question", {
      p_question_id: id,
      p_decision: decision,
      p_notes: notes[id]?.trim() || null,
    });
    setBusyId("");
    if (rpcError) setError(rpcError.message);
    else router.refresh();
  }

  if (!rows.length) return <div className="empty-state"><p>No questions are waiting for review.</p></div>;

  return (
    <div className="review-queue">
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}
      {rows.map((row) => (
        <article className="review-queue__item" key={row.id}>
          <div className="review-queue__meta"><span>{row.level}</span><span>{row.test_section_code}</span><span>{row.item_type_code}</span><code>{row.id.slice(0, 8)}</code></div>
          <label className="review-queue__notes">Review note <span className="field-optional">Optional</span><textarea maxLength={2000} value={notes[row.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} /></label>
          <div className="review-queue__actions">
            <button className="btn btn--primary" type="button" disabled={busyId === row.id} onClick={() => decide(row.id, "approved")}>{busyId === row.id ? "Saving…" : "Approve"}</button>
            <button className="btn btn--secondary" type="button" disabled={busyId === row.id} onClick={() => decide(row.id, "needs_changes")}>Return for changes</button>
            <button className="btn btn--secondary" type="button" disabled={busyId === row.id} onClick={() => decide(row.id, "rejected")}>Reject</button>
          </div>
        </article>
      ))}
    </div>
  );
}
