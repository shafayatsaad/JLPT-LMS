"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { jlptFormats, normalizeItemTypeCode, officialItemTypes, type JlptLevel } from "@/lib/jlpt-format";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createClientUuid } from "@/lib/client-uuid";
import { QuestionAssetUploader } from "@/components/admin/question-asset-uploader";

const levels: JlptLevel[] = ["N1", "N2", "N3", "N4", "N5"];
const optionIds = ["A", "B", "C", "D"];

function itemAreasForSection(sectionCode: string) {
  if (sectionCode === "vocabulary") return ["Vocabulary"];
  if (sectionCode === "listening") return ["Listening"];
  if (sectionCode === "grammar-reading") return ["Grammar", "Reading"];
  return ["Vocabulary", "Grammar", "Reading"];
}

function parseSkillTags(value: string) {
  return [...new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

export function QuestionAuthoringForm() {
  const router = useRouter();
  const [level, setLevel] = useState<JlptLevel>("N5");
  const [familyId, setFamilyId] = useState("");
  const [revision, setRevision] = useState("1");
  const [sectionCode, setSectionCode] = useState("vocabulary");
  const [categoryCode, setCategoryCode] = useState("language-knowledge-reading");
  const [itemTypeCode, setItemTypeCode] = useState("kanji-reading");
  const [prompt, setPrompt] = useState("【DEMO】「水」を なんと よみますか。");
  const [skillTags, setSkillTags] = useState("vocabulary, kanji-reading");
  const [options, setOptions] = useState(["みず", "みせ", "みち", "みみ"]);
  const [correctOption, setCorrectOption] = useState("A");
  const [explanationEn, setExplanationEn] = useState("水 is read みず in this context.");
  const [explanationJa, setExplanationJa] = useState("この場合、「水」は「みず」と読みます。");
  const [explanationBn, setExplanationBn] = useState("");
  const [difficulty, setDifficulty] = useState("1");
  const [sourceType, setSourceType] = useState("original");
  const [sourceReference, setSourceReference] = useState("");
  const [rightsNotes, setRightsNotes] = useState("");
  const [questionId, setQuestionId] = useState("");
  const [hasUnsubmittedAsset, setHasUnsubmittedAsset] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const sectionOptions = jlptFormats[level].sections;
  const activeSection = sectionOptions.find((section) => section.code === sectionCode) ?? sectionOptions[0];
  const categoryOptions = useMemo(() => [...new Set(activeSection.scoreCategories)], [activeSection]);
  const itemTypeOptions = useMemo(() => {
    const areas = itemAreasForSection(activeSection.code);
    return officialItemTypes.filter((type) => type.levels.some((supportedLevel) => supportedLevel === level) && areas.includes(type.area));
  }, [activeSection.code, level]);

  function changeLevel(value: JlptLevel) {
    const nextSection = jlptFormats[value].sections[0];
    const nextAreas = itemAreasForSection(nextSection.code);
    const nextItem = officialItemTypes.find((type) => type.levels.some((supportedLevel) => supportedLevel === value) && nextAreas.includes(type.area));
    setLevel(value);
    setSectionCode(nextSection.code);
    setCategoryCode(nextSection.scoreCategories[0]);
    setItemTypeCode(nextItem?.code ?? "");
  }

  function changeSection(value: string) {
    const nextSection = sectionOptions.find((section) => section.code === value);
    if (!nextSection) return;
    const nextAreas = itemAreasForSection(nextSection.code);
    const nextItem = officialItemTypes.find((type) => type.levels.some((supportedLevel) => supportedLevel === level) && nextAreas.includes(type.area));
    setSectionCode(value);
    setCategoryCode(nextSection.scoreCategories[0]);
    setItemTypeCode(nextItem?.code ?? "");
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured in this browser session.");
      return;
    }
    if (questionId && hasUnsubmittedAsset) {
      setError("Submit the attached media for review before submitting the question.");
      return;
    }
    const tags = parseSkillTags(skillTags);
    if (!tags.length || tags.length > 8 || tags.some((tag) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag))) {
      setError("Add one to eight unique skill tags using lowercase letters, numbers and hyphens (for example, vocabulary, kanji-reading).");
      return;
    }
    if (!questionId && !explanationEn.trim() && !explanationJa.trim() && !explanationBn.trim()) {
      setError("Add an explanation in at least one language.");
      return;
    }

    setBusy(true);
    try {
    if (!questionId) {
      const { data, error: saveError } = await supabase.rpc("create_question_draft", {
        p_content_key: familyId.trim() || createClientUuid(),
        p_revision: Number(revision),
        p_level: level,
        p_test_section_code: sectionCode,
        p_score_category_code: categoryCode,
        p_item_type_code: normalizeItemTypeCode(itemTypeCode),
        p_prompt: [{ type: "text", text: prompt.trim() }],
        p_options: options.map((text, index) => ({
          id: optionIds[index],
          content: [{ type: "text", text: text.trim() }],
        })),
        p_correct_option_id: correctOption,
        p_explanation: {
          ...(explanationEn.trim() ? { en: explanationEn.trim() } : {}),
          ...(explanationJa.trim() ? { ja: explanationJa.trim() } : {}),
          ...(explanationBn.trim() ? { bn: explanationBn.trim() } : {}),
        },
        p_distractor_rationales: {},
        p_difficulty_estimate: Number(difficulty),
        p_source_type: sourceType,
        p_source_reference: sourceReference.trim() || null,
        p_rights_notes: rightsNotes.trim() || null,
      });
      if (saveError || !data) {
        setError(saveError?.message ?? "The draft could not be saved.");
        return;
      }
      setQuestionId(String(data));
      const { error: tagError } = await supabase.rpc("set_question_draft_skill_tags", {
        p_question_id: String(data),
        p_tag_slugs: tags,
      });
      if (tagError) {
        setError(`Draft saved, but its skill tags were not saved: ${tagError.message}`);
        return;
      }
      setMessage("Draft saved with its answer key. Review the content, then submit it for a separate review.");
      router.refresh();
      return;
    }

    const { error: tagError } = await supabase.rpc("set_question_draft_skill_tags", {
      p_question_id: questionId,
      p_tag_slugs: tags,
    });
    if (tagError) {
      setError(tagError.message);
      return;
    }
    const { error: submitError } = await supabase.rpc("submit_question_for_review", { p_question_id: questionId });
    if (submitError) {
      setError(submitError.message);
      return;
    }
    setSubmitted(true);
    setMessage("Question submitted. A different reviewer must approve it before it can enter an exam form.");
    router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The question draft could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function startAnotherDraft() {
    setQuestionId("");
    setSubmitted(false);
    setSkillTags("vocabulary, kanji-reading");
    setMessage("");
    setError("");
  }

  return (
    <form className="question-authoring-form" onSubmit={(event) => void saveDraft(event)}>
      <div className="question-authoring-form__intro">
        <span className="status-chip status-chip--muted">Draft only</span>
        <p>This example is original demo content. Saving creates a draft and answer key; it does not publish an exam question.</p>
      </div>
      <div className="question-authoring-form__grid">
        <label>Question family UUID <span className="field-optional">Leave blank for a new question</span><input maxLength={36} disabled={Boolean(questionId) || submitted} placeholder="Existing family UUID for a new revision" value={familyId} onChange={(event) => setFamilyId(event.target.value)} /></label>
        <label>Revision<input required type="number" min="1" max="9999" disabled={Boolean(questionId) || submitted} value={revision} onChange={(event) => setRevision(event.target.value)} /></label>
        <label>JLPT level<select value={level} disabled={Boolean(questionId) || submitted} onChange={(event) => changeLevel(event.target.value as JlptLevel)}>{levels.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Test section<select value={activeSection.code} disabled={Boolean(questionId) || submitted} onChange={(event) => changeSection(event.target.value)}>{sectionOptions.map((section) => <option key={section.code} value={section.code}>{section.label}</option>)}</select></label>
        <label>Score category<select value={categoryCode} disabled={Boolean(questionId) || submitted} onChange={(event) => setCategoryCode(event.target.value)}>{categoryOptions.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
        <label>Question type<select value={itemTypeCode} disabled={Boolean(questionId) || submitted} onChange={(event) => setItemTypeCode(event.target.value)}>{itemTypeOptions.map((type) => <option key={type.code} value={type.code}>{type.label}</option>)}</select></label>
      </div>

      <label>Question prompt<textarea required maxLength={4000} disabled={Boolean(questionId) || submitted} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label>

      <label>Skill tags<input required maxLength={240} disabled={submitted} value={skillTags} onChange={(event) => setSkillTags(event.target.value)} /><span className="field-hint">Comma-separated slugs; these power targeted practice and review filters. Use one to eight, such as vocabulary, kanji-reading.</span></label>

      <fieldset className="question-authoring-form__options" disabled={Boolean(questionId) || submitted}>
        <legend>Answer options</legend>
        {options.map((value, index) => <label key={optionIds[index]}><span>{optionIds[index]}</span><input required maxLength={1000} value={value} onChange={(event) => setOptions((current) => current.map((option, optionIndex) => optionIndex === index ? event.target.value : option))} /></label>)}
        <label className="question-authoring-form__correct">Correct option<select value={correctOption} onChange={(event) => setCorrectOption(event.target.value)}>{optionIds.map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
      </fieldset>

      <div className="question-authoring-form__grid">
        <label>Explanation · English<textarea maxLength={3000} disabled={Boolean(questionId) || submitted} value={explanationEn} onChange={(event) => setExplanationEn(event.target.value)} /></label>
        <label>Explanation · Japanese<textarea maxLength={3000} disabled={Boolean(questionId) || submitted} lang="ja" value={explanationJa} onChange={(event) => setExplanationJa(event.target.value)} /></label>
        <label>Explanation · Bangla <span className="field-optional">Optional</span><textarea maxLength={3000} disabled={Boolean(questionId) || submitted} lang="bn" value={explanationBn} onChange={(event) => setExplanationBn(event.target.value)} /></label>
        <label>Difficulty<select value={difficulty} disabled={Boolean(questionId) || submitted} onChange={(event) => setDifficulty(event.target.value)}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      </div>

      <fieldset className="question-authoring-form__rights" disabled={Boolean(questionId) || submitted}>
        <legend>Source and usage rights</legend>
        <label>Source type<select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="original">Original</option><option value="licensed">Licensed</option><option value="public_domain">Public domain</option><option value="permission_granted">Permission granted</option></select></label>
        {sourceType !== "original" ? <div className="question-authoring-form__grid"><label>Source reference<input required maxLength={500} value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} /></label><label>Rights notes<input required maxLength={2000} value={rightsNotes} onChange={(event) => setRightsNotes(event.target.value)} /></label></div> : <p className="section-note">Use Original only for content authored by the platform team. Third-party material needs a source reference and rights notes.</p>}
      </fieldset>

      {questionId ? <p className="question-authoring-form__id">Draft ID <code>{questionId}</code></p> : null}
      {questionId && !submitted ? <QuestionAssetUploader questionId={questionId} onPendingChange={setHasUnsubmittedAsset} /> : null}
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
      <div className="product-cta-row">
        {!submitted ? <button className="btn btn--primary" type="submit" disabled={busy || hasUnsubmittedAsset}>{busy ? "Saving…" : questionId ? "Submit for review" : "Save draft"}</button> : null}
        {questionId ? <button className="btn btn--secondary" type="button" disabled={busy} onClick={startAnotherDraft}>Prepare another draft</button> : null}
      </div>
    </form>
  );
}
