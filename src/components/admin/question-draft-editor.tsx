"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createClientUuid } from "@/lib/client-uuid";
import { normalizeItemTypeCode } from "@/lib/jlpt-format";
import { QuestionAssetUploader } from "@/components/admin/question-asset-uploader";

type EditableQuestionDraft = {
  id: string;
  level: "N1" | "N2" | "N3" | "N4" | "N5";
  test_section_code: string;
  score_category_code: string;
  item_type_code: string;
  prompt: unknown;
  options: unknown;
  difficulty_estimate: number | null;
  source_type: string;
  source_reference: string | null;
  rights_notes: string | null;
  authored_by: string;
};

type EditableAnswerKey = {
  correct_option_id: string;
  explanation: unknown;
  distractor_rationales: unknown;
};

type BlockKind = "text" | "ruby" | "line_break" | "advanced";
type ContentBlockDraft = { key: string; kind: BlockKind; original: unknown; text: string; base: string; reading: string; json: string };
type OptionDraft = { id: string; blocks: ContentBlockDraft[] };

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textOf(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join("");
  const row = recordOf(value);
  if (row.type === "line_break") return "\n";
  if (row.type === "ruby") return `${textOf(row.base ?? row.text)}（${textOf(row.reading ?? row.rt)}）`;
  return textOf(row.content ?? row.text ?? row.value ?? "");
}

function toBlockDrafts(value: unknown, seed: string): ContentBlockDraft[] {
  const source = Array.isArray(value) ? value : typeof value === "string" ? [{ type: "text", text: value }] : [];
  return source.map((block, index) => {
    const row = recordOf(block);
    const kind: BlockKind = row.type === "text" ? "text" : row.type === "ruby" ? "ruby" : row.type === "line_break" ? "line_break" : "advanced";
    return {
      key: `${seed}-${index}-${createClientUuid()}`,
      kind,
      original: block,
      text: kind === "text" ? String(row.text ?? row.value ?? "") : "",
      base: kind === "ruby" ? textOf(row.base ?? row.text ?? "") : "",
      reading: kind === "ruby" ? textOf(row.reading ?? row.rt ?? "") : "",
      json: kind === "advanced" ? JSON.stringify(block, null, 2) : "",
    };
  });
}

function newBlock(kind: BlockKind): ContentBlockDraft {
  const key = `new-${createClientUuid()}`;
  return { key, kind, original: null, text: "", base: "", reading: "", json: "{\n  \"type\": \"text\",\n  \"text\": \"\"\n}" };
}

function serializeBlocks(blocks: ContentBlockDraft[], fieldLabel: string): unknown[] {
  if (!blocks.length) throw new Error(`${fieldLabel} needs at least one content block.`);
  return blocks.map((block, index) => {
    const original = recordOf(block.original);
    if (block.kind === "text") return { ...original, type: "text", text: block.text };
    if (block.kind === "ruby") return { ...original, type: "ruby", base: block.base, reading: block.reading };
    if (block.kind === "line_break") return block.original ?? { type: "line_break" };
    try {
      const parsed = JSON.parse(block.json) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      return parsed;
    } catch {
      throw new Error(`${fieldLabel}, block ${index + 1}: enter a valid JSON object or keep the original content.`);
    }
  });
}

function previewBlocks(blocks: ContentBlockDraft[]) {
  return blocks.map((block) => {
    if (block.kind === "text") return { type: "text", text: block.text };
    if (block.kind === "ruby") return { type: "ruby", base: block.base, reading: block.reading };
    if (block.kind === "line_break") return { type: "line_break" };
    try { return JSON.parse(block.json) as unknown; }
    catch { return { type: "text", text: "[Check advanced content block JSON]" }; }
  });
}

