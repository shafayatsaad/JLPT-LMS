"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AssetLibraryQuestion = { id: string; level: string; section: string; status: string; authored_by: string; purpose: string };
export type AssetLibraryDraftQuestion = { id: string; level: string; section: string };
export type AssetLibraryExam = { form_code: string; status: string };
export type AssetLibraryRow = {
  id: string;
  storage_path: string;
  media_type: string;
  duration_seconds: number | null;
  status: string;
  uploaded_by: string | null;
  created_at: string;
  file_name: string | null;
  file_size_bytes: number | null;
  processing_status: string;
  preview_url: string | null;
  questions: AssetLibraryQuestion[];
  exams: AssetLibraryExam[];
};

const maxBytes = 25 * 1024 * 1024;
const mediaTypes = new Set(["audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg", "audio/wav", "audio/webm", "image/jpeg", "image/png", "image/webp"]);

function formatBytes(value: number | null) {
  if (!value) return "Size not recorded";
  return value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
}

export function AssetLibrary({ rows, userId, isAdmin, canManage, draftQuestions }: { rows: AssetLibraryRow[]; userId: string; isAdmin: boolean; canManage: boolean; draftQuestions: AssetLibraryDraftQuestion[] }) {
  const router = useRouter();
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [editingId, setEditingId] = useState("");
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [linkTargets, setLinkTargets] = useState<Record<string, string>>({});
  const [linkPurposes, setLinkPurposes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function canManageRow(row: AssetLibraryRow) {
    return canManage && (isAdmin || row.uploaded_by === userId);
  }

  function canLinkRow(row: AssetLibraryRow) {
    return canManage && (row.status !== "draft" || isAdmin || row.uploaded_by === userId);
  }

  async function linkToDraft(row: AssetLibraryRow) {
    const questionId = linkTargets[row.id] ?? "";
    const purpose = linkPurposes[row.id] ?? (row.media_type.startsWith("audio/") ? "question_audio" : "question_image");
    if (!questionId) return setError("Choose a draft question to link this file to.");
    if (row.questions.some((question) => question.id === questionId && question.purpose === purpose)) return setError("This file already has that purpose on the selected question.");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Your staff session is unavailable. Sign in again.");
    setBusyId(row.id); setError(""); setNotice("");
    const { error: rpcError } = await supabase.rpc("link_existing_question_asset", { p_question_id: questionId, p_asset_id: row.id, p_purpose: purpose });
    setBusyId("");
    if (rpcError) setError(rpcError.message);
    else { setNotice("File linked to the draft question and recorded in the audit log."); setLinkTargets((values) => ({ ...values, [row.id]: "" })); router.refresh(); }
  }

  async function saveFileName(row: AssetLibraryRow) {
    const fileName = (fileNames[row.id] ?? row.file_name ?? "").trim();
    if (!fileName || fileName.length > 240) return setError("File name must be between 1 and 240 characters.");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Your staff session is unavailable. Sign in again.");
    setBusyId(row.id); setError(""); setNotice("");
    const { error: rpcError } = await supabase.rpc("update_question_asset_file_details", {
      p_asset_id: row.id,
      p_file_name: fileName,
      p_file_size_bytes: row.file_size_bytes,
    });
    setBusyId("");
    if (rpcError) setError(rpcError.message);
    else { setNotice("File details saved and recorded in the audit log."); setEditingId(""); router.refresh(); }
  }

  async function replaceFile(row: AssetLibraryRow, file: File | undefined) {
    if (!file) return;
    if (row.status !== "draft" || !canManageRow(row)) return setError("Only the uploader or an administrator can replace an unreviewed draft file.");
    if (!mediaTypes.has(file.type)) return setError("Use MP3, MP4, AAC, OGG, WAV, WebM, JPEG, PNG or WebP media.");
    if (file.type !== row.media_type) return setError("The replacement must use the same file type so the question and exam media stay compatible.");
    if (file.size < 1 || file.size > maxBytes) return setError("The replacement must be between 1 byte and 25 MB.");
    if (!window.confirm(`Replace the private file for ${row.file_name ?? row.storage_path.split("/").at(-1)}? This updates every draft question currently linked to it.`)) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Your staff session is unavailable. Sign in again.");
    setBusyId(row.id); setError(""); setNotice("");
    const { error: uploadError } = await supabase.storage.from("jlpt-question-assets").upload(row.storage_path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
    if (uploadError) { setBusyId(""); return setError(uploadError.message); }
    const { error: metadataError } = await supabase.rpc("update_question_asset_file_details", {
      p_asset_id: row.id,
      p_file_name: file.name,
      p_file_size_bytes: file.size,
    });
    setBusyId("");
    if (metadataError) setError(`The file was replaced, but its details could not be saved: ${metadataError.message}`);
    else { setNotice("Draft media replaced. Reviewed and published content stays unchanged."); router.refresh(); }
  }

  async function unlink(row: AssetLibraryRow, question: AssetLibraryQuestion) {
    if (question.status !== "draft" || (!isAdmin && question.authored_by !== userId)) return;
    if (!window.confirm(`Unlink this file from question ${question.id.slice(0, 8)}? The draft question will no longer show this asset.`)) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Your staff session is unavailable. Sign in again.");
    setBusyId(row.id); setError(""); setNotice("");
    const { error: rpcError } = await supabase.rpc("unlink_question_asset", { p_question_id: question.id, p_asset_id: row.id, p_purpose: question.purpose });
    setBusyId("");
    if (rpcError) setError(rpcError.message);
    else { setNotice("The draft link was removed and recorded in the audit log."); router.refresh(); }
  }

  async function deleteUnusedFile(row: AssetLibraryRow) {
    if (row.questions.length || !canManageRow(row) || !["draft", "retired"].includes(row.status)) return;
    if (!window.confirm(`Delete ${row.file_name ?? row.storage_path.split("/").at(-1)}? The private file will be removed; an archived metadata record will remain for audit history.`)) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Your staff session is unavailable. Sign in again.");
    setBusyId(row.id); setError(""); setNotice("");
    const { data: storagePath, error: prepareError } = await supabase.rpc("request_question_asset_delete", { p_asset_id: row.id });
    if (prepareError || typeof storagePath !== "string") { setBusyId(""); return setError(prepareError?.message ?? "The file could not be marked for safe removal."); }
    const { error: storageError } = await supabase.storage.from("jlpt-question-assets").remove([storagePath]);
    setBusyId("");
    if (storageError) setError(`The unused asset is archived, but storage could not remove the file. Retry from the archived row: ${storageError.message}`);
    else { setNotice("Unused file deleted. Its archived metadata remains in the audit history."); router.refresh(); }
  }

  return <div className="asset-library">
    {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
    {notice ? <p className="form-message form-message--success" role="status">{notice}</p> : null}
    {!rows.length ? <div className="empty-state"><p>No media assets match these filters.</p><Link className="text-link" href="/admin/questions/new">Upload media with a question draft</Link></div> : rows.map((row) => (
      <article className="asset-library__item" key={row.id}>
        <header className="asset-library__header">
          <div><span className="status-chip">{row.status.replaceAll("_", " ")}</span> <span className="status-chip status-chip--muted">{row.processing_status}</span><h3>{row.file_name ?? row.storage_path.split("/").at(-1)}</h3></div>
          <code>{row.media_type}</code>
        </header>
        <dl className="asset-library__metadata">
          <div><dt>Size</dt><dd>{formatBytes(row.file_size_bytes)}</dd></div>
          <div><dt>Uploaded</dt><dd>{formatDate(row.created_at)}</dd></div>
          <div><dt>Uploaded by</dt><dd>{row.uploaded_by === userId ? "You" : row.uploaded_by ? row.uploaded_by.slice(0, 8) : "Legacy record"}</dd></div>
          <div><dt>Duration</dt><dd>{row.duration_seconds ? `${row.duration_seconds}s` : "—"}</dd></div>
        </dl>
        <div className="asset-library__preview">
          {row.preview_url && row.media_type.startsWith("image/") ? <img src={row.preview_url} alt={row.file_name ?? "Private question image"} />
            : row.preview_url && row.media_type.startsWith("audio/") ? <audio controls preload="metadata" src={row.preview_url}>Audio playback is not supported in this browser.</audio>
            : <p>Private preview is unavailable for this file type.</p>}
          {row.preview_url ? <a className="text-link" href={row.preview_url} download={row.file_name ?? undefined}>Download original</a> : null}
        </div>
        <div className="asset-library__links"><strong>Linked questions</strong>{row.questions.length ? <ul>{row.questions.map((question) => <li key={`${question.id}:${question.purpose}`}><Link className="text-link" href={`/admin/questions/${question.id}`}>{question.level} · {question.section} · {question.id.slice(0, 8)}</Link><span>{question.status.replaceAll("_", " ")} · {question.purpose.replaceAll("_", " ")}</span>{question.status === "draft" && (isAdmin || question.authored_by === userId) ? <button className="text-link" type="button" disabled={busyId === row.id} onClick={() => void unlink(row, question)}>Unlink</button> : null}</li>)}</ul> : <p>No question links.</p>}</div>
        <div className="asset-library__links"><strong>Linked exams</strong>{row.exams.length ? <ul>{row.exams.map((exam) => <li key={`${exam.form_code}:${exam.status}`}><span>{exam.form_code}</span><span>{exam.status}</span></li>)}</ul> : <p>No exam forms reference this file.</p>}</div>
        {canManageRow(row) || canLinkRow(row) ? <div className="asset-library__actions">
          {canLinkRow(row) && draftQuestions.length && row.status !== "retired" ? <div className="asset-library__link-form"><label>Link to a draft question<select value={linkTargets[row.id] ?? ""} onChange={(event) => setLinkTargets((values) => ({ ...values, [row.id]: event.target.value }))}><option value="">Choose question</option>{draftQuestions.filter((question) => !row.questions.some((linked) => linked.id === question.id && linked.purpose === (linkPurposes[row.id] ?? (row.media_type.startsWith("audio/") ? "question_audio" : "question_image")))).map((question) => <option key={question.id} value={question.id}>{question.level} · {question.section} · {question.id.slice(0, 8)}</option>)}</select></label><label>Purpose<select value={linkPurposes[row.id] ?? (row.media_type.startsWith("audio/") ? "question_audio" : "question_image")} onChange={(event) => setLinkPurposes((values) => ({ ...values, [row.id]: event.target.value }))}>{row.media_type.startsWith("audio/") ? <><option value="question_audio">Question audio</option><option value="stimulus_audio">Shared stimulus audio</option></> : <><option value="question_image">Question image</option><option value="stimulus_image">Shared stimulus image</option></>}</select></label><button className="btn btn--secondary" type="button" disabled={busyId === row.id || !linkTargets[row.id]} onClick={() => void linkToDraft(row)}>{busyId === row.id ? "Linking…" : "Link file"}</button></div> : null}
          {canManageRow(row) ? <>
          {row.status === "draft" ? <>
            <button className="btn btn--secondary" type="button" disabled={busyId === row.id} onClick={() => { setEditingId(editingId === row.id ? "" : row.id); setFileNames((values) => ({ ...values, [row.id]: row.file_name ?? "" })); }}>Edit details</button>
            <button className="btn btn--secondary" type="button" disabled={busyId === row.id} onClick={() => inputRefs.current[row.id]?.click()}>Replace draft file</button>
            <input ref={(node) => { inputRefs.current[row.id] = node; }} className="sr-only" aria-label={`Choose a replacement for ${row.file_name ?? "question file"}`} type="file" accept="audio/*,image/jpeg,image/png,image/webp" disabled={busyId === row.id} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; void replaceFile(row, file); }} />
          </> : null}
          {row.questions.length === 0 && ["draft", "retired"].includes(row.status) ? <button className="btn btn--secondary" type="button" disabled={busyId === row.id} onClick={() => void deleteUnusedFile(row)}>{busyId === row.id ? "Removing…" : row.status === "retired" ? "Retry file removal" : "Delete unused file"}</button> : null}
          </> : null}
        </div> : null}
        {editingId === row.id ? <div className="asset-library__edit"><label>Display filename<input maxLength={240} value={fileNames[row.id] ?? ""} onChange={(event) => setFileNames((values) => ({ ...values, [row.id]: event.target.value }))} /></label><button className="btn btn--primary" type="button" disabled={busyId === row.id} onClick={() => void saveFileName(row)}>{busyId === row.id ? "Saving…" : "Save file details"}</button></div> : null}
        {row.status !== "draft" ? <p className="section-note">Reviewed media is immutable. Replace it by creating a new question revision and uploading a new asset.</p> : null}
      </article>
    ))}
  </div>;
}
