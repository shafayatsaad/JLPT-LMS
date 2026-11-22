"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type NotificationItem = {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

function safeHref(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : null;
}

export function NotificationInbox({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const unreadCount = items.filter((item) => !item.read_at).length;

  async function markAllRead() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Notifications are unavailable until Supabase is configured.");
    setBusy(true);
    setError("");
    const { error: requestError } = await supabase.rpc("mark_all_notifications_read");
    if (requestError) setError(requestError.message);
    else router.refresh();
    setBusy(false);
  }

  async function markRead(id: string) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Notifications are unavailable until Supabase is configured.");
    setBusy(true);
    setError("");
    const { error: requestError } = await supabase.rpc("mark_notification_read", { p_notification_id: id });
    if (requestError) setError(requestError.message);
    else router.refresh();
    setBusy(false);
  }

  return (
    <div className="notification-inbox">
      <div className="notification-inbox__toolbar">
        <p>{unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "You’re up to date."}</p>
        <button className="btn btn--secondary" type="button" disabled={busy || unreadCount === 0} onClick={() => void markAllRead()}>{busy ? "Saving…" : "Mark all as read"}</button>
      </div>
      {error ? <p className="form-message form-message--error" role="alert">{error}</p> : null}
      {items.length ? (
        <ul className="notification-list">
          {items.map((item) => (
            <li className={`notification-card ${item.read_at ? "" : "notification-card--unread"}`} key={item.id}>
              <div className="notification-card__content">
                <div className="support-thread__meta"><strong>{item.title}</strong><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</time></div>
                <p>{item.body}</p>
                {safeHref(item.href) ? <Link className="text-link" href={safeHref(item.href)!}>Open related page</Link> : null}
              </div>
              {!item.read_at ? <button type="button" className="auth-quiet-action" disabled={busy} onClick={() => void markRead(item.id)}>Mark read</button> : null}
            </li>
          ))}
        </ul>
      ) : <div className="empty-state"><p>No notifications yet. Account, exam, payment, and support updates will appear here.</p></div>}
    </div>
  );
}
