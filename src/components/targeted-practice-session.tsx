"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/locale-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type PracticeOption = { id: string; content?: unknown; text?: unknown };
type PracticeQuestion = {
  question_id: string;
  position: number;
  item_type_code: string;
  prompt: unknown;
  options: PracticeOption[];
  selected_option_id: string | null;
};
export type TargetedPracticePayload = {
  session: { id: string; level: string; tag_slug: string; status: string; question_count: number; raw_correct: number | null; raw_incorrect: number | null; raw_unanswered: number | null; submitted_at: string | null; created_at: string };
  questions: PracticeQuestion[];
};

function content(value: unknown): React.ReactNode {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((part, index) => <span key={index}>{content(part)}</span>);
  if (!value || typeof value !== "object") return null;
  const block = value as Record<string, unknown>;
  if (block.type === "text") return String(block.text ?? block.value ?? "");
  if (block.type === "ruby") return <ruby>{content(block.base ?? block.text)}<rt>{content(block.reading ?? block.rt)}</rt></ruby>;
  if (block.type === "line_break") return <br />;
  if (block.type === "image") return <span>{String(block.alt ?? "Image material")}</span>;
  if ("content" in block) return content(block.content);
  if ("text" in block) return content(block.text);
  return null;
}

export function TargetedPracticeSession({ initialPayload }: { initialPayload: TargetedPracticePayload }) {
  const router = useRouter();
  const { t } = useLocale();
  const [questions, setQuestions] = useState(initialPayload.questions);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<"save" | "submit" | null>(null);
  const current = questions[selectedIndex];
  const answered = questions.filter((question) => question.selected_option_id).length;
  const blockedByUnsavedAnswer = saving || submitting || error === "save";

  async function saveAnswer(optionId: string) {
    if (!current || saving || current.selected_option_id === optionId) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("save");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error: saveError } = await supabase.rpc("save_targeted_practice_answer", {
        p_session_id: initialPayload.session.id,
        p_question_id: current.question_id,
        p_selected_option_id: optionId,
      });
      if (saveError) setError("save");
      else setQuestions((rows) => rows.map((question) => question.question_id === current.question_id ? { ...question, selected_option_id: optionId } : question));
    } catch {
      setError("save");
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase || submitting) {
      setError("submit");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data, error: submitError } = await supabase.rpc("submit_targeted_practice", {
        p_session_id: initialPayload.session.id,
      });
      if (submitError || !data) {
        setError("submit");
        setSubmitting(false);
        return;
      }
      router.replace(`/practice/${initialPayload.session.id}/review`);
      router.refresh();
    } catch {
      setError("submit");
      setSubmitting(false);
    }
  }

  return (
    <div className="targeted-practice-session">
      <div className="targeted-practice-session__head">
        <div>
          <p className="product-small-label">JLPT {initialPayload.session.level} · {initialPayload.session.tag_slug.replaceAll("-", " ")}</p>
          <h2>{t("practice.question", { current: selectedIndex + 1, total: questions.length })}</h2>
        </div>
        <span className="status-chip">{answered}/{questions.length}</span>
      </div>
      <div className="practice-progress" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answered}><span style={{ width: `${questions.length ? answered / questions.length * 100 : 0}%` }} /></div>
      <nav className="practice-question-nav" aria-label={t("practice.selectAnswer")}>
        {questions.map((question, index) => <button key={question.question_id} className={selectedIndex === index ? "is-active" : ""} type="button" onClick={() => setSelectedIndex(index)} aria-current={selectedIndex === index ? "step" : undefined} aria-label={t("practice.question", { current: index + 1, total: questions.length })}>{index + 1}{question.selected_option_id ? <span aria-hidden="true">✓</span> : null}</button>)}
      </nav>
      {current ? <article className="practice-question-card origami-answer-card">
        <p className="product-small-label">{current.item_type_code.replaceAll("-", " ")}</p>
        <div className="targeted-practice-prompt" lang="ja">{content(current.prompt)}</div>
        <fieldset className="exam-answer-list" disabled={saving || submitting}>
          <legend>{t("practice.selectAnswer")}</legend>
          {current.options.map((option) => <label className={`exam-answer-option ${current.selected_option_id === option.id ? "is-selected" : ""}`} key={option.id}>
            <input type="radio" name={current.question_id} value={option.id} checked={current.selected_option_id === option.id} onChange={() => void saveAnswer(option.id)} />
            <span className="exam-answer-option__letter">{option.id}</span>
            <span lang="ja">{content(option.content ?? option.text)}</span>
          </label>)}
        </fieldset>
      </article> : null}
      <p className="practice-save-state" role="status">{saving ? t("practice.answerSaving") : t("practice.answerSaved")}</p>
      {error ? <p className="form-message form-message--error" role="alert">{t(error === "save" ? "practice.saveError" : "practice.submitError")}</p> : null}
      <div className="targeted-practice-session__actions">
        <button className="btn btn--secondary" type="button" disabled={selectedIndex === 0 || blockedByUnsavedAnswer} onClick={() => setSelectedIndex((index) => Math.max(index - 1, 0))}><ArrowLeft size={16} aria-hidden="true" /> {t("practice.previous")}</button>
        {selectedIndex < questions.length - 1 ? <button className="btn btn--secondary" type="button" disabled={blockedByUnsavedAnswer} onClick={() => setSelectedIndex((index) => Math.min(index + 1, questions.length - 1))}>{t("practice.next")} <ArrowRight size={16} aria-hidden="true" /></button> : null}
      </div>
      {confirming ? <div className="practice-submit-confirm" role="group" aria-label={t("practice.confirmSubmit")}>
        <p>{t("practice.confirmPrompt")}</p>
        <button className="btn btn--primary" type="button" disabled={blockedByUnsavedAnswer} onClick={() => void submit()}>{submitting ? t("practice.submitting") : t("practice.confirmSubmit")} <Send size={15} aria-hidden="true" /></button>
        <button className="auth-quiet-action" type="button" disabled={submitting} onClick={() => setConfirming(false)}>{t("practice.keepWorking")}</button>
      </div> : <button className="btn btn--primary" type="button" disabled={blockedByUnsavedAnswer} onClick={() => setConfirming(true)}>{t("practice.submit")} <Send size={15} aria-hidden="true" /></button>}
    </div>
  );
}
