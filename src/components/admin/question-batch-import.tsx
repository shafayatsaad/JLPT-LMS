"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createClientUuid } from "@/lib/client-uuid";
import { normalizeItemTypeCode } from "@/lib/jlpt-format";

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
const maxStructuredFileBytes = 10 * 1024 * 1024;
const maxArchiveBytes = 150 * 1024 * 1024;
const maxArchiveExpandedBytes = 250 * 1024 * 1024;
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
      content_key: uuidPattern.test(contentKey) ? contentKey : createClientUuid(),
      revision: Number(question.revision ?? 1),
      level: level as ImportQuestion["level"],
      test_section_code: String(question.test_section_code ?? ""),
      score_category_code: String(question.score_category_code ?? ""),
      item_type_code: normalizeItemTypeCode(String(question.item_type_code ?? "")),
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

function parseCsvRows(source: string) {
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index++; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"' && cell.length === 0) quoted = true;
    else if (character === ",") { row.push(cell); cell = ""; }
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index++;
      row.push(cell); cell = "";
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += character;
  }
  if (quoted) throw new Error("The CSV file ends inside a quoted field.");
  if (cell.length || row.length) { row.push(cell); if (row.some((value) => value.trim())) rows.push(row); }
  if (rows.length < 2 || rows.length > 101) throw new Error("A CSV import needs a header and between 1 and 100 question rows.");
  const headers = rows[0].map((value) => value.trim().toLowerCase());
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) throw new Error("CSV column names must be present and unique.");
  return rows.slice(1).map((values, index) => {
    const rowValue = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
    return tableRowToQuestion(rowValue, index + 2);
  });
}

