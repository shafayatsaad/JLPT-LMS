"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/i18n/locale-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const categories = [
  ["account", "support.category.account"],
  ["payment", "support.category.payment"],
  ["exam_issue", "support.category.exam_issue"],
  ["content_issue", "support.category.content_issue"],
  ["technical_issue", "support.category.technical_issue"],
  ["other", "support.category.other"],
] as const;

const ticketStatuses = [
  ["open", "support.status.open"],
  ["in_progress", "support.status.in_progress"],
  ["waiting_for_student", "support.status.waiting_for_student"],
  ["resolved", "support.status.resolved"],
  ["closed", "support.status.closed"],
] as const;

export function NewSupportTicketForm() {
  const router = useRouter();
  const { t } = useLocale();
  const [category, setCategory] = useState("account");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(t("support.sendError"));
      setBusy(false);
      return;
    }

    const { data, error: requestError } = await supabase.rpc("create_support_ticket", {
      p_category: category,
      p_subject: subject,
      p_body: body,
    });
    if (requestError || !data) {
      setError(t("support.sendError"));
      setBusy(false);
      return;
    }
    router.push(`/support/${data}`);
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>{t("support.category")}
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
        </select>
      </label>
      <label>{t("support.subject")}
        <input required minLength={5} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} />
      </label>
      <label>{t("support.helpPrompt")}
        <textarea required minLength={10} maxLength={5000} rows={6} value={body} onChange={(event) => setBody(event.target.value)} />
        <span className="field-hint">{t("support.credentialHint")}</span>
      </label>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      <button className="btn btn--primary auth-submit" disabled={busy}>{busy ? t("support.sending") : t("support.contactTitle")}</button>
    </form>
  );
}

export function SupportReplyForm({ ticketId, staff = false, attachmentsEnabled = true }: { ticketId: string; staff?: boolean; attachmentsEnabled?: boolean }) {
  const router = useRouter();
  const { t } = useLocale();
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [pendingAttachmentMessageId, setPendingAttachmentMessageId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (attachment && attachment.size > 4 * 1024 * 1024) {
      setError(t("support.attachmentTooLarge"));
      return;
    }
    if (attachment && !["image/png", "image/jpeg", "image/webp"].includes(attachment.type)) {
      setError(t("support.attachmentTypeError"));
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(t("support.replyError"));
      setBusy(false);
      return;
    }

    const { data: messageId, error: requestError } = await supabase.rpc("reply_support_ticket", {
      p_ticket_id: ticketId,
      p_body: body,
    });
    if (requestError) {
      setError(t("support.replyError"));
      setBusy(false);
      return;
    }
    setBody("");
    if (attachment && typeof messageId === "string") {
      const uploadForm = new FormData();
      uploadForm.set("attachment", attachment);
      try {
        const upload = await fetch(`/api/support/messages/${messageId}/attachment`, { method: "POST", body: uploadForm });
        if (!upload.ok) {
          setPendingAttachmentMessageId(messageId);
          setError(t("support.attachmentError"));
          setBusy(false);
          router.refresh();
          return;
        }
        setAttachment(null);
      } catch {
        setPendingAttachmentMessageId(messageId);
        setError(t("support.attachmentError"));
        setBusy(false);
        router.refresh();
        return;
      }
    }
    setMessage(t("support.replySent"));
    setPendingAttachmentMessageId("");
    setBusy(false);
    router.refresh();
  }

  async function retryAttachment() {
    if (!attachment || !pendingAttachmentMessageId) return;
    setBusy(true);
    setError("");
    const uploadForm = new FormData();
    uploadForm.set("attachment", attachment);
    try {
      const upload = await fetch(`/api/support/messages/${pendingAttachmentMessageId}/attachment`, { method: "POST", body: uploadForm });
      if (!upload.ok) {
        setError(t("support.attachmentError"));
        return;
      }
      setAttachment(null);
      setPendingAttachmentMessageId("");
      setMessage(t("support.replySent"));
      router.refresh();
    } catch {
      setError(t("support.attachmentError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>{staff ? t("support.replyLearner") : t("support.addReply")}
        <textarea required maxLength={5000} rows={5} value={body} onChange={(event) => setBody(event.target.value)} />
      </label>
      {attachmentsEnabled ? <label>{t("support.attachmentLabel")} <span className="field-optional">{t("support.optional")}</span>
        <input key={attachment?.name ?? "no-attachment"} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || Boolean(pendingAttachmentMessageId)} onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} />
        <span className="field-hint">{t("support.attachmentHint")}</span>
      </label> : <p className="field-hint">{t("support.attachmentsUnavailable")}</p>}
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
      {pendingAttachmentMessageId ? <div className="support-attachment-retry"><button className="btn btn--secondary" type="button" disabled={busy || !attachment} onClick={() => void retryAttachment()}>{busy ? t("support.sending") : t("support.retryAttachment")}</button><button className="text-button" type="button" disabled={busy} onClick={() => { setAttachment(null); setPendingAttachmentMessageId(""); setError(""); }}>{t("support.discardAttachment")}</button></div> : null}
      <button className="btn btn--primary auth-submit" disabled={busy || Boolean(pendingAttachmentMessageId)}>{busy ? t("support.sending") : t("support.sendReply")}</button>
    </form>
  );
}

export function SupportStatusForm({ ticketId, status }: { ticketId: string; status: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const [nextStatus, setNextStatus] = useState(status);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError(t("support.statusError"));
      setBusy(false);
      return;
    }

    const { error: requestError } = await supabase.rpc("set_support_ticket_status", {
      p_ticket_id: ticketId,
      p_status: nextStatus,
      p_note: note || null,
    });
    if (requestError) {
      setError(t("support.statusError"));
      setBusy(false);
      return;
    }
    setNote("");
    setMessage(t("support.statusUpdated"));
    setBusy(false);
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>{t("support.status")}
        <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
          {ticketStatuses.map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
        </select>
      </label>
      <label>{t("support.internalStatusNote")} <span className="field-optional">{t("support.optional")}</span>
        <textarea maxLength={1000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        <span className="field-hint">{t("support.staffNoteHint")}</span>
      </label>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
      <button className="btn btn--secondary auth-submit" disabled={busy}>{busy ? t("common.saving") : t("support.saveStatus")}</button>
    </form>
  );
}
