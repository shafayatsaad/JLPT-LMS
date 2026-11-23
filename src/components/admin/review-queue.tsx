"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type ReviewQueueItem = {
  id: string;
  level: string;
  test_section_code: string;
  score_category_code: string;
  item_type_code: string;
  created_at: string;
  prompt: unknown;
  options: unknown;
  correct_option_id: string;
  explanation: unknown;
  distractor_rationales: unknown;
  source_type: string;
  source_reference: string | null;
  rights_notes: string | null;
  authored_by: string;
};

function renderContent(value: unknown, keyPrefix: string): ReactNode {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((part, index) => <span key={`${keyPrefix}-${index}`}>{renderContent(part, `${keyPrefix}-${index}`)}</span>);
  if (!value || typeof value !== "object") return null;
  const block = value as Record<string, unknown>;
  if (block.type === "text") return String(block.text ?? block.value ?? "");
  if (block.type === "ruby") return <ruby>{renderContent(block.base ?? block.text, `${keyPrefix}-base`)}<rt>{renderContent(block.reading ?? block.rt, `${keyPrefix}-reading`)}</rt></ruby>;
  if (block.type === "line_break") return <br />;
  if ("content" in block) return renderContent(block.content, `${keyPrefix}-content`);
  if ("text" in block) return renderContent(block.text, `${keyPrefix}-text`);
  return null;
}

function jsonSummary(value: unknown) {
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).map(([key, entry]) => `${key}: ${String(entry)}`).join(" · ");
  return value == null ? "—" : String(value);
}

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
          <div className="review-queue__meta"><span>{row.level}</span><span>{row.test_section_code}</span><span>{row.score_category_code}</span><span>{row.item_type_code}</span><code>{row.id.slice(0, 8)}</code></div>
          <div className="review-queue__content" lang="ja"><strong>Prompt</strong><div>{renderContent(row.prompt, `${row.id}-prompt`)}</div><strong>Options</strong><ol type="A">{(Array.isArray(row.options) ? row.options : []).map((option, index) => { const value = option as Record<string, unknown>; return <li key={`${row.id}-option-${index}`}><span>{renderContent(value.content ?? value.text, `${row.id}-option-${index}`)}</span>{String(value.id) === row.correct_option_id ? <em>Correct answer</em> : null}</li>; })}</ol></div>
          <div className="review-queue__answer-key"><strong>Explanation and distractors</strong><p>{jsonSummary(row.explanation)}</p><p>{jsonSummary(row.distractor_rationales)}</p></div>
          <div className="review-queue__provenance"><strong>Source: {row.source_type.replaceAll("_", " ")}</strong><p>Reference: {row.source_reference || "Original content"}</p><p>Rights notes: {row.rights_notes || "Authored as original platform content"}</p><p>Author account: <code>{row.authored_by}</code></p></div>
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