function renderContent(value: unknown, key = "preview"): ReactNode {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((part, index) => <span key={`${key}-${index}`}>{renderContent(part, `${key}-${index}`)}</span>);
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.type === "text") return String(row.text ?? row.value ?? "");
  if (row.type === "ruby") return <ruby>{renderContent(row.base ?? row.text, `${key}-base`)}<rt>{renderContent(row.reading ?? row.rt, `${key}-reading`)}</rt></ruby>;
  if (row.type === "line_break") return <br />;
  if (row.type === "image" && typeof row.url === "string" && /^https?:\/\//.test(row.url)) return <img className="exam-content-image" src={row.url} alt={String(row.alt ?? "Question image")} />;
  if ("content" in row) return renderContent(row.content, `${key}-content`);
  if ("text" in row) return renderContent(row.text, `${key}-text`);
  return <span className="question-draft-preview__media">Embedded content block</span>;
}

function ContentBlocksEditor({ label, blocks, onChange, onEdit }: { label: string; blocks: ContentBlockDraft[]; onChange: (next: ContentBlockDraft[]) => void; onEdit: () => void }) {
  function update(key: string, patch: Partial<ContentBlockDraft>) {
    onEdit();
    onChange(blocks.map((block) => block.key === key ? { ...block, ...patch } : block));
  }

  return (
    <fieldset className="question-content-editor">
      <legend>{label}</legend>
      <div className="question-content-editor__blocks">
        {blocks.map((block, index) => (
          <div className="question-content-editor__block" key={block.key}>
            <div className="question-content-editor__toolbar">
              <span>Block {index + 1}</span>
              <label>Content type<select aria-label={`${label} block ${index + 1} type`} value={block.kind} onChange={(event) => update(block.key, { kind: event.target.value as BlockKind })}><option value="text">Text</option><option value="ruby">Ruby text</option><option value="line_break">Line break</option><option value="advanced">Image, media or advanced</option></select></label>
              <button className="text-link" type="button" aria-label={`Remove ${label.toLowerCase()} block ${index + 1}`} disabled={blocks.length <= 1} onClick={() => { onEdit(); onChange(blocks.filter((item) => item.key !== block.key)); }}>Remove</button>
            </div>
            {block.kind === "text" ? <label>Text<textarea rows={3} maxLength={4000} value={block.text} onChange={(event) => update(block.key, { text: event.target.value })} /></label> : null}
            {block.kind === "ruby" ? <div className="question-content-editor__ruby"><label>Kanji or base text<input maxLength={1000} value={block.base} onChange={(event) => update(block.key, { base: event.target.value })} /></label><label>Reading<input maxLength={1000} value={block.reading} onChange={(event) => update(block.key, { reading: event.target.value })} /></label></div> : null}
            {block.kind === "line_break" ? <p className="field-hint">A line break will be retained in the exam view.</p> : null}
            {block.kind === "advanced" ? <label>Content block JSON<textarea rows={5} spellCheck={false} value={block.json} onChange={(event) => update(block.key, { json: event.target.value })} /><span className="field-hint">Used for media references and specialized content. The exam preview below reflects valid blocks.</span></label> : null}
          </div>
        ))}
      </div>
      <button className="btn btn--secondary" type="button" onClick={() => { onEdit(); onChange([...blocks, newBlock("text")]); }}>Add text block</button>
    </fieldset>
  );
}

function languageValue(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2);
}

