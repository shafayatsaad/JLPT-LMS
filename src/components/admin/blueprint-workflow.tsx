"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { jlptFormats, normalizeItemTypeCode, type JlptLevel } from "@/lib/jlpt-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type SlotDraft = {
  test_section_code: string;
  score_category_code: string;
  item_type_code: string;
  question_quota: string;
  section_duration_seconds: string;
  required_asset_types: string;
};

const levels: JlptLevel[] = ["N1", "N2", "N3", "N4", "N5"];

function initialSlot(level: JlptLevel, sectionCode?: string): SlotDraft {
  const section = jlptFormats[level].sections.find((candidate) => candidate.code === sectionCode) ?? jlptFormats[level].sections[0];
  return {
    test_section_code: section.code,
    score_category_code: section.scoreCategories[0],
    item_type_code: section.code === "listening" ? "quick-response" : section.code === "vocabulary" ? "kanji-reading" : "sentential-grammar-form",
    question_quota: "1",
    section_duration_seconds: String(section.minutes * 60),
    required_asset_types: section.code === "listening" ? "audio" : "",
  };
}

export function BlueprintAuthoringForm() {
  const router = useRouter();
  const [level, setLevel] = useState<JlptLevel>("N5");
  const [version, setVersion] = useState("1");
  const [slots, setSlots] = useState<SlotDraft[]>([initialSlot("N5")]);
  const [blueprintId, setBlueprintId] = useState("");
  const [drafts, setDrafts] = useState<{ id: string; level: JlptLevel; version: number }[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadDrafts() {
      const supabase = createSupabaseBrowserClient();
      if (!supabase) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      const { data } = await supabase.from("exam_blueprints").select("id,level,version").eq("created_by", userData.user.id).eq("status", "draft").order("created_at", { ascending: false }).limit(25);
      if (!cancelled) setDrafts((data ?? []) as { id: string; level: JlptLevel; version: number }[]);
    }
    void loadDrafts();
    return () => { cancelled = true; };
  }, []);

  function changeSlot(index: number, update: (slot: SlotDraft) => SlotDraft) {
    setSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? update(slot) : slot));
    setDirty(true);
  }

  async function resumeDraft(id: string) {
    setError("");
    setMessage("");
    if (!id) {
      setBlueprintId("");
      setDirty(false);
      setSlots([initialSlot(level)]);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured in this browser session.");
    const [blueprintResult, slotsResult] = await Promise.all([
      supabase.from("exam_blueprints").select("id,level,version").eq("id", id).single(),
      supabase.from("blueprint_slots").select("test_section_code,score_category_code,item_type_code,question_quota,section_duration_seconds,required_asset_types").eq("blueprint_id", id).order("slot_order"),
    ]);
    if (blueprintResult.error || slotsResult.error) return setError(blueprintResult.error?.message ?? slotsResult.error?.message ?? "Could not load this draft.");
    const blueprint = blueprintResult.data;
    setBlueprintId(blueprint.id);
    setLevel(blueprint.level as JlptLevel);
    setVersion(String(blueprint.version));
    setSlots((slotsResult.data ?? []).map((slot) => ({
      test_section_code: slot.test_section_code,
      score_category_code: slot.score_category_code,
      item_type_code: slot.item_type_code,
      question_quota: String(slot.question_quota),
      section_duration_seconds: String(slot.section_duration_seconds),
      required_asset_types: (slot.required_asset_types ?? []).join(", "),
    })));
    setDirty(false);
  }

  function changeLevel(nextLevel: JlptLevel) {
    setLevel(nextLevel);
    setSlots([initialSlot(nextLevel)]);
    setBlueprintId("");
    setDirty(false);
    setMessage("");
  }

  function changeSection(index: number, sectionCode: string) {
    const suggestion = initialSlot(level, sectionCode);
    changeSlot(index, (slot) => ({ ...suggestion, question_quota: slot.question_quota }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured in this browser session.");
    const payload = slots.map((slot, index) => ({
      slot_order: index + 1,
      test_section_code: slot.test_section_code.trim(),
      score_category_code: slot.score_category_code.trim(),
      item_type_code: normalizeItemTypeCode(slot.item_type_code),
      question_quota: Number(slot.question_quota),
      section_duration_seconds: Number(slot.section_duration_seconds),
      required_asset_types: slot.required_asset_types.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean),
    }));
    if (payload.some((slot) => !slot.test_section_code || !slot.score_category_code || !slot.item_type_code || !Number.isInteger(slot.question_quota) || slot.question_quota < 1 || !Number.isInteger(slot.section_duration_seconds) || slot.section_duration_seconds < 1)) {
      return setError("Fill every slot field with a positive quota and duration.");
    }
    setBusy(true);
    const { data, error: rpcError } = blueprintId
      ? await supabase.rpc("update_exam_blueprint_draft_slots", { p_blueprint_id: blueprintId, p_slots: payload })
      : await supabase.rpc("create_exam_blueprint_draft", { p_level: level, p_version: Number(version), p_slots: payload });
    setBusy(false);
    if (rpcError) return setError(rpcError.message);
    setBlueprintId(String(data));
    setDirty(false);
    setDrafts((current) => [{ id: String(data), level, version: Number(version) }, ...current.filter((draft) => draft.id !== String(data))]);
    setMessage("Blueprint draft saved. Review the slot counts and timing, then submit it for independent review.");
    router.refresh();
  }

  async function submitForReview() {
    if (!blueprintId) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured in this browser session.");
    setBusy(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("submit_exam_blueprint_for_review", { p_blueprint_id: blueprintId });
    setBusy(false);
    if (rpcError) return setError(rpcError.message);
    setMessage("Blueprint submitted. A different reviewer must approve it before form assembly.");
    setDrafts((current) => current.filter((draft) => draft.id !== blueprintId));
    setBlueprintId("");
    setDirty(false);
    setSlots([initialSlot(level)]);
    router.refresh();
  }

  return (
    <div className="workflow-stack">
      <p className="workflow-note"><strong>Starting structure only.</strong> This editable draft begins with one sample slot. Set every real JLPT item type and its full quota before review; this template is not a publishable mock exam.</p>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
      <label>Resume one of your saved drafts<select value={blueprintId} onChange={(event) => void resumeDraft(event.target.value)}><option value="">Start a new blueprint</option>{drafts.map((draft) => <option key={draft.id} value={draft.id}>{draft.level} · version {draft.version} · {draft.id.slice(0, 8)}</option>)}</select></label>
      <form className="workflow-form" onSubmit={save}>
        <div className="workflow-form__row">
          <label>JLPT level<select value={level} disabled={Boolean(blueprintId)} onChange={(event) => changeLevel(event.target.value as JlptLevel)}>{levels.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Blueprint version<input type="number" min="1" value={version} disabled={Boolean(blueprintId)} onChange={(event) => setVersion(event.target.value)} required /></label>
        </div>
        <div className="workflow-slots">
          {slots.map((slot, index) => {
            const sections = jlptFormats[level].sections;
            const selectedSection = sections.find((section) => section.code === slot.test_section_code) ?? sections[0];
            return (
              <fieldset className="workflow-slot" key={index}>
                <legend>Slot {index + 1}</legend>
                <div className="workflow-form__row">
                  <label>Timed section<select value={slot.test_section_code} onChange={(event) => changeSection(index, event.target.value)}>{sections.map((section) => <option key={section.code} value={section.code}>{section.label}</option>)}</select></label>
                  <label>Score category<select value={slot.score_category_code} onChange={(event) => changeSlot(index, (item) => ({ ...item, score_category_code: event.target.value }))}>{jlptFormats[level].scoreCategories.map((category) => <option key={category.code} value={category.code}>{category.label}</option>)}</select></label>
                  <label>Item type code<input value={slot.item_type_code} onChange={(event) => changeSlot(index, (item) => ({ ...item, item_type_code: event.target.value }))} required /></label>
                </div>
                <div className="workflow-form__row">
                  <label>Question quota<input type="number" min="1" value={slot.question_quota} onChange={(event) => changeSlot(index, (item) => ({ ...item, question_quota: event.target.value }))} required /></label>
                  <label>Section duration (seconds)<input type="number" min="1" value={slot.section_duration_seconds} onChange={(event) => changeSlot(index, (item) => ({ ...item, section_duration_seconds: event.target.value }))} required /><small>{selectedSection.minutes} minutes in the current JLPT timing reference</small></label>
                  <label>Required media types<input placeholder="audio, image" value={slot.required_asset_types} onChange={(event) => changeSlot(index, (item) => ({ ...item, required_asset_types: event.target.value }))} /><small>Comma-separated; leave blank when none is required</small></label>
                </div>
                {slots.length > 1 ? <button className="text-button" type="button" onClick={() => { setSlots((current) => current.filter((_, i) => i !== index)); setDirty(true); }}>Remove slot</button> : null}
              </fieldset>
            );
          })}
        </div>
        <div className="workflow-actions"><button className="btn btn--secondary" type="button" onClick={() => { setSlots((current) => [...current, initialSlot(level)]); setDirty(true); }}>Add slot</button><button className="btn btn--primary" type="submit" disabled={busy || Boolean(blueprintId && !dirty)}>{busy ? "Saving…" : blueprintId ? "Save draft changes" : "Save blueprint draft"}</button></div>
        {blueprintId ? <div><button className="btn btn--primary" type="button" onClick={() => void submitForReview()} disabled={busy || dirty}>{busy ? "Submitting…" : dirty ? "Save changes before review" : "Submit for independent review"}</button>{dirty ? <p className="section-note">The form has unsaved changes. Save them before sending this draft to review.</p> : null}</div> : null}
      </form>
    </div>
  );
}

export type BlueprintReviewItem = {
  id: string;
  level: string;
  version: number;
  created_by: string;
  created_at: string;
  slots: { slot_order: number; test_section_code: string; score_category_code: string; item_type_code: string; question_quota: number; section_duration_seconds: number; required_asset_types: string[] }[];
};

export function BlueprintReviewQueue({ rows }: { rows: BlueprintReviewItem[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function decide(id: string, decision: "approved" | "rejected" | "needs_changes") {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured in this browser session.");
    setError("");
    setBusyId(id);
    const { error: rpcError } = await supabase.rpc("review_exam_blueprint", {
      p_blueprint_id: id,
      p_decision: decision,
      p_notes: notes[id]?.trim() || null,
    });
    setBusyId("");
    if (rpcError) setError(rpcError.message);
    else router.refresh();
  }

  if (!rows.length) return <div className="empty-state"><p>No blueprints are waiting for review.</p></div>;
  return <div className="review-queue">
    {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
    {rows.map((row) => <article className="review-queue__item" key={row.id}>
      <div className="review-queue__meta"><span>{row.level} · v{row.version}</span><span>{row.slots.length} slots</span><code>{row.id.slice(0, 8)}</code></div>
      <div className="table-scroll"><table><thead><tr><th>Section</th><th>Category</th><th>Item type</th><th>Quota</th><th>Timing</th><th>Required media</th></tr></thead><tbody>{row.slots.map((slot) => <tr key={slot.slot_order}><td>{slot.test_section_code}</td><td>{slot.score_category_code}</td><td>{slot.item_type_code}</td><td>{slot.question_quota}</td><td>{Math.round(slot.section_duration_seconds / 60)} min</td><td>{slot.required_asset_types.join(", ") || "—"}</td></tr>)}</tbody></table></div>
      <p className="review-queue__provenance">Author account: <code>{row.created_by}</code></p>
      <label className="review-queue__notes">Review note <span className="field-optional">Optional</span><textarea maxLength={2000} value={notes[row.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [row.id]: event.target.value }))} /></label>
      <div className="review-queue__actions"><button className="btn btn--primary" type="button" disabled={busyId === row.id} onClick={() => void decide(row.id, "approved")}>{busyId === row.id ? "Saving…" : "Approve blueprint"}</button><button className="btn btn--secondary" type="button" disabled={busyId === row.id} onClick={() => void decide(row.id, "needs_changes")}>Return for changes</button><button className="btn btn--secondary" type="button" disabled={busyId === row.id} onClick={() => void decide(row.id, "rejected")}>Reject blueprint</button></div>
    </article>)}
  </div>;
}