function parseJsonCell(value: unknown, field: string, fallback?: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Spreadsheet column “${field}” must contain JSON.`);
  }
  try { return JSON.parse(value); }
  catch { throw new Error(`Spreadsheet column “${field}” contains invalid JSON.`); }
}

function tableRowToQuestion(row: Record<string, unknown>, rowNumber: number) {
  const read = (field: string) => String(row[field] ?? "").trim();
  const level = read("level");
  const prompt = parseJsonCell(row.prompt_json, "prompt_json");
  const options = parseJsonCell(row.options_json, "options_json");
  const tags = parseJsonCell(row.tags_json, "tags_json");
  const explanation = parseJsonCell(row.explanation_json, "explanation_json");
  const distractors = parseJsonCell(row.distractor_rationales_json, "distractor_rationales_json", {});
  const assets = parseJsonCell(row.assets_json, "assets_json", []);
  if (!Array.isArray(prompt) || !Array.isArray(options) || !Array.isArray(tags) || !Array.isArray(assets)) {
    throw new Error(`Spreadsheet row ${rowNumber} must use JSON arrays for prompt_json, options_json, tags_json, and assets_json.`);
  }
  const difficulty = read("difficulty_estimate");
  return {
    source_type: read("source_type") || "original",
    source_reference: read("source_reference") || null,
    rights_notes: read("rights_notes") || null,
    tags,
    assets,
    question: {
      content_key: read("content_key"),
      revision: read("revision") || 1,
      level,
      test_section_code: read("test_section_code"),
      score_category_code: read("score_category_code"),
      item_type_code: read("item_type_code"),
      difficulty_estimate: difficulty,
      prompt,
      options,
    },
    answer_key: {
      correct_option_id: read("correct_option_id"),
      explanation,
      distractor_rationales: distractors,
    },
  };
}

async function parseWorkbook(file: File) {
  if (file.size > maxStructuredFileBytes) throw new Error("A CSV or Excel question file must be no larger than 10 MB.");
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) throw new Error("The workbook must have a first sheet with a header and question rows.");
  const headers = Array.from({ length: sheet.columnCount }, (_, index) => String(sheet.getCell(1, index + 1).text ?? "").trim().toLowerCase());
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) throw new Error("Excel column names in row 1 must be present and unique.");
  if (sheet.rowCount > 101) throw new Error("A workbook can contain up to 100 question rows.");
  const entries: unknown[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = Object.fromEntries(headers.map((header, column) => [header, sheet.getCell(rowNumber, column + 1).text ?? ""]));
    if (Object.values(row).some((value) => String(value).trim())) entries.push(tableRowToQuestion(row, rowNumber));
  }
  if (!entries.length) throw new Error("The workbook has no question rows after its header.");
  return entries;
}

async function unpackQuestionArchive(file: File) {
  if (file.size > maxArchiveBytes) throw new Error("A ZIP question package must be no larger than 150 MB.");
  const JSZip = (await import("jszip")).default;
  const archive = await JSZip.loadAsync(file, { checkCRC32: true });
  const entries = Object.values(archive.files).filter((entry) => !entry.dir);
  if (!entries.length || entries.length > 201) throw new Error("A ZIP package can contain one data file and up to 200 media files.");
  const output: File[] = [];
  let expandedBytes = 0;
  for (const entry of entries) {
    const unsafeName = (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name;
    const normalized = unsafeName.replaceAll("\\", "/");
    const permissions = Number(entry.unixPermissions ?? 0);
    if (normalized.startsWith("/") || /^[a-z]:/i.test(normalized) || normalized.split("/").some((part) => part === ".." || part === ".") || normalized.includes("\0") || (permissions & 0o170000) === 0o120000) {
      throw new Error(`The ZIP package contains an unsafe path: ${unsafeName}`);
    }
    const extension = normalized.split(".").pop()?.toLowerCase() ?? "";
    const structured = ["json", "csv", "xlsx"].includes(extension);
    const type = structured ? "" : mediaType(new File([], normalized.split("/").at(-1) ?? normalized));
    if (extension === "pdf") throw new Error("PDFs belong in the private Source Library; they are not converted into questions by this importer.");
    if (!structured && (!type || !allowedTypes.has(type))) throw new Error(`ZIP entry “${normalized}” is not a supported question file or media asset.`);
    const advertisedBytes = Number((entry as typeof entry & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0);
    const entryLimit = structured ? maxStructuredFileBytes : maxAssetBytes;
    if (advertisedBytes > entryLimit) throw new Error(`ZIP entry “${normalized}” is larger than its ${structured ? "10 MB" : "50 MB"} limit.`);
    expandedBytes += advertisedBytes;
    if (expandedBytes > maxArchiveExpandedBytes) throw new Error("The extracted ZIP package exceeds the 250 MB safety limit.");
    const bytes = await entry.async("uint8array");
    const basename = normalized.split("/").at(-1) ?? normalized;
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const extracted = new File([data], basename, { type });
    Object.defineProperty(extracted, "webkitRelativePath", { value: normalized });
    output.push(extracted);
  }
  return output;
}

async function readStructuredFile(file: File): Promise<unknown> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return parseCsvRows(await file.text());
  if (extension === "xlsx") return parseWorkbook(file);
  if (extension === "json") {
    if (file.size > maxStructuredFileBytes) throw new Error("A JSON manifest must be no larger than 10 MB.");
    return JSON.parse(await file.text());
  }
  throw new Error("Choose a JSON, CSV, or Excel (.xlsx) question file, or a ZIP question package.");
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
    const chosen = Array.from(event.target.files ?? []);
    setQuestions([]); setFiles([]); setFileName(""); setError(""); setMessage(""); setDetails("");
    if (!chosen.length) return;
    try {
      const selected = chosen.length === 1 && chosen[0].name.toLowerCase().endsWith(".zip")
        ? await unpackQuestionArchive(chosen[0])
        : chosen;
      const structuredFiles = selected.filter((file) => /\.(json|csv|xlsx)$/i.test(file.name));
      const manifests = structuredFiles.filter((file) => /^manifest\.(json|csv|xlsx)$/i.test(file.name));
      const manifest = manifests.length === 1 ? manifests[0] : structuredFiles.length === 1 ? structuredFiles[0] : null;
      if (!manifest) throw new Error("Choose one manifest.json/.csv/.xlsx with its referenced media, or upload one structured question file.");
      const normalized = normalizeImport(await readStructuredFile(manifest));
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
      const batchId = createClientUuid();
      const attachments: { question_id: string; storage_path: string; media_type: string; purpose: string; duration_seconds: null; file_name: string; file_size_bytes: number }[] = [];

      for (const [questionIndex, question] of questions.entries()) for (const asset of question.assets) {
        const file = fileForReference(files, asset.file);
        const type = mediaType(file);
        const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100) || "media";
        const storagePath = `${userResult.user.id}/imports/${batchId}/${createClientUuid()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from("jlpt-question-assets").upload(storagePath, file, { contentType: type, cacheControl: "3600", upsert: false });
        if (uploadError) throw new Error(`Upload failed for “${file.name}”: ${uploadError.message}`);
        uploadedPaths.push(storagePath);
        attachments.push({ question_id: questionIds[questionIndex], storage_path: storagePath, media_type: type, purpose: asset.purpose, duration_seconds: null, file_name: file.name, file_size_bytes: file.size });
      }

      let registeredAssetIds: string[] = [];
      if (attachments.length) {
        const { data: assetData, error: attachError } = await supabase.rpc("register_question_assets_batch", { p_assets: attachments });
        if (attachError || !Array.isArray(assetData)) throw new Error(attachError?.message ?? "Media uploaded, but the assets could not be attached to the question drafts.");
        assetsRegistered = true;
        registeredAssetIds = [...new Set(assetData.map(String))];
        if (assetData.length !== attachments.length) throw new Error("The database returned an incomplete asset attachment list.");
        for (const [index, assetIdValue] of assetData.entries()) {
          const assetId = String(assetIdValue);
          const attachment = attachments[index];
          const { error: metadataError } = await supabase.rpc("update_question_asset_file_details", {
            p_asset_id: assetId,
            p_file_name: attachment.file_name,
            p_file_size_bytes: attachment.file_size_bytes,
          });
          if (metadataError) throw new Error(`The asset was attached but its file details could not be saved: ${metadataError.message}`);
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
    <p className="workflow-note"><strong>Question import.</strong> Upload JSON, CSV, Excel (.xlsx), a ZIP package, or a folder with a manifest and referenced media. The importer validates the package, creates unpublished drafts, uploads private media, then submits questions and assets to separate review queues. Each batch supports up to 100 questions; each media file can be up to 50 MB.</p>
    {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
    {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
    <label>Structured question file or ZIP<input type="file" accept="application/json,.json,.csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.zip,application/zip" onChange={(event) => void loadFiles(event)} /></label>
    <label>Question folder with media<input ref={folderInput} type="file" multiple accept="application/json,.json,.csv,.xlsx,audio/*,image/jpeg,image/png,image/webp" onChange={(event) => void loadFiles(event)} /></label>
    <p className="field-hint">Use <a href="/templates/jlpt-question-authoring-demo.json" download>the downloadable JSON example</a> as a starting point. CSV and Excel files use a header row; nested <code>prompt_json</code>, <code>options_json</code>, <code>tags_json</code>, <code>explanation_json</code>, <code>distractor_rationales_json</code>, and <code>assets_json</code> cells contain valid JSON. ZIP packages include exactly one structured question file plus referenced images/audio. Every asset entry names a file relative to the package and a purpose such as <code>question_audio</code> or <code>stimulus_image</code>. PDFs remain private source references and are not converted here.</p>
    {questions.length ? <div className="question-batch-import__preview"><div><strong>{fileName}</strong><span>{questions.length} question drafts · {details}</span></div><ul>{questions.slice(0, 5).map((question, index) => <li key={`${question.content_key}-${index}`}>{question.level} · {question.test_section_code} · {question.item_type_code} · {question.tags.join(", ")} · {question.assets.length} media</li>)}</ul>{questions.length > 5 ? <small>and {questions.length - 5} more</small> : null}<button className="btn btn--primary" type="button" disabled={busy} onClick={() => void importDrafts()}>{busy ? "Importing and submitting…" : `Import ${questions.length} question${questions.length === 1 ? "" : "s"} with media`}</button></div> : null}
  </div>;
}
