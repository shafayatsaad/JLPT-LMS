"use client";

import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import type { MessageKey } from "@/lib/i18n";

const categoryKeys: Record<string, MessageKey> = {
  account: "support.category.account",
  payment: "support.category.payment",
  exam_issue: "support.category.exam_issue",
  content_issue: "support.category.content_issue",
  technical_issue: "support.category.technical_issue",
  other: "support.category.other",
};

const statusKeys: Record<string, MessageKey> = {
  open: "support.status.open",
  in_progress: "support.status.in_progress",
  waiting_for_student: "support.status.waiting_for_student",
  resolved: "support.status.resolved",
  closed: "support.status.closed",
};

function label(value: string, keys: Record<string, MessageKey>, t: (key: MessageKey) => string) {
  const key = keys[value];
  return key ? t(key) : value.replaceAll("_", " ");
}

type SupportTicketSummary = {
  id: string;
  category: string;
  subject: string;
  status: string;
  last_message_at: string;
};

export function SupportRequestList({ tickets }: { tickets: SupportTicketSummary[] }) {
  const { language, t } = useLocale();
  const locale = language === "bn" ? "bn-BD" : "en";

  return (
    <ul className="record-list support-ticket-list">
      {tickets.map((ticket) => (
        <li key={ticket.id}>
          <span>
            <Link className="text-link" href={`/support/${ticket.id}`}>{ticket.subject}</Link>
            <small>{label(ticket.category, categoryKeys, t)} · {t("support.updated")} {new Date(ticket.last_message_at).toLocaleDateString(locale, { dateStyle: "medium" })}</small>
          </span>
          <span className="status-chip">{label(ticket.status, statusKeys, t)}</span>
        </li>
      ))}
    </ul>
  );
}

export function SupportTicketMeta({ status, category, createdAt }: { status: string; category: string; createdAt: string }) {
  const { language, t } = useLocale();
  const locale = language === "bn" ? "bn-BD" : "en";

  return (
    <div className="support-ticket-meta">
      <span className="status-chip">{label(status, statusKeys, t)}</span>
      <span>{label(category, categoryKeys, t)}</span>
      <time dateTime={createdAt}>{t("support.opened")} {new Date(createdAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</time>
    </div>
  );
}
