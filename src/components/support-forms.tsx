"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const categories = [
  ["account", "Account"],
  ["payment", "Payment"],
  ["exam_issue", "Exam issue"],
  ["content_issue", "Question or content issue"],
  ["technical_issue", "Technical issue"],
  ["other", "Other"],
];

export function NewSupportTicketForm() {
  const router = useRouter();
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
      setError("Support is unavailable until Supabase is configured.");
      setBusy(false);
      return;
    }

    const { data, error: requestError } = await supabase.rpc("create_support_ticket", {
      p_category: category,
      p_subject: subject,
      p_body: body,
    });
    if (requestError || !data) {
      setError(requestError?.message ?? "The request could not be created. Try again.");
      setBusy(false);
      return;
    }
    router.push(`/support/${data}`);
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>Category
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Subject
        <input required minLength={5} maxLength={120} value={subject} onChange={(event) => setSubject(event.target.value)} />
      </label>
      <label>What do you need help with?
        <textarea required minLength={10} maxLength={5000} rows={6} value={body} onChange={(event) => setBody(event.target.value)} />
        <span className="field-hint">Do not include passwords, one-time codes, wallet PINs, or account credentials.</span>
      </label>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      <button className="btn btn--primary auth-submit" disabled={busy}>{busy ? "Sending…" : "Send support request"}</button>
    </form>
  );
}

export function SupportReplyForm({ ticketId, staff = false }: { ticketId: string; staff?: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
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
      setError("Support is unavailable until Supabase is configured.");
      setBusy(false);
      return;
    }

    const { error: requestError } = await supabase.rpc("reply_support_ticket", {
      p_ticket_id: ticketId,
      p_body: body,
    });
    if (requestError) {
      setError(requestError.message);
      setBusy(false);
      return;
    }
    setBody("");
    setMessage("Reply sent.");
    setBusy(false);
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>{staff ? "Reply to learner" : "Add a reply"}
        <textarea required maxLength={5000} rows={5} value={body} onChange={(event) => setBody(event.target.value)} />
      </label>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
      <button className="btn btn--primary auth-submit" disabled={busy}>{busy ? "Sending…" : "Send reply"}</button>
    </form>
  );
}

export function SupportStatusForm({ ticketId, status }: { ticketId: string; status: string }) {
  const router = useRouter();
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
      setError("Support is unavailable until Supabase is configured.");
      setBusy(false);
      return;
    }

    const { error: requestError } = await supabase.rpc("set_support_ticket_status", {
      p_ticket_id: ticketId,
      p_status: nextStatus,
      p_note: note || null,
    });
    if (requestError) {
      setError(requestError.message);
      setBusy(false);
      return;
    }
    setNote("");
    setMessage("Ticket status updated.");
    setBusy(false);
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>Ticket status
        <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
          {[["open", "Open"], ["in_progress", "In progress"], ["waiting_for_student", "Waiting for learner"], ["resolved", "Resolved"], ["closed", "Closed"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>Internal status note <span className="field-optional">Optional</span>
        <textarea maxLength={1000} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        <span className="field-hint">Keep credentials, one-time codes, and wallet PINs out of staff notes.</span>
      </label>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {message ? <p className="form-message form-message--success" role="status">{message}</p> : null}
      <button className="btn btn--secondary auth-submit" disabled={busy}>{busy ? "Saving…" : "Save status"}</button>
    </form>
  );
}
