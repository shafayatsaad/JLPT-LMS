"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type QuestionBankTableRow = {
  id: string;
  content_key: string;
  revision: number;
  level: string;
  test_section_code: string;
  item_type_code: string;
  difficulty_estimate: number | null;
  status: string;
  authored_by: string;
  skill_tags: string[];
  prompt_preview: string;
};

export function QuestionBankTable({
  rows,
  userId,
  canSubmitForReview,
}: {
  rows: QuestionBankTableRow[];
  userId: string;
  canSubmitForReview: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const eligibleIds = useMemo(
    () => canSubmitForReview ? rows.filter((row) => row.status === "draft" && row.authored_by === userId).map((row) => row.id) : [],
    [canSubmitForReview, rows, userId],
  );
  const allEligibleSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selected.includes(id));

  function toggleSelected(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
    setNotice("");
    setError("");
  }

  async function submitSelected() {
    if (busy || !selected.length) return;
    const ids = selected.filter((id) => eligibleIds.includes(id));
    if (!ids.length) {
      setError("Select one or more of your own draft questions first.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Your sign-in session is unavailable. Sign in again and retry.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    let submitted = 0;
    const failures: string[] = [];
    for (const id of ids) {
      const { error: submitError } = await supabase.rpc("submit_question_for_review", { p_question_id: id });
      if (submitError) failures.push(`${id.slice(0, 8)}: ${submitError.message}`);
      else submitted += 1;
    }
    setBusy(false);
    setSelected([]);
    if (submitted) setNotice(`${submitted} draft${submitted === 1 ? " was" : "s were"} submitted for independent review.`);
    if (failures.length) setError(`Some drafts were not submitted: ${failures.join("; ")}`);
    router.refresh();
  }

  if (!rows.length) return <div className="empty-state"><p>No question revisions match these filters.</p><Link className="text-link" href="/admin/questions/new#manual-question">Create an original draft</Link></div>;

  return <>
    {notice ? <p className="form-message form-message--success" role="status">{notice}</p> : null}
    {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
    {canSubmitForReview ? <div className="question-bank-bulk-actions">
      <label className="question-bank-select-all"><input type="checkbox" checked={allEligibleSelected} disabled={!eligibleIds.length || busy} onChange={() => setSelected(allEligibleSelected ? [] : eligibleIds)} /> Select my draft questions on this page</label>
      <button className="btn btn--secondary" type="button" disabled={!selected.length || busy} onClick={() => void submitSelected()}>{busy ? "Submitting…" : `Submit selected drafts${selected.length ? ` · ${selected.length}` : ""}`}</button>
    </div> : null}
    <div className="table-scroll"><table><thead><tr>
      {canSubmitForReview ? <th scope="col"><span className="sr-only">Select</span></th> : null}
      <th>Question</th><th>Level</th><th>Section · type</th><th>Skill tags</th><th>Difficulty</th><th>Status</th>
    </tr></thead><tbody>{rows.map((row) => {
      const selectable = canSubmitForReview && row.status === "draft" && row.authored_by === userId;
      return <tr key={row.id}>
        {canSubmitForReview ? <td>{selectable ? <input aria-label={`Select draft ${row.id.slice(0, 8)}`} type="checkbox" checked={selected.includes(row.id)} disabled={busy} onChange={() => toggleSelected(row.id)} /> : <span aria-label="Not available for bulk submission">—</span>}</td> : null}
        <td><Link className="text-link" href={`/admin/questions/${row.id}`}>Revision {row.revision}</Link><small>{row.prompt_preview.slice(0, 110) || "Prompt has no text preview"}</small><small><code>{row.id.slice(0, 8)}</code> · family {row.content_key.slice(0, 8)}</small></td>
        <td>{row.level}</td><td>{row.test_section_code}<small>{row.item_type_code}</small></td><td>{row.skill_tags.join(", ") || "—"}</td><td>{row.difficulty_estimate ?? "—"}</td><td><span className="status-chip">{row.status.replaceAll("_", " ")}</span></td>
      </tr>;
    })}</tbody></table></div>
  </>;
}