export function QuestionDraftEditor({ question, answerKey, skillTags, canAttachAssets, tagsAvailable }: { question: EditableQuestionDraft; answerKey: EditableAnswerKey; skillTags: string[]; canAttachAssets: boolean; tagsAvailable: boolean }) {
  const router = useRouter();
  const [level, setLevel] = useState(question.level);
  const [section, setSection] = useState(question.test_section_code);
  const [category, setCategory] = useState(question.score_category_code);
  const [itemType, setItemType] = useState(question.item_type_code);
  const [prompt, setPrompt] = useState(() => toBlockDrafts(question.prompt, "prompt"));
  const [options, setOptions] = useState<OptionDraft[]>(() => (Array.isArray(question.options) ? question.options : []).map((option, index) => {
    const row = recordOf(option);
    return { id: String(row.id ?? String.fromCharCode(65 + index)), blocks: toBlockDrafts(row.content ?? row.text ?? "", `option-${index}`) };
  }));
  const [correctOption, setCorrectOption] = useState(answerKey.correct_option_id);
  const originalExplanation = recordOf(answerKey.explanation);
  const [explanation, setExplanation] = useState({ en: languageValue(originalExplanation.en), ja: languageValue(originalExplanation.ja), bn: languageValue(originalExplanation.bn) });
  const [otherExplanation] = useState(Object.fromEntries(Object.entries(originalExplanation).filter(([key]) => !["en", "ja", "bn"].includes(key))));
  const originalRationales = recordOf(answerKey.distractor_rationales);
  const [rationales, setRationales] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(originalRationales).map(([key, value]) => [key, languageValue(value)])));
  const [tags, setTags] = useState(skillTags.join(", "));
  const [difficulty, setDifficulty] = useState(question.difficulty_estimate?.toString() ?? "");
  const [sourceType, setSourceType] = useState(question.source_type);
  const [sourceReference, setSourceReference] = useState(question.source_reference ?? "");
  const [rightsNotes, setRightsNotes] = useState(question.rights_notes ?? "");
  const [pendingAsset, setPendingAsset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function edit() { setDirty(true); setMessage(""); }

  function discardEdits() {
    if (!dirty || busy || submitted) return;
    if (window.confirm("Discard unsaved question edits and reload the saved draft?")) window.location.reload();
  }

  function updateOption(index: number, patch: Partial<OptionDraft>) {
    const previousId = options[index]?.id;
    const next = options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option);
    setOptions(next);
    if (patch.id && previousId === correctOption) setCorrectOption(patch.id);
    edit();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!tagsAvailable) {
      setError("Skill tags could not be loaded. Reload the page before saving to avoid overwriting the existing tags.");
      return;
    }
    const tagValues = [...new Set(tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
    if (!tagValues.length || tagValues.length > 8 || tagValues.some((tag) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag))) {
      setError("Use one to eight unique skill tags with lowercase letters, numbers and hyphens.");
      return;
    }
    if (options.length < 2 || options.length > 20) {
      setError("A question needs between 2 and 20 answer choices.");
      return;
    }
    const optionIds = options.map((option) => option.id.trim());
    if (optionIds.some((id) => !id) || new Set(optionIds).size !== optionIds.length) {
      setError("Every answer choice needs a unique ID.");
      return;
    }
    if (!optionIds.includes(correctOption)) {
      setError("Select the correct answer from the current choices.");
      return;
    }

    let promptValue: unknown[];
    let optionValues: unknown[];
    try {
      promptValue = serializeBlocks(prompt, "Question prompt");
      optionValues = options.map((option, index) => ({ id: optionIds[index], content: serializeBlocks(option.blocks, `Choice ${optionIds[index]}`) }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check the question content blocks.");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured for this session.");
      return;
    }
    setBusy(true);
    const { error: saveError } = await supabase.rpc("update_question_draft", {
      p_question_id: question.id,
      p_level: level,
      p_test_section_code: section,
      p_score_category_code: category,
      p_item_type_code: normalizeItemTypeCode(itemType),
      p_prompt: promptValue,
      p_options: optionValues,
      p_correct_option_id: correctOption,
      p_explanation: { ...otherExplanation, ...Object.fromEntries(Object.entries(explanation).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])) },
      p_distractor_rationales: Object.fromEntries(Object.entries(rationales).filter(([id, value]) => optionIds.includes(id) && value.trim()).map(([id, value]) => [id, value.trim()])),
      p_difficulty_estimate: difficulty ? Number(difficulty) : null,
      p_source_type: sourceType,
      p_source_reference: sourceReference.trim() || null,
      p_rights_notes: rightsNotes.trim() || null,
    });
    if (saveError) {
      setBusy(false);
      setError("The draft was not saved. Check its metadata, answer choices, source rights and editor permissions.");
      return;
    }
    const { error: tagError } = await supabase.rpc("set_question_draft_skill_tags", { p_question_id: question.id, p_tag_slugs: tagValues });
    setBusy(false);
    if (tagError) {
      setError(`The question was saved, but skill tags were not updated: ${tagError.message}`);
      router.refresh();
      return;
    }
    setDirty(false);
    setMessage("Draft saved with its answer key and skill tags. Submit it for a separate review when it is ready.");
    router.refresh();
  }

  async function submitForReview() {
    setError("");
    setMessage("");
    if (dirty) {
      setError("Save your latest edits before submitting this question for review.");
      return;
    }
    if (pendingAsset) {
      setError("Finish uploading and submit the attached media for review before submitting the question.");
      return;
    }
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured for this session.");
      return;
    }
    setBusy(true);
    const { error: submitError } = await supabase.rpc("submit_question_for_review", { p_question_id: question.id });
    setBusy(false);
    if (submitError) {
      setError("This draft could not be submitted. Confirm it belongs to your account, has a valid answer key and includes its source rights.");
      return;
    }
    setSubmitted(true);
    setMessage("Question submitted. A different reviewer must approve it before it can enter an exam form.");
    router.refresh();
  }

  const previewOptions = options.map((option, index) => ({ ...option, id: option.id || String.fromCharCode(65 + index) }));

  return (
    <form className="workflow-form question-draft-editor" onSubmit={(event) => void save(event)}>
      <p className="workflow-note"><strong>Draft only.</strong> Published revisions remain unchanged. Saving edits this draft; question approval stays with a separate reviewer.</p>
      <div className="workflow-form__row">
        <label>JLPT level<select value={level} onChange={(event) => { setLevel(event.target.value as EditableQuestionDraft["level"]); edit(); }}>{["N1", "N2", "N3", "N4", "N5"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Section code<input required maxLength={80} value={section} onChange={(event) => { setSection(event.target.value); edit(); }} /></label>
        <label>Score category code<input required maxLength={80} value={category} onChange={(event) => { setCategory(event.target.value); edit(); }} /></label>
      </div>
      <div className="workflow-form__row">
        <label>Question type code<input required maxLength={80} value={itemType} onChange={(event) => { setItemType(event.target.value); edit(); }} /></label>
        <label>Difficulty<select value={difficulty} onChange={(event) => { setDifficulty(event.target.value); edit(); }}><option value="">Not set</option>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
        <label>Source type<select value={sourceType} onChange={(event) => { setSourceType(event.target.value); edit(); }}><option value="original">Original</option><option value="licensed">Licensed</option><option value="public_domain">Public domain</option><option value="permission_granted">Permission granted</option></select></label>
      </div>

      <ContentBlocksEditor label="Question prompt" blocks={prompt} onChange={setPrompt} onEdit={edit} />

      <label>Skill tags<input required maxLength={240} value={tags} onChange={(event) => { setTags(event.target.value); edit(); }} /><span className="field-hint">Separate one to eight tags with commas, such as vocabulary, kanji-reading.</span></label>

      <fieldset className="question-choice-editor">
        <legend>Answer choices</legend>
        {options.map((option, index) => (
          <div className="question-choice-editor__item" key={`choice-${index}`}>
            <div className="question-choice-editor__heading"><strong>Choice {index + 1}</strong><label>Choice ID<input required maxLength={80} value={option.id} onChange={(event) => updateOption(index, { id: event.target.value })} /></label><button className="text-link" type="button" aria-label={`Remove choice ${index + 1}`} disabled={options.length <= 2} onClick={() => { setOptions((current) => current.filter((_, choiceIndex) => choiceIndex !== index)); edit(); }}>Remove choice</button></div>
            <ContentBlocksEditor label={`Choice ${option.id || index + 1} content`} blocks={option.blocks} onChange={(blocks) => updateOption(index, { blocks })} onEdit={edit} />
            <label>Why this choice is incorrect <span className="field-optional">Optional</span><textarea rows={2} maxLength={2000} value={rationales[option.id] ?? ""} onChange={(event) => { setRationales((current) => ({ ...current, [option.id]: event.target.value })); edit(); }} /></label>
          </div>
        ))}
        <div className="question-choice-editor__actions"><label>Correct answer<select value={correctOption} onChange={(event) => { setCorrectOption(event.target.value); edit(); }}>{previewOptions.map((option) => <option key={option.id} value={option.id}>{option.id}</option>)}</select></label><button className="btn btn--secondary" type="button" disabled={options.length >= 20} onClick={() => { const nextId = String.fromCharCode(65 + options.length); setOptions((current) => [...current, { id: nextId, blocks: [newBlock("text")] }]); edit(); }}>Add answer choice</button></div>
      </fieldset>

      <div className="workflow-form__row">
        <label>Explanation · English<textarea rows={3} maxLength={3000} value={explanation.en} onChange={(event) => { setExplanation((current) => ({ ...current, en: event.target.value })); edit(); }} /></label>
        <label>Explanation · Japanese<textarea rows={3} maxLength={3000} lang="ja" value={explanation.ja} onChange={(event) => { setExplanation((current) => ({ ...current, ja: event.target.value })); edit(); }} /></label>
        <label>Explanation · Bangla <span className="field-optional">Optional</span><textarea rows={3} maxLength={3000} lang="bn" value={explanation.bn} onChange={(event) => { setExplanation((current) => ({ ...current, bn: event.target.value })); edit(); }} /></label>
      </div>

      <div className="workflow-form__row">
        <label>Source reference<input maxLength={500} value={sourceReference} onChange={(event) => { setSourceReference(event.target.value); edit(); }} /></label>
        <label>Rights notes<textarea rows={2} maxLength={2000} value={rightsNotes} onChange={(event) => { setRightsNotes(event.target.value); edit(); }} /></label>
      </div>

      {canAttachAssets ? <QuestionAssetUploader questionId={question.id} onPendingChange={setPendingAsset} /> : <p className="workflow-note">Media can be attached from the question author’s account. This draft was authored by another staff member.</p>}

      <section className="question-draft-paper" aria-labelledby="question-draft-paper-title">
        <div className="question-draft-paper__heading"><div><span className="status-chip status-chip--muted">Live preview</span><h3 id="question-draft-paper-title">Exam question layout</h3></div><span>{level} · {section.replaceAll("-", " ")}</span></div>
        <div className="question-draft-paper__body" lang="ja">
          <p className="question-draft-paper__prompt">{renderContent(previewBlocks(prompt), "live-prompt")}</p>
          <ol className="question-draft-paper__choices">{previewOptions.map((option) => <li key={`preview-${option.id}`}><span className="question-draft-paper__bubble">{option.id}</span><span>{renderContent(previewBlocks(option.blocks), `preview-${option.id}`)}</span></li>)}</ol>
        </div>
      </section>

      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
      <div className="product-cta-row">
        <button className="btn btn--primary" type="submit" disabled={busy || submitted || !tagsAvailable}>{busy ? "Saving…" : "Save draft"}</button>
        <button className="btn btn--secondary" type="button" disabled={busy || submitted || !dirty} onClick={discardEdits}>Discard edits</button>
        <button className="btn btn--secondary" type="button" disabled={busy || submitted || dirty || pendingAsset || !tagsAvailable} onClick={() => void submitForReview()}>{busy ? "Working…" : "Submit saved draft for review"}</button>
        {dirty ? <span className="field-hint" role="status">Unsaved edits</span> : null}
      </div>
    </form>
  );
}
