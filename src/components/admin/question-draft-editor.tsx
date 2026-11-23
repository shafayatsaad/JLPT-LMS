"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
};

type EditableAnswerKey = {
  correct_option_id: string;
  explanation: unknown;
  distractor_rationales: unknown;
};

export function QuestionDraftEditor({ question, answerKey }: { question: EditableQuestionDraft; answerKey: EditableAnswerKey }) {
  const router = useRouter();
  const [level, setLevel] = useState(question.level);
  const [section, setSection] = useState(question.test_section_code);
  const [category, setCategory] = useState(question.score_category_code);
  const [itemType, setItemType] = useState(question.item_type_code);
  const [prompt, setPrompt] = useState(JSON.stringify(question.prompt, null, 2));
  const [options, setOptions] = useState(JSON.stringify(question.options, null, 2));
  const [correctOption, setCorrectOption] = useState(answerKey.correct_option_id);
  const [explanation, setExplanation] = useState(JSON.stringify(answerKey.explanation, null, 2));
  const [distractors, setDistractors] = useState(JSON.stringify(answerKey.distractor_rationales, null, 2));
  const [difficulty, setDifficulty] = useState(question.difficulty_estimate?.toString() ?? "");
  const [sourceType, setSourceType] = useState(question.source_type);
  const [sourceReference, setSourceReference] = useState(question.source_reference ?? "");
  const [rightsNotes, setRightsNotes] = useState(question.rights_notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    let promptValue: unknown;
    let optionsValue: unknown;
    let explanationValue: unknown;
    let distractorsValue: unknown;
    try {
      promptValue = JSON.parse(prompt);
      optionsValue = JSON.parse(options);
      explanationValue = JSON.parse(explanation);
      distractorsValue = JSON.parse(distractors);
    } catch {
      setError("Check the JSON in the prompt, choices, explanation and distractor notes.");
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
      p_item_type_code: itemType,
      p_prompt: promptValue,
      p_options: optionsValue,
      p_correct_option_id: correctOption,
      p_explanation: explanationValue,
      p_distractor_rationales: distractorsValue,
      p_difficulty_estimate: difficulty ? Number(difficulty) : null,
      p_source_type: sourceType,
      p_source_reference: sourceReference || null,
      p_rights_notes: rightsNotes || null,
    });
    setBusy(false);
    if (saveError) {
      setError("The draft was not saved. Confirm it is still in draft status, the answer JSON is valid, and your editor role is active.");
      return;
    }
    setMessage("Draft saved. It remains in draft until you submit it for independent review.");
    router.refresh();
  }

  return (
    <form className="workflow-form question-draft-editor" onSubmit={(event) => void save(event)}>
      <p className="workflow-note"><strong>Draft only.</strong> This action cannot change a question after it is submitted for review. Submission and approval remain separate steps.</p>
      <div className="workflow-form__row">
        <label>JLPT level<select value={level} onChange={(event) => setLevel(event.target.value as EditableQuestionDraft["level"])}>{["N1", "N2", "N3", "N4", "N5"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Section code<input required maxLength={80} value={section} onChange={(event) => setSection(event.target.value)} /></label>
        <label>Score category code<input required maxLength={80} value={category} onChange={(event) => setCategory(event.target.value)} /></label>
      </div>
      <div className="workflow-form__row">
        <label>Item type code<input required maxLength={80} value={itemType} onChange={(event) => setItemType(event.target.value)} /></label>
        <label>Difficulty estimate<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}><option value="">Not set</option>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label>
        <label>Source type<select value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="original">Original</option><option value="licensed">Licensed</option><option value="public_domain">Public domain</option><option value="permission_granted">Permission granted</option></select></label>
      </div>
      <label>Prompt content blocks · JSON<textarea required rows={8} spellCheck={false} value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label>
      <label>Answer options · JSON<textarea required rows={9} spellCheck={false} value={options} onChange={(event) => setOptions(event.target.value)} /></label>
      <label>Correct option ID<input required maxLength={80} value={correctOption} onChange={(event) => setCorrectOption(event.target.value)} /></label>
      <label>Explanation · JSON object<textarea required rows={5} spellCheck={false} value={explanation} onChange={(event) => setExplanation(event.target.value)} /></label>
      <label>Distractor rationales · JSON object<textarea required rows={5} spellCheck={false} value={distractors} onChange={(event) => setDistractors(event.target.value)} /></label>
      <div className="workflow-form__row">
        <label>Source reference<input maxLength={500} value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} /></label>
        <label>Rights notes<input maxLength={2000} value={rightsNotes} onChange={(event) => setRightsNotes(event.target.value)} /></label>
      </div>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
      <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Saving draft…" : "Save draft"}</button>
    </form>
  );
}
