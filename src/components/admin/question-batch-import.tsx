"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ImportAsset = { file: string; purpose: "question_audio" | "question_image" | "stimulus_audio" | "stimulus_image"; media_type?: string };
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
  assets: ImportAsset[];
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const maxAssetBytes = 50 * 1024 * 1024;
const allowedTypes = new Set(["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm", "image/jpeg", "image/png", "image/webp"]);

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function normalizeImport(input: unknown): ImportQuestion[] {
  const root = objectValue(input);
  const entries = Array.isArray(input) ? input : root && Array.isArray(root.questions) ? root.questions : [input];
  if (!entries.length || entries.length > 100) throw new Error("Choose a manifest with between 1 and 100 questions.");
  return entries.map((entry, index) => {
    const record = objectValue(entry);
    if (!record) throw new Error(`Item ${index + 1} must be an object.`);
    const question = objectValue(record.question) ?? record;
    const rawTags = record.tags ?? question.tags;
    const answerKey = objectValue(record.answer_key);
    const options = question.options;
    const prompt = question.prompt;
    const level = String(question.level ?? "");
    if (!answerKey || !Array.isArray(prompt) || !prompt.length || !Array.isArray(options) || options.length < 2) throw new Error(`Item ${index + 1} needs question.prompt, question.options and answer_key.`);
    if (!Array.isArray(rawTags) || rawTags.length < 1 || rawTags.length > 8) throw new Error(`Item ${index + 1} needs one to eight skill tags.`);
    const tags = [...new Set(rawTags.map((tag) => String(tag).trim().toLowerCase()))];
    if (tags.length !== rawTags.length || tags.some((tag) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag))) throw new Error(`Item ${index + 1} tags must be unique lowercase slugs using hyphens.`);
    const cleanOptions = options.map((option) => {
      const optionObject = objectValue(option);
      if (!optionObject || typeof optionObject.id !== "string" || !("content" in optionObject || "text" in optionObject)) throw new Error(`Item ${index + 1} has an option without an ID and content.`);
      return { id: optionObject.id, content: optionObject.content, text: optionObject.text };
    });
    if (new Set(cleanOptions.map((option) => option.id)).size !== cleanOptions.length || !cleanOptions.some((option) => option.id === answerKey.correct_option_id)) throw new Error(`Item ${index + 1} has duplicate option IDs or an answer key that does not match an option.`);
    if (!("explanation" in answerKey) || !["N1", "N2", "N3", "N4", "N5"].includes(level)) throw new Error(`Item ${index + 1} needs a supported JLPT level and explanation.`);
    const sourceType = String(record.source_type ?? "original");
    if (!["original", "licensed", "public_domain", "permission_granted"].includes(sourceType)) throw new Error(`Item ${index + 1} has an unsupported source_type.`);
    const contentKey = String(question.content_key ?? "");
    const difficulty = question.difficulty_estimate == null || question.difficulty_estimate === "" ? null : Number(question.difficulty_estimate);
    if (difficulty != null && (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)) throw new Error(`Item ${index + 1} difficulty must be from 1 to 5.`);
    const rawAssets = record.assets ?? question.assets ?? [];
    if (!Array.isArray(rawAssets) || rawAssets.length > 20) throw new Error(`Item ${index + 1} may attach up to 20 media files.`);
    const assets = rawAssets.map((rawAsset) => {
      const asset = objectValue(rawAsset);
      const file = typeof asset?.file === "string" ? asset.file.trim().replaceAll("\\", "/") : "";
      const purpose = String(asset?.purpose ?? "");
      if (!file || file.startsWith("/") || file.split("/").some((part) => part === ".." || part === ".") || !["question_audio", "question_image", "stimulus_audio", "stimulus_image"].includes(purpose)) throw new Error(`Item ${index + 1} has an invalid asset file or purpose.`);
      return { file, purpose: purpose as ImportAsset["purpose"], media_type: typeof asset?.media_type === "string" ? asset.media_type : undefined };
    });
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
      answer_key: { correct_option_id: String(answerKey.correct_option_id ?? ""), explanation: objectValue(answerKey.explanation) ?? {}, distractor_rationales: objectValue(answerKey.distractor_rationales) ?? {} },
      source_type: sourceType,
      source_reference: typeof record.source_reference === "string" ? record.source_reference : null,
      rights_notes: typeof record.rights_notes === "string" ? record.rights_notes : null,
      assets,
    };
  });
}

