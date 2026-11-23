"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Blueprint = { id: string; level: string; version: number };
type Slot = { slot_order: number; test_section_code: string; score_category_code: string; item_type_code: string; question_quota: number; section_duration_seconds: number; required_asset_types: string[] };
type Question = { id: string; level: string; test_section_code: string; score_category_code: string; item_type_code: string; created_at: string };
type ExamFormRow = { id: string; form_code: string; level: string; version: number; status: string; access_tier: string; is_frozen: boolean; published_at: string | null; created_by: string; item_count: number };

function keyFor(value: { test_section_code: string; score_category_code: string; item_type_code: string }) {
  return [value.test_section_code, value.score_category_code, value.item_type_code].join("::");
}

export function ExamFormAssembly({ enabled, allowFree }: { enabled: boolean; allowFree: boolean }) {
  const router = useRouter();
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [blueprintId, setBlueprintId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [formCode, setFormCode] = useState("N5-DEMO-01");
  const [version, setVersion] = useState("1");
  const [accessTier, setAccessTier] = useState("premium");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function loadBlueprints() {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;
      const { data, error: queryError } = await supabase.from("exam_blueprints").select("id,level,version").in("status", ["approved", "eligible_for_exam"]).order("level").order("version", { ascending: false }).limit(100);
      if (cancelled) return;
      if (queryError) setError(queryError.message);
      setBlueprints((data ?? []) as Blueprint[]);
    }
    void loadBlueprints();
    return () => { cancelled = true; };
  }, [enabled]);

  useEffect(() => {
    if (!blueprintId) return;
    let cancelled = false;
    async function loadAssemblySource() {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;
      setLoading(true);
      setError("");
      const chosen = blueprints.find((row) => row.id === blueprintId);
      if (!chosen) return setLoading(false);
      const [slotResult, questionResult] = await Promise.all([
        supabase.from("blueprint_slots").select("slot_order,test_section_code,score_category_code,item_type_code,question_quota,section_duration_seconds,required_asset_types").eq("blueprint_id", blueprintId).order("slot_order"),
        supabase.from("questions").select("id,level,test_section_code,score_category_code,item_type_code,created_at").eq("level", chosen.level).in("status", ["approved", "eligible_for_exam"]).order("created_at").limit(1500),
      ]);
      if (cancelled) return;
      setLoading(false);
      const queryError = slotResult.error ?? questionResult.error;
      if (queryError) setError(queryError.message);
      setSlots((slotResult.data ?? []) as Slot[]);
      setQuestions((questionResult.data ?? []) as Question[]);
      setSelected([]);
    }
    void loadAssemblySource();
    return () => { cancelled = true; };
  }, [blueprintId, blueprints]);

  const expected = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const slot of slots) counts[keyFor(slot)] = (counts[keyFor(slot)] ?? 0) + slot.question_quota;
    return counts;
  }, [slots]);
  const selectedByKey = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const question of questions) if (selected.includes(question.id)) counts[keyFor(question)] = (counts[keyFor(question)] ?? 0) + 1;
    return counts;
  }, [questions, selected]);
  const canCreate = slots.length > 0 && Object.entries(expected).every(([key, count]) => selectedByKey[key] === count) && selected.length === Object.values(expected).reduce((sum, count) => sum + count, 0) && /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(formCode.trim());
  const visibleQuestions = questions.filter((question) => {
    const belongs = Object.hasOwn(expected, keyFor(question));
    const searchable = `${question.test_section_code} ${question.score_category_code} ${question.item_type_code} ${question.id}`.toLowerCase();
    return belongs && searchable.includes(filter.toLowerCase());
  });

  function toggleQuestion(question: Question) {
    setSelected((current) => {
      if (current.includes(question.id)) return current.filter((id) => id !== question.id);
      const key = keyFor(question);
      if ((selectedByKey[key] ?? 0) >= (expected[key] ?? 0)) return current;
      return [...current, question.id];
    });
  }

  async function createDraft() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured in this browser session.");
    setError("");
    setMessage("");
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc("create_exam_form_draft", {
      p_blueprint_id: blueprintId,
      p_form_code: formCode.trim(),
      p_version: Number(version),
      p_access_tier: accessTier,
      p_question_ids: selected,
    });
    setBusy(false);
    if (rpcError) return setError(rpcError.message);
    setMessage(`Draft form ${formCode.toUpperCase()} created (${String(data)}). A different reviewer must validate and publish it.`);
    setSelected([]);
    router.refresh();
  }

  if (!enabled) return <div className="empty-state"><p>Your role can review forms but cannot assemble them.</p></div>;
  return <div className="workflow-stack">
    <p className="workflow-note"><strong>Only approved content is selectable.</strong> Form assembly enforces the approved blueprint’s exact counts. Validation separately checks answer keys, approved media, level and timing. Premium is the default; only an administrator can designate a reviewed demo or introductory form as free.</p>
    {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
    {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
    <label>Approved blueprint<select value={blueprintId} onChange={(event) => {
      const nextBlueprintId = event.target.value;
      setBlueprintId(nextBlueprintId);
      setSlots([]);
      setQuestions([]);
      setSelected([]);
      setError("");
    }}><option value="">Choose a blueprint</option>{blueprints.map((blueprint) => <option key={blueprint.id} value={blueprint.id}>{blueprint.level} · version {blueprint.version}</option>)}</select></label>
    {!blueprints.length ? <p className="section-note">No approved blueprint is available yet. Create a draft above and route it through independent review first.</p> : null}
    {slots.length ? <>
      <div className="table-scroll"><table><thead><tr><th>Section</th><th>Category</th><th>Item type</th><th>Required</th><th>Selected</th><th>Timing</th></tr></thead><tbody>{slots.map((slot) => <tr key={slot.slot_order}><td>{slot.test_section_code}</td><td>{slot.score_category_code}</td><td>{slot.item_type_code}</td><td>{slot.question_quota}</td><td>{selectedByKey[keyFor(slot)] ?? 0}</td><td>{Math.round(slot.section_duration_seconds / 60)} min</td></tr>)}</tbody></table></div>
      <div className="workflow-form__row">
        <label>Form code<input value={formCode} onChange={(event) => setFormCode(event.target.value)} required maxLength={64} /></label>
        <label>Version<input type="number" min="1" value={version} onChange={(event) => setVersion(event.target.value)} required /></label>
        <label>Access tier<select value={accessTier} onChange={(event) => setAccessTier(event.target.value)}>{allowFree ? <option value="free">Free · reviewed demo/intro</option> : null}<option value="premium">Premium · full mock</option></select></label>
      </div>
      <label>Filter eligible questions<input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Section, item type, or question ID" /></label>
      {loading ? <p className="section-note">Loading approved questions…</p> : !visibleQuestions.length ? <p className="section-note">No approved questions match these blueprint slots at this level.</p> : <div className="workflow-question-list">{visibleQuestions.map((question) => {
        const isSelected = selected.includes(question.id);
        const key = keyFor(question);
        const atCapacity = !isSelected && (selectedByKey[key] ?? 0) >= (expected[key] ?? 0);
        return <label className="workflow-question" key={question.id}><input type="checkbox" checked={isSelected} disabled={atCapacity || loading} onChange={() => toggleQuestion(question)} /><span><strong>{question.test_section_code} · {question.item_type_code}</strong><small>{question.score_category_code} · <code>{question.id.slice(0, 12)}</code></small></span><span className="workflow-question__state">{isSelected ? "Selected" : `${selectedByKey[key] ?? 0}/${expected[key] ?? 0} in slot`}</span></label>;
      })}</div>}
      <button className="btn btn--primary" type="button" onClick={() => void createDraft()} disabled={!canCreate || busy || loading}>{busy ? "Creating…" : `Create draft form · ${selected.length} questions`}</button>
    </> : null}
  </div>;
}

export function ExamFormReviewQueue({ rows, currentUserId }: { rows: ExamFormRow[]; currentUserId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function decide(row: ExamFormRow, decision: "validate" | "publish") {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured in this browser session.");
    setError("");
    setBusyId(row.id);
    const { error: rpcError } = await supabase.rpc(decision === "validate" ? "validate_exam_form" : "publish_exam_form", {
      p_exam_form_id: row.id,
      p_notes: notes[row.id]?.trim() || null,
    });
    setBusyId("");
    if (rpcError) setError(rpcError.message);
    else router.refresh();
  }

  if (!rows.length) return <div className="empty-state"><p>No exam forms have been assembled yet.</p></div>;
  return <div className="workflow-stack">
    {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
    {rows.map((row) => {
      const isAuthor = row.created_by === currentUserId;
      return <article className="workflow-form-card" key={row.id}>
        <div className="review-queue__meta"><span>{row.form_code} · {row.level} v{row.version}</span><span>{row.item_count} questions</span><span>{row.access_tier}</span><span>{row.status}{row.is_frozen ? " · frozen" : ""}</span></div>
        <p className="workflow-form-card__id">Form ID <code>{row.id}</code>{row.published_at ? ` · Published ${new Date(row.published_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })}` : ""}</p>
        <Link className="text-link" href={`/admin/exam-forms/${row.id}`}>Inspect form manifest</Link>
        {row.status === "draft" || row.status === "validated" ? <label className="review-queue__notes">Review note <span className="field-optional">Optional</span><textarea maxLength={2000} value={notes[row.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} /></label> : null}
        <div className="review-queue__actions">
          {row.status === "draft" ? <button className="btn btn--secondary" type="button" disabled={isAuthor || busyId === row.id} onClick={() => void decide(row, "validate")}>{busyId === row.id ? "Validating…" : "Validate form"}</button> : null}
          {row.status === "validated" ? <button className="btn btn--primary" type="button" disabled={isAuthor || busyId === row.id} onClick={() => void decide(row, "publish")}>{busyId === row.id ? "Publishing…" : "Publish frozen form"}</button> : null}
          {isAuthor && row.status !== "published" ? <span className="section-note">A different reviewer must act on this form.</span> : null}
        </div>
      </article>;
    })}
  </div>;
}
