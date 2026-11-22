import Link from "next/link";
import { notFound } from "next/navigation";
import { SupportReplyForm, SupportStatusForm } from "@/components/support-forms";
import { SupportThread, type SupportMessage } from "@/components/support-thread";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: "Support request · Staff · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function AdminSupportTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const { supabase } = await requireStaff(["support_agent", "admin"], `/admin/support/${ticketId}`);
  if (!supabase) {
    return <ProductPage eyebrow="Staff support" title="Support request unavailable" description="Connect Supabase to review learner requests."><ProductSection title="Setup required"><PaperPanel><p>Apply the platform and support migrations, then sign in with an authorized staff account.</p></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id,user_id,category,subject,status,created_at,updated_at")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket && !ticketError) notFound();

  const [{ data: messages, error: messagesError }, { data: audit }] = ticket
    ? await Promise.all([
        supabase.from("support_messages").select("id,sender_side,body,is_internal,created_at").eq("ticket_id", ticket.id).order("created_at", { ascending: true }),
        supabase.from("support_audit_events").select("id,action,details,created_at").eq("ticket_id", ticket.id).order("created_at", { ascending: false }).limit(30),
      ])
    : [{ data: null, error: null }, { data: null }];

  return (
    <ProductPage eyebrow="Staff support" title={ticket?.subject ?? "Support request"} description="Reply to the learner and record status changes. Private staff notes remain separate from the learner conversation." className="product-page--dashboard">
      <ProductSection title="Learner conversation" className="product-section--tint">
        <PaperPanel className="data-panel">
          {ticketError || messagesError ? <p className="inline-notice">The request could not be loaded. Confirm migration 005 is applied.</p> : ticket ? (
            <>
              <div className="support-ticket-meta"><span className="status-chip">{ticket.status.replaceAll("_", " ")}</span><span>{ticket.category.replaceAll("_", " ")}</span><span>Account {ticket.user_id.slice(0, 8)}</span><time dateTime={ticket.created_at}>Opened {new Date(ticket.created_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</time></div>
              <SupportThread messages={(messages ?? []) as SupportMessage[]} staffView />
              <SupportReplyForm ticketId={ticket.id} staff />
            </>
          ) : <p className="inline-notice">This request is unavailable or the support tables are not installed yet.</p>}
        </PaperPanel>
      </ProductSection>
      {ticket ? <ProductSection title="Status and audit" className="product-section--tint"><div className="dashboard-grid dashboard-grid--two"><PaperPanel className="auth-panel"><SupportStatusForm ticketId={ticket.id} status={ticket.status} /></PaperPanel><PaperPanel className="data-panel"><h3>Recent staff actions</h3>{audit?.length ? <ul className="record-list">{audit.map((event) => <li key={event.id}><span>{event.action.replaceAll("_", " ")}</span><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</time></li>)}</ul> : <p>No staff actions recorded.</p>}</PaperPanel></div></ProductSection> : null}
      <ProductSection title="Queue" className="product-section--compact"><Link className="text-link" href="/admin/support">Back to support queue</Link></ProductSection>
    </ProductPage>
  );
}
