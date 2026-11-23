"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ImportQuestion = {
  content_key: string;
  revision: number;
  level: "N1" | "N2" | "N3" | "N4" | "N5";
  test_section_code: string;
  score_category_code: string;
  item_type_code: string;
  difficulty_estimate: number | null;
  prompt: unknown[];
  options: { id: string; content?: unknown; text?: unknown }[];
  tags: string[];
  answer_key: { correct_option_id: string; explanation: Record<string, unknown>; distractor_rationales?: Record<string, unknown> };
  source_type: string;
  source_reference: string | null;
  rights_notes: string | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function normalizeImport(input: unknown): ImportQuestion[] {
  const root = objectValue(input);
  const entries = Array.isArray(input) ? input : root && Array.isArray(root.questions) ? root.questions : [input];
  if (!entries.length || entries.length > 100) throw new Error("Choose a file with between 1 and 100 questions.");
  return entries.map((entry, index) => {
    const record = objectValue(entry);
    if (!record) throw new Error(`Item ${index + 1} must be an object.`);
    const question = objectValue(record.question) ?? record;
    const rawTags = record.tags ?? question.tags;
    const answerKey = objectValue(record.answer_key);
    const options = question.options;
    const prompt = question.prompt;
    const level = String(question.level ?? "");
    if (!answerKey || !Array.isArray(prompt) || !prompt.length || !Array.isArray(options) || options.length < 2) {
      throw new Error(`Item ${index + 1} needs question.prompt, question.options and answer_key.`);
    }
    if (!Array.isArray(rawTags) || rawTags.length < 1 || rawTags.length > 8) {
      throw new Error(`Item ${index + 1} needs one to eight skill tags.`);
    }
    const tags = [...new Set(rawTags.map((tag) => String(tag).trim().toLowerCase()))];
    if (tags.length !== rawTags.length || tags.some((tag) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag))) {
      throw new Error(`Item ${index + 1} tags must be unique lowercase slugs using hyphens.`);
    }
    const cleanOptions = options.map((option) => {
      const optionObject = objectValue(option);
      if (!optionObject || typeof optionObject.id !== "string" || !("content" in optionObject || "text" in optionObject)) {
        throw new Error(`Item ${index + 1} has an option without an ID and content.`);
      }
      return { id: optionObject.id, content: optionObject.content, text: optionObject.text };
    });
    if (new Set(cleanOptions.map((option) => option.id)).size !== cleanOptions.length || !cleanOptions.some((option) => option.id === answerKey.correct_option_id)) {
      throw new Error(`Item ${index + 1} has duplicate option IDs or an answer key that does not match an option.`);
    }
    if (!("explanation" in answerKey) || !["N1", "N2", "N3", "N4", "N5"].includes(level)) {
      throw new Error(`Item ${index + 1} needs a supported JLPT level and explanation.`);
    }
    const sourceType = String(record.source_type ?? "original");
    if (!["original", "licensed", "public_domain", "permission_granted"].includes(sourceType)) {
      throw new Error(`Item ${index + 1} has an unsupported source_type.`);
    }
    const contentKey = String(question.content_key ?? "");
    const difficulty = question.difficulty_estimate == null || question.difficulty_estimate === "" ? null : Number(question.difficulty_estimate);
    if (difficulty != null && (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)) throw new Error(`Item ${index + 1} difficulty must be from 1 to 5.`);
    return {
      content_key: uuidPattern.test(contentKey) ? contentKey : crypto.randomUUID(),
      revision: Number(question.revision ?? 1),
      level: level as ImportQuestion["level"],
      test_section_code: String(question.test_section_code ?? ""),
      score_category_code: String(question.score_category_code ?? ""),
      item_type_code: String(question.item_type_code ?? ""),
      difficulty_estimate: difficulty,
      prompt,
      options: cleanOptions,
      tags,
      answer_key: {
        correct_option_id: String(answerKey.correct_option_id ?? ""),
        explanation: objectValue(answerKey.explanation) ?? {},
        distractor_rationales: objectValue(answerKey.distractor_rationales) ?? {},
      },
      source_type: sourceType,
      source_reference: typeof record.source_reference === "string" ? record.source_reference : null,
      rights_notes: typeof record.rights_notes === "string" ? record.rights_notes : null,
    };
  });
}

export function QuestionBatchImport() {
  const router = useRouter();
  const [questions, setQuestions] = useState<ImportQuestion[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setQuestions([]);
    setFileName("");
    setError("");
    setMessage("");
    if (!file) return;
    try {
      const normalized = normalizeImport(JSON.parse(await file.text()));
      setQuestions(normalized);
      setFileName(file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this JSON file.");
      event.target.value = "";
    }
  }

  async function importDrafts() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured in this browser session.");
    setBusy(true);
    setError("");
    setMessage("");
    const { data, error: rpcError } = await supabase.rpc("create_question_drafts_batch", { p_questions: questions });
    setBusy(false);
    if (rpcError) return setError(rpcError.message);
    const importedCount = Array.isArray(data) ? data.length : questions.length;
    setMessage(`${importedCount} question draft${importedCount === 1 ? "" : "s"} imported atomically. Every draft still needs its media and a separate review before form assembly.`);
    setQuestions([]);
    setFileName("");
    router.refresh();
  }

  return <div className="question-batch-import">
    <p className="workflow-note"><strong>Draft import only.</strong> Upload the provided JSON template or an array of matching records. The import is atomic, creates no approved questions, and allows up to 100 items per batch. Invalid source rights or answer data blocks the entire batch.</p>
    {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
    {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
    <label>Question JSON file<input type="file" accept="application/json,.json" onChange={(event) => void loadFile(event)} /></label>
    {questions.length ? <div className="question-batch-import__preview"><div><strong>{fileName}</strong><span>{questions.length} draft question{questions.length === 1 ? "" : "s"}</span></div><ul>{questions.slice(0, 5).map((question, index) => <li key={`${question.content_key}-${index}`}>{question.level} · {question.test_section_code} · {question.item_type_code} · {question.tags.join(", ")}</li>)}</ul>{questions.length > 5 ? <small>and {questions.length - 5} more</small> : null}<button className="btn btn--primary" type="button" disabled={busy} onClick={() => void importDrafts()}>{busy ? "Importing…" : `Create ${questions.length} draft${questions.length === 1 ? "" : "s"}`}</button></div> : null}
  </div>;
}
