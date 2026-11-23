"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type NotificationItem = {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  title_bn?: string | null;
  body_bn?: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
};

export type InAppNotificationPreferences = {
  in_app_exam_updates: boolean;
  in_app_service_announcements: boolean;
};

function safeHref(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : null;
}

function localizedCopy(item: NotificationItem, t: (key: MessageKey, values?: Record<string, string | number>) => string, language: "en" | "bn") {
  if (item.notification_type === "service_announcement") {
    return {
      title: language === "bn" ? item.title_bn || item.title : item.title,
      body: language === "bn" ? item.body_bn || item.body : item.body,
    };
  }
  const copyKeys: Record<string, [MessageKey, MessageKey]> = {
    email_verification: ["notifications.typeVerificationTitle", "notifications.typeVerificationBody"],
    security_notice: ["notifications.typeSecurityTitle", "notifications.typeSecurityBody"],
    payment_submitted: ["notifications.typePaymentSubmittedTitle", "notifications.typePaymentSubmittedBody"],
    payment_approved: ["notifications.typePaymentApprovedTitle", "notifications.typePaymentApprovedBody"],
    payment_rejected: ["notifications.typePaymentRejectedTitle", "notifications.typePaymentRejectedBody"],
    premium_activated: ["notifications.typePremiumActiveTitle", "notifications.typePremiumActiveBody"],
    premium_expiring: ["notifications.typePremiumExpiringTitle", "notifications.typePremiumExpiringBody"],
    premium_expired: ["notifications.typePremiumExpiredTitle", "notifications.typePremiumExpiredBody"],
    exam_published: ["notifications.typeExamPublishedTitle", "notifications.typeExamPublishedBody"],
    exam_updated: ["notifications.typeExamUpdatedTitle", "notifications.typeExamUpdatedBody"],
    attempt_submitted: ["notifications.typeAttemptSubmittedTitle", "notifications.typeAttemptSubmittedBody"],
    result_ready: ["notifications.typeResultReadyTitle", "notifications.typeResultReadyBody"],
    support_reply: ["notifications.typeSupportReplyTitle", "notifications.typeSupportReplyBody"],
    support_update: ["notifications.typeSupportUpdateTitle", "notifications.typeSupportUpdateBody"],
    generic: ["notifications.typeGenericTitle", "notifications.typeGenericBody"],
  };
  const keys = copyKeys[item.notification_type];
  if (!keys) return { title: item.title, body: item.body };

  if (item.notification_type === "support_update") {
    const status = item.body.match(/status is now ([a-z_ ]+)\.?$/i)?.[1]?.trim().replaceAll(" ", "_");
    const statusKey: Record<string, MessageKey> = {
      open: "notifications.statusOpen",
      in_progress: "notifications.statusInProgress",
      waiting_for_student: "notifications.statusWaiting",
      resolved: "notifications.statusResolved",
      closed: "notifications.statusClosed",
    };
    if (status && statusKey[status]) {
      const statusLabel = t(statusKey[status]);
      return { title: t(keys[0]), body: t(keys[1], { status: statusLabel }) };
    }
  }
  return { title: t(keys[0]), body: t(keys[1]) };
}

export function NotificationInbox({
  items,
  preferences,
  timeZone,
}: {
  items: NotificationItem[];
  preferences: InAppNotificationPreferences;
  timeZone: string;
}) {
  const router = useRouter();
  const { t, language } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const visibleItems = items.filter((item) => {
    if (["exam_published", "exam_updated", "attempt_submitted", "result_ready"].includes(item.notification_type) && !preferences.in_app_exam_updates) return false;
    if (item.notification_type === "service_announcement" && !preferences.in_app_service_announcements) return false;
    return true;
  });
  const unreadCount = visibleItems.filter((item) => !item.read_at).length;

  async function markAllRead() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError(true);
    setBusy(true);
    setError(false);
    try {
      const { error: requestError } = await supabase.rpc("mark_all_notifications_read");
      if (requestError) setError(true);
      else router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function markRead(id: string) {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError(true);
    setBusy(true);
    setError(false);
    try {
      const { error: requestError } = await supabase.rpc("mark_notification_read", { p_notification_id: id });
      if (requestError) setError(true);
      else router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notification-inbox">
      <div className="notification-inbox__toolbar">
        <p>{unreadCount ? t("notifications.unreadCount", { count: unreadCount }) : t("notifications.upToDate")}</p>
        <button className="btn btn--secondary" type="button" disabled={busy || unreadCount === 0} onClick={() => void markAllRead()}>{busy ? t("notifications.saving") : t("notifications.markAllRead")}</button>
      </div>
      {error ? <p className="form-message form-message--error" role="alert">{t("notifications.inboxError")}</p> : null}
      {visibleItems.length ? (
        <ul className="notification-list">
          {visibleItems.map((item) => {
            const copy = localizedCopy(item, t, language);
            return <li className={`notification-card ${item.read_at ? "" : "notification-card--unread"}`} key={item.id}>
              <div className="notification-card__content">
                <div className="support-thread__meta"><strong>{copy.title}</strong><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString(language === "bn" ? "bn-BD" : "en", { dateStyle: "medium", timeStyle: "short", timeZone })}</time></div>
                <p>{copy.body}</p>
                {safeHref(item.href) ? <Link className="text-link" href={safeHref(item.href)!}>{t("notifications.openRelated")}</Link> : null}
              </div>
              {!item.read_at ? <button type="button" className="auth-quiet-action" disabled={busy} onClick={() => void markRead(item.id)}>{t("notifications.markRead")}</button> : null}
            </li>;
          })}
        </ul>
      ) : <div className="empty-state"><p>{items.length ? t("notifications.filteredEmpty") : t("notifications.inboxEmpty")}</p></div>}
    </div>
  );
}
