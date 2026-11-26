"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { createClientUuid } from "@/lib/client-uuid";

export type DemoSourcePacketRow = {
  id: string;
  title: string;
  level: string;
  release_label: string;
  source_kind: string;
  pdf_file_name: string;
  pdf_bytes: number;
  audio_file_name: string | null;
  audio_bytes: number | null;
  rights_status: string;
  rights_notes: string;
  created_at: string;
  pdf_url: string | null;
  audio_url: string | null;
};

const maxPdfBytes = 100 * 1024 * 1024;
const maxAudioBytes = 50 * 1024 * 1024;
const audioTypes: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", mp4: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", wav: "audio/wav", webm: "audio/webm" };

export function DemoSourcePacketManager({ packets, canUpload = true, canArchive = false }: { packets: DemoSourcePacketRow[]; canUpload?: boolean; canArchive?: boolean }) {
  const router = useRouter();
  const folderRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("N5");
  const [releaseLabel, setReleaseLabel] = useState("");
  const [sourceKind, setSourceKind] = useState("practice_paper");
  const [rightsStatus, setRightsStatus] = useState("unconfirmed");
  const [rightsNotes, setRightsNotes] = useState("Owner-provided file for the private local demo; rights for public redistribution are unconfirmed.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { folderRef.current?.setAttribute("webkitdirectory", ""); }, []);

  function selectFolder(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const pdfs = files.filter((file) => file.name.toLowerCase().endsWith(".pdf"));
    const audios = files.filter((file) => Boolean(audioTypes[file.name.split(".").pop()?.toLowerCase() ?? ""]));
    setError(""); setMessage("");
    if (pdfs.length !== 1 || audios.length > 1) {
      setSelectedFiles([]);
      setError("Select a source folder containing exactly one PDF and at most one audio file.");
      return;
    }
    setSelectedFiles([pdfs[0], ...audios]);
    const folder = (pdfs[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split("/")[0] ?? "";
    if (!title && folder) setTitle(folder.replaceAll("_", " ").replaceAll("-", " "));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const pdf = selectedFiles.find((file) => file.name.toLowerCase().endsWith(".pdf"));
    const audio = selectedFiles.find((file) => file !== pdf);
    if (!pdf) return setError("Choose a source folder first.");
    if (pdf.size < 1 || pdf.size > maxPdfBytes) return setError("The PDF must be no larger than 100 MB.");
    if (audio && (audio.size < 1 || audio.size > maxAudioBytes)) return setError("The audio file must be no larger than 50 MB.");
    if (rightsNotes.trim().length < 10) return setError("Add a note about the source rights and intended local use.");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Supabase is not configured in this browser session.");
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return setError("Sign in again before uploading source material.");

    setBusy(true);
    const packetKey = createClientUuid();
    const uploads: { path: string; file: File; type: string }[] = [
      { path: `${user.id}/${packetKey}/${createClientUuid()}-${pdf.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120)}`, file: pdf, type: "application/pdf" },
      ...(audio ? [{ path: `${user.id}/${packetKey}/${createClientUuid()}-${audio.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120)}`, file: audio, type: audioTypes[audio.name.split(".").pop()?.toLowerCase() ?? ""] }] : []),
    ];
    const uploaded: string[] = [];
    try {
      for (const item of uploads) {
        const { error: uploadError } = await supabase.storage.from("jlpt-demo-source-materials").upload(item.path, item.file, { contentType: item.type, cacheControl: "3600", upsert: false });
        if (uploadError) throw new Error(`Could not upload ${item.file.name}: ${uploadError.message}`);
        uploaded.push(item.path);
      }
      const audioItem = uploads[1];
      const { error: packetError } = await supabase.rpc("create_demo_source_packet", {
        p_title: title.trim(), p_level: level, p_release_label: releaseLabel.trim(), p_source_kind: sourceKind,
        p_pdf_path: uploads[0].path, p_pdf_file_name: pdf.name, p_pdf_bytes: pdf.size,
        p_audio_path: audioItem?.path ?? null, p_audio_file_name: audio?.name ?? null,
        p_audio_media_type: audioItem?.type ?? null, p_audio_bytes: audio?.size ?? null,
        p_rights_status: rightsStatus, p_rights_notes: rightsNotes.trim(),
      });
      if (packetError) throw new Error(packetError.message);
      setMessage("Private demo packet saved. The PDF and audio are available to staff in this project only.");
      setSelectedFiles([]); setTitle(""); setReleaseLabel("");
      if (folderRef.current) folderRef.current.value = "";
      router.refresh();
    } catch (cause) {
      if (uploaded.length) await supabase.storage.from("jlpt-demo-source-materials").remove(uploaded);
      setError(cause instanceof Error ? cause.message : "The source packet could not be saved.");
    } finally { setBusy(false); }
  }

  async function archive(packetId: string) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase || busy) return;
    setBusy(true); setError(""); setMessage("");
    const { error: archiveError } = await supabase.rpc("archive_demo_source_packet", { p_packet_id: packetId });
    if (archiveError) setError(archiveError.message);
    else { setMessage("Source packet archived."); router.refresh(); }
    setBusy(false);
  }

  return <div className="demo-source-manager">
    <p className="workflow-note"><strong>Private source library.</strong> Upload one folder at a time. Each folder must contain exactly one reference PDF and may contain one matching MP3/M4A/AAC file. These source packets remain separate from question drafts, are never exposed to learners and carry an explicit rights status.</p>
    {canUpload ? <form className="auth-form demo-source-form" onSubmit={(event) => void save(event)}>
      <label>Source folder<input ref={folderRef} type="file" multiple accept="application/pdf,.pdf,audio/*,.m4a,.mp3,.aac" onChange={selectFolder} /></label>
      <p className="field-hint">Selected: {selectedFiles.map((file) => `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`).join(" · ") || "No folder selected"}.</p>
      <div className="question-authoring-form__grid">
        <label>Display title<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>JLPT level<select value={level} onChange={(event) => setLevel(event.target.value)}>{["N1", "N2", "N3", "N4", "N5"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Release / reference label<input required maxLength={100} placeholder="2013年7月" value={releaseLabel} onChange={(event) => setReleaseLabel(event.target.value)} /></label>
        <label>Use<select value={sourceKind} onChange={(event) => setSourceKind(event.target.value)}><option value="practice_paper">Practice paper source</option><option value="layout_reference">Layout reference only</option></select></label>
        <label>Rights status<select value={rightsStatus} onChange={(event) => setRightsStatus(event.target.value)}><option value="unconfirmed">Unconfirmed · private demo only</option><option value="licensed">Licensed</option><option value="permission_granted">Permission granted</option><option value="public_domain">Public domain</option></select></label>
      </div>
      <label>Rights and usage notes<textarea required minLength={10} maxLength={2000} rows={3} value={rightsNotes} onChange={(event) => setRightsNotes(event.target.value)} /></label>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
      <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "Uploading source packet…" : "Upload private demo packet"}</button>
    </form> : <p className="section-note">Source uploads are available to content editors and administrators.</p>}
    <div className="demo-source-list">
      {packets.length ? packets.map((packet) => <article className="paper-panel demo-source-card" key={packet.id}>
        <header><div><span className="status-chip status-chip--muted">{packet.level} · {packet.rights_status.replaceAll("_", " ")}</span><h3>{packet.title}</h3><p>{packet.release_label} · {packet.source_kind.replaceAll("_", " ")}</p></div>{canArchive ? <button className="btn btn--secondary" type="button" disabled={busy} onClick={() => void archive(packet.id)}>Archive</button> : null}</header>
        <div className="demo-source-card__files"><span>{packet.pdf_file_name} · {(Number(packet.pdf_bytes) / 1024 / 1024).toFixed(1)} MB</span>{packet.audio_file_name ? <span>{packet.audio_file_name} · {(Number(packet.audio_bytes) / 1024 / 1024).toFixed(1)} MB</span> : null}</div>
        {packet.pdf_url ? <details><summary>Open paper reference</summary><iframe title={`${packet.title} PDF reference`} src={packet.pdf_url} loading="lazy" /></details> : <p className="section-note">PDF preview URL could not be created.</p>}
        {packet.audio_url ? <audio controls preload="none" src={packet.audio_url}>Audio playback is not supported in this browser.</audio> : null}
        <p className="section-note">Rights note: {packet.rights_notes}</p>
      </article>) : <div className="empty-state"><p>No private source packets have been uploaded yet.</p></div>}
    </div>
  </div>;
}
