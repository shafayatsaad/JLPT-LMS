import Link from "next/link";
import { notFound } from "next/navigation";
import { SupportReplyForm } from "@/components/support-forms";
import { SupportThread, type SupportMessage } from "@/components/support-thread";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Support request · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function SupportTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const { supabase, user } = await requireSignedInUser(`/support/${ticketId}`);
  if (!supabase || !user) {
    return <ProductPage eyebrow="Support request" title="Sign in to view this request" description="Support conversations are private to the account that opened them."><ProductSection title="Sign in required"><PaperPanel><Link className="btn btn--primary" href={`/auth/login?next=${encodeURIComponent(`/support/${ticketId}`)}`}>Continue to sign in</Link></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .select("id,category,subject,status,created_at,updated_at")
    .eq("id", ticketId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ticket && !ticketError) notFound();

  const { data: messages, error: messagesError } = ticket
    ? await supabase.from("support_messages").select("id,sender_side,body,is_internal,created_at").eq("ticket_id", ticket.id).order("created_at", { ascending: true })
    : { data: null, error: null };

  return (
    <ProductPage eyebrow="Learner support" title={ticket?.subject ?? "Support request"} description="Your conversation is visible only to you and authorized support staff." className="product-page--dashboard">
      <ProductSection title="Request details" className="product-section--tint">
        <PaperPanel className="data-panel">
          {ticketError || messagesError ? <p className="inline-notice">The support request could not be loaded. If this is a new setup, apply migration 005.</p> : ticket ? (
            <>
              <div className="support-ticket-meta"><span className="status-chip">{ticket.status.replaceAll("_", " ")}</span><span>{ticket.category.replaceAll("_", " ")}</span><time dateTime={ticket.created_at}>Opened {new Date(ticket.created_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</time></div>
              <SupportThread messages={(messages ?? []) as SupportMessage[]} />
              <SupportReplyForm ticketId={ticket.id} />
            </>
          ) : <p className="inline-notice">This request is unavailable or the support tables are not installed yet.</p>}
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Support navigation" className="product-section--compact"><Link className="text-link" href="/support">Back to support requests</Link></ProductSection>
    </ProductPage>
  );
}
