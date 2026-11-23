"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Megaphone } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AdminAnnouncement = {
  id: string;
  title_en: string;
  title_bn: string;
  body_en: string;
  body_bn: string;
  href: string | null;
  status: "draft" | "published";
  created_by: string;
  created_at: string;
  updated_at: string;
  published_by: string | null;
  published_at: string | null;
  recipient_count: number;
};

type Fields = Pick<AdminAnnouncement, "title_en" | "title_bn" | "body_en" | "body_bn" | "href">;

const emptyFields: Fields = { title_en: "", title_bn: "", body_en: "", body_bn: "", href: "" };

function AnnouncementFields({
  initial,
  busy,
  saveLabel,
  onSave,
}: {
  initial: Fields;
  busy: boolean;
  saveLabel: string;
  onSave: (event: FormEvent<HTMLFormElement>, values: Fields) => void;
}) {
  const [values, setValues] = useState<Fields>(initial);
  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }
  return (
    <form className="announcement-form" onSubmit={(event) => onSave(event, values)}>
      <div className="announcement-form__languages">
        <fieldset>
          <legend>English copy</legend>
          <label>Title<input maxLength={120} required value={values.title_en} onChange={(event) => set("title_en", event.target.value)} /></label>
          <label>Message<textarea maxLength={1000} rows={4} required value={values.body_en} onChange={(event) => set("body_en", event.target.value)} /></label>
        </fieldset>
        <fieldset>
          <legend>বাংলা কপি</legend>
          <label>শিরোনাম<input maxLength={120} required value={values.title_bn} onChange={(event) => set("title_bn", event.target.value)} lang="bn" /></label>
          <label>বার্তা<textarea maxLength={1000} rows={4} required value={values.body_bn} onChange={(event) => set("body_bn", event.target.value)} lang="bn" /></label>
        </fieldset>
      </div>
      <label>Optional internal link<input maxLength={300} placeholder="/exams or /support" value={values.href ?? ""} onChange={(event) => set("href", event.target.value)} /></label>
      <button className="btn btn--secondary" type="submit" disabled={busy}>{busy ? "Saving…" : saveLabel}</button>
    </form>
  );
}

export function AnnouncementWorkflow({ announcements }: { announcements: AdminAnnouncement[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(event: FormEvent<HTMLFormElement>, values: Fields, announcementId?: string) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured for this session.");
      return;
    }
    const key = announcementId ?? "new";
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const { data, error: saveError } = announcementId
        ? await supabase.rpc("update_admin_announcement_draft", {
            p_announcement_id: announcementId,
            p_title_en: values.title_en,
            p_title_bn: values.title_bn,
            p_body_en: values.body_en,
            p_body_bn: values.body_bn,
            p_href: values.href?.trim() || null,
          })
        : await supabase.rpc("create_admin_announcement_draft", {
            p_title_en: values.title_en,
            p_title_bn: values.title_bn,
            p_body_en: values.body_en,
            p_body_bn: values.body_bn,
            p_href: values.href?.trim() || null,
          });
      if (saveError || data === false) {
        setError(saveError?.message ?? "The draft could not be saved.");
        return;
      }
      setNotice(announcementId ? "Draft updated." : "Bilingual draft saved.");
      router.refresh();
    } catch {
      setError("The draft could not be saved. Please try again.");
    } finally {
      setBusy("");
    }
  }

  async function publish(id: string) {
    if (!window.confirm("Publish this bilingual announcement to learners who enabled in-app service notices? This cannot be recalled.")) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured for this session.");
      return;
    }
    setBusy(id);
    setError("");
    setNotice("");
    try {
      const { data, error: publishError } = await supabase.rpc("publish_admin_announcement", { p_announcement_id: id });
      if (publishError || typeof data !== "number") {
        setError(publishError?.message ?? "The announcement could not be published.");
        return;
      }
      setNotice(`Announcement published to ${data} learner inbox${data === 1 ? "" : "es"}.`);
      router.refresh();
    } catch {
      setError("The announcement could not be published. Please try again.");
    } finally {
      setBusy("");
    }
  }

  const drafts = announcements.filter((item) => item.status === "draft");
  const published = announcements.filter((item) => item.status === "published");
  return (
    <div className="announcement-workflow">
      <div className="announcement-workflow__notice"><Megaphone aria-hidden="true" /><p>Publishing creates an in-app notice for learners who enabled service announcements. It does not send email. Proofread both language versions before publishing.</p></div>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {notice ? <p className="form-message form-message--success" role="status">{notice}</p> : null}
      <section className="announcement-workflow__section">
        <h2>Create a bilingual draft</h2>
        <AnnouncementFields initial={emptyFields} busy={busy === "new"} saveLabel="Save draft" onSave={(event, values) => void save(event, values)} />
      </section>
      <section className="announcement-workflow__section">
        <h2>Draft queue <span>{drafts.length}</span></h2>
        {drafts.length ? <div className="announcement-workflow__list">{drafts.map((item) => (
          <article className="announcement-record" key={item.id}>
            <div className="announcement-record__heading"><div><span className="status-chip status-chip--muted">Draft</span><h3>{item.title_en || "Untitled announcement"}</h3><p lang="bn">{item.title_bn}</p></div><code>{item.id.slice(0, 8)}</code></div>
            <details><summary>Edit draft</summary><AnnouncementFields initial={item} busy={busy === item.id} saveLabel="Update draft" onSave={(event, values) => void save(event, values, item.id)} /></details>
            <button className="btn btn--primary" type="button" disabled={busy === item.id} onClick={() => void publish(item.id)}>{busy === item.id ? "Publishing…" : "Publish in-app"} <ArrowUpRight size={15} aria-hidden="true" /></button>
          </article>
        ))}</div> : <p className="empty-state">No announcement drafts yet.</p>}
      </section>
      <section className="announcement-workflow__section">
        <h2>Published notices <span>{published.length}</span></h2>
        {published.length ? <ul className="announcement-published-list">{published.map((item) => (
          <li key={item.id}><span><strong>{item.title_en}</strong><small lang="bn">{item.title_bn}</small><small>{item.published_at ? new Date(item.published_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) : "Published"} · {item.recipient_count} recipient notices</small></span><span className="status-chip">Published</span></li>
        ))}</ul> : <p className="empty-state">Published announcements will appear here.</p>}
      </section>
    </div>
  );
}
