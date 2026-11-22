import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { NewSupportTicketForm } from "@/components/support-forms";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Support center · JLPT practice" };
export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replaceAll("_", " ");
}

export default async function SupportPage() {
  const { supabase, user } = await requireSignedInUser("/support");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Support center" title="Get help with your account" description="Sign in to open a request and view replies from the support team."><ProductSection title="Sign in required"><PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fsupport">Continue to sign in</Link></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select("id,category,subject,status,created_at,updated_at,last_message_at")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(50);

  return (
    <ProductPage eyebrow="Learner support" title="Support center" description="Open a private request and keep the conversation with the support team in one place." className="product-page--dashboard">
      <ProductSection title="Your requests" className="product-section--tint">
        <PaperPanel className="data-panel">
          {error ? <p className="inline-notice">Support tables are not available yet. Apply migration 005 from the Supabase setup guide.</p> : tickets?.length ? (
            <ul className="record-list support-ticket-list">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <span><Link className="text-link" href={`/support/${ticket.id}`}>{ticket.subject}</Link><small>{label(ticket.category)} · Updated {new Date(ticket.last_message_at).toLocaleDateString("en", { dateStyle: "medium" })}</small></span>
                  <span className="status-chip">{label(ticket.status)}</span>
                </li>
              ))}
            </ul>
          ) : <div className="empty-state"><p>You haven’t opened a support request.</p></div>}
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Contact support">
        <PaperPanel className="auth-panel">
          <p className="section-note">Choose a category and describe the issue. Never send a password, one-time code, bKash PIN, or other login credential.</p>
          {error ? null : <NewSupportTicketForm />}
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Back to your learning space" className="product-section--compact"><Link className="text-link" href="/dashboard">Return to dashboard <ArrowUpRight size={15} aria-hidden="true" /></Link></ProductSection>
    </ProductPage>
  );
}
