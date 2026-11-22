export type SupportMessage = {
  id: string;
  sender_side: "student" | "staff";
  body: string;
  is_internal: boolean;
  created_at: string;
};

export function SupportThread({ messages, staffView = false }: { messages: SupportMessage[]; staffView?: boolean }) {
  if (!messages.length) return <div className="empty-state"><p>No replies yet.</p></div>;

  return (
    <ol className="support-thread">
      {messages.filter((message) => staffView || !message.is_internal).map((message) => (
        <li className={`support-thread__message ${message.sender_side === "staff" ? "support-thread__message--staff" : ""}`} key={message.id}>
          <div className="support-thread__meta">
            <strong>{message.is_internal ? "Internal staff note" : message.sender_side === "staff" ? "Support team" : "You"}</strong>
            <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</time>
          </div>
          <p>{message.body}</p>
        </li>
      ))}
    </ol>
  );
}
