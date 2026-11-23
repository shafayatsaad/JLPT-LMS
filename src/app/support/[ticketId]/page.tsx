import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalizedText } from "@/components/i18n/localized-text";
import { SupportReplyForm } from "@/components/support-forms";
import { SupportThread, type SupportMessage } from "@/components/support-thread";
import { SupportTicketMeta } from "@/components/support-ui";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Support request · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function SupportTicketPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = await params;
  const { supabase, user } = await requireSignedInUser(`/support/${ticketId}`);
  if (!supabase || !user) {
    return <ProductPage eyebrow="" eyebrowKey="support.eyebrow" title="" titleKey="support.signInTitle" description="" descriptionKey="support.signInDescription"><ProductSection title="" titleKey="support.signInRequired"><PaperPanel><Link className="btn btn--primary" href={`/auth/login?next=${encodeURIComponent(`/support/${ticketId}`)}`}><LocalizedText messageKey="support.continueSignIn" /></Link></PaperPanel></ProductSection></ProductPage>;
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
  const { data: attachments, error: attachmentsError } = ticket
    ? await supabase.from("support_attachments").select("message_id").eq("ticket_id", ticket.id).eq("status", "attached")
    : { data: [], error: null };
  const supportAttachmentReady = !attachmentsError && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const attachedMessageIds = new Set((attachments ?? []).map((attachment) => attachment.message_id));

  return (
    <ProductPage eyebrow="" eyebrowKey="support.eyebrow" title={ticket?.subject ?? "Support request"} description="" descriptionKey="support.requestDescription" className="product-page--dashboard">
      <ProductSection title="" titleKey="support.requestDetails" className="product-section--tint">
        <PaperPanel className="data-panel">
          {ticketError || messagesError ? <p className="inline-notice"><LocalizedText messageKey="support.loadError" /></p> : ticket ? (
            <>
              <SupportTicketMeta status={ticket.status} category={ticket.category} createdAt={ticket.created_at} />
              {!supportAttachmentReady ? <p className="inline-notice"><LocalizedText messageKey="support.attachmentsUnavailable" /></p> : null}
              <SupportThread messages={(messages ?? []).map((message) => ({ ...message, attachment_available: attachedMessageIds.has(message.id) })) as SupportMessage[]} />
              <SupportReplyForm ticketId={ticket.id} attachmentsEnabled={supportAttachmentReady} />
            </>
          ) : <p className="inline-notice"><LocalizedText messageKey="support.unavailable" /></p>}
        </PaperPanel>
      </ProductSection>
      <ProductSection title="" titleKey="support.navigation" className="product-section--compact"><Link className="text-link" href="/support"><LocalizedText messageKey="support.backToRequests" /></Link></ProductSection>
    </ProductPage>
  );
}