function mediaType(file: File) {
  if (allowedTypes.has(file.type)) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const byExtension: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", wav: "audio/wav", webm: "audio/webm", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
  return ext ? byExtension[ext] ?? "" : "";
}

function fileForReference(files: File[], reference: string) {
  const normalized = reference.replaceAll("\\", "/").replace(/^\.\//, "");
  const matches = files.filter((file) => {
    const fullPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    return fullPath === normalized || fullPath.endsWith(`/${normalized}`) || (!normalized.includes("/") && file.name === normalized);
  });
  if (matches.length !== 1) throw new Error(matches.length ? `Asset path “${reference}” matches more than one file.` : `Asset file “${reference}” is not in the selected folder.`);
  return matches[0];
}

export function QuestionBatchImport() {
  const router = useRouter();
  const folderInput = useRef<HTMLInputElement>(null);
  const [questions, setQuestions] = useState<ImportQuestion[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => { folderInput.current?.setAttribute("webkitdirectory", ""); }, []);

  async function loadFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setQuestions([]); setFiles([]); setFileName(""); setError(""); setMessage(""); setDetails("");
    if (!selected.length) return;
    try {
      const manifests = selected.filter((file) => file.name.toLowerCase() === "manifest.json");
      const manifest = manifests.length === 1 ? manifests[0] : selected.length === 1 && selected[0].name.toLowerCase().endsWith(".json") ? selected[0] : null;
      if (!manifest) throw new Error("Select one folder containing manifest.json and its referenced media files, or choose a single JSON file without media.");
      const normalized = normalizeImport(JSON.parse(await manifest.text()));
      setQuestions(normalized); setFiles(selected); setFileName(manifest.name);
      const assetCount = normalized.reduce((count, question) => count + question.assets.length, 0);
      setDetails(`${assetCount} referenced media file${assetCount === 1 ? "" : "s"} · ${selected.length} selected file${selected.length === 1 ? "" : "s"}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read this import folder.");
      event.target.value = "";
    }
  }

  async function importDrafts() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured in this browser session.");
    setBusy(true); setError(""); setMessage("");
    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) { setBusy(false); return setError("Sign in again before importing questions."); }

    let questionIds: string[] = [];
    const uploadedPaths: string[] = [];
    let assetsRegistered = false;
    try {
      for (const question of questions) for (const asset of question.assets) {
        const file = fileForReference(files, asset.file);
        const type = mediaType(file);
        if (!type || !allowedTypes.has(type)) throw new Error(`“${file.name}” is not supported question audio or image media.`);
        if (file.size < 1 || file.size > maxAssetBytes) throw new Error(`“${file.name}” must be no larger than 50 MB.`);
      }

      const questionPayload = questions.map((question) => {
        const payload: Record<string, unknown> = { ...question };
        delete payload.assets;
        return payload;
      });
      const { data, error: draftError } = await supabase.rpc("create_question_drafts_batch", { p_questions: questionPayload });
      if (draftError || !Array.isArray(data)) throw draftError ?? new Error("Draft creation returned an invalid result.");
      questionIds = data.map(String);
      const batchId = crypto.randomUUID();
      const attachments: { question_id: string; storage_path: string; media_type: string; purpose: string; duration_seconds: null }[] = [];

      for (const [questionIndex, question] of questions.entries()) for (const asset of question.assets) {
        const file = fileForReference(files, asset.file);
        const type = mediaType(file);
        const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100) || "media";
        const storagePath = `${userResult.user.id}/imports/${batchId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("jlpt-question-assets").upload(storagePath, file, { contentType: type, cacheControl: "3600", upsert: false });
        if (uploadError) throw new Error(`Upload failed for “${file.name}”: ${uploadError.message}`);
        uploadedPaths.push(storagePath);
        attachments.push({ question_id: questionIds[questionIndex], storage_path: storagePath, media_type: type, purpose: asset.purpose, duration_seconds: null });
      }

      let registeredAssetIds: string[] = [];
      if (attachments.length) {
        const { data: assetData, error: attachError } = await supabase.rpc("register_question_assets_batch", { p_assets: attachments });
        if (attachError || !Array.isArray(assetData)) throw new Error(attachError?.message ?? "Media uploaded, but the assets could not be attached to the question drafts.");
        assetsRegistered = true;
        registeredAssetIds = [...new Set(assetData.map(String))];
        for (const assetId of registeredAssetIds) {
          const { error: reviewError } = await supabase.rpc("submit_content_asset_for_review", { p_asset_id: assetId });
          if (reviewError) throw new Error(`Question media is attached, but asset review submission failed: ${reviewError.message}`);
        }
      }

      for (const questionId of questionIds) {
        const { error: reviewError } = await supabase.rpc("submit_question_for_review", { p_question_id: questionId });
        if (reviewError) throw new Error(`Some drafts were created but could not be submitted for review: ${reviewError.message}`);
      }

      setMessage(`${questionIds.length} question${questionIds.length === 1 ? "" : "s"} and ${registeredAssetIds.length} media asset${registeredAssetIds.length === 1 ? "" : "s"} uploaded and submitted to the separate review queues.`);
      setQuestions([]); setFiles([]); setFileName(""); setDetails("");
      if (folderInput.current) folderInput.current.value = "";
      router.refresh();
    } catch (cause) {
      if (!assetsRegistered && uploadedPaths.length) await supabase.storage.from("jlpt-question-assets").remove(uploadedPaths);
      const draftNote = questionIds.length ? ` ${questionIds.length} question draft${questionIds.length === 1 ? "" : "s"} already exist; check the question and asset review queues.` : "";
      setError(`${cause instanceof Error ? cause.message : "Could not complete this import."}${draftNote}`);
      if (questionIds.length) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return <div className="question-batch-import">
    <p className="workflow-note"><strong>Folder import.</strong> Select one folder with <code>manifest.json</code> and any referenced images/audio. The importer creates question revisions, uploads private media, then submits questions and assets to their separate review queues. Each batch supports up to 100 questions; each media file can be up to 50 MB.</p>
    {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
    {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
    <label>Question folder<input ref={folderInput} type="file" multiple accept="application/json,.json,audio/*,image/jpeg,image/png,image/webp" onChange={(event) => void loadFiles(event)} /></label>
    <p className="field-hint">Use the downloadable JSON example as a starting point. Every asset entry names a file relative to the folder and a purpose such as <code>question_audio</code> or <code>stimulus_image</code>.</p>
    {questions.length ? <div className="question-batch-import__preview"><div><strong>{fileName}</strong><span>{questions.length} question drafts · {details}</span></div><ul>{questions.slice(0, 5).map((question, index) => <li key={`${question.content_key}-${index}`}>{question.level} · {question.test_section_code} · {question.item_type_code} · {question.tags.join(", ")} · {question.assets.length} media</li>)}</ul>{questions.length > 5 ? <small>and {questions.length - 5} more</small> : null}<button className="btn btn--primary" type="button" disabled={busy} onClick={() => void importDrafts()}>{busy ? "Importing and submitting…" : `Import ${questions.length} question${questions.length === 1 ? "" : "s"} with media`}</button></div> : null}
  </div>;
}
