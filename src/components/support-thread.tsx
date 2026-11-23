import { useLocale } from "@/components/i18n/locale-provider";

export type SupportMessage = {
  id: string;
  sender_side: "student" | "staff";
  body: string;
  is_internal: boolean;
  created_at: string;
  attachment_available?: boolean;
};

export function SupportThread({ messages, staffView = false }: { messages: SupportMessage[]; staffView?: boolean }) {
  const { language, t } = useLocale();
  const locale = language === "bn" ? "bn-BD" : "en";
  if (!messages.length) return <div className="empty-state"><p>{t("support.noReplies")}</p></div>;

  return (
    <ol className="support-thread">
      {messages.filter((message) => staffView || !message.is_internal).map((message) => (
        <li className={`support-thread__message ${message.sender_side === "staff" ? "support-thread__message--staff" : ""}`} key={message.id}>
          <div className="support-thread__meta">
            <strong>{message.is_internal ? t("support.internalNote") : message.sender_side === "staff" ? t("support.team") : t("support.you")}</strong>
            <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</time>
          </div>
          <p>{message.body}</p>
          {message.attachment_available ? <a className="support-thread__attachment" href={`/api/support/messages/${message.id}/attachment`} target="_blank" rel="noreferrer">{t("support.viewAttachment")}</a> : null}
        </li>
      ))}
    </ol>
  );
}
