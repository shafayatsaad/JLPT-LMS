import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireStaff } from "@/lib/auth";

export const metadata = { title: "Support queue · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function AdminSupportQueuePage() {
  const { supabase } = await requireStaff(["support_agent", "admin"], "/admin/support");
  if (!supabase) {
    return <ProductPage eyebrow="Staff support" title="Support queue unavailable" description="Connect Supabase to view learner requests."><ProductSection title="Setup required"><PaperPanel><p>Apply the platform and support migrations, then sign in with an authorized staff account.</p></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select("id,user_id,category,subject,status,created_at,last_message_at")
    .order("last_message_at", { ascending: true })
    .limit(100);

  return (
    <ProductPage eyebrow="Staff workspace" title="Learner support queue" description="Review learner requests and reply through the private support thread. Staff access is checked by role and row-level security." className="product-page--dashboard">
      <ProductSection title="Support requests" className="product-section--tint">
        <PaperPanel className="data-panel">
          {error ? <p className="inline-notice">The support queue is unavailable. Confirm migration 005 is applied and that this account has the support_agent or admin role.</p> : tickets?.length ? (
            <div className="table-scroll"><table><thead><tr><th>Request</th><th>Category</th><th>Status</th><th>Last update</th><th>Account reference</th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><Link className="text-link" href={`/admin/support/${ticket.id}`}>{ticket.subject}<ArrowUpRight size={14} aria-hidden="true" /></Link></td><td>{ticket.category.replaceAll("_", " ")}</td><td><span className="status-chip">{ticket.status.replaceAll("_", " ")}</span></td><td>{new Date(ticket.last_message_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}</td><td><code>{ticket.user_id.slice(0, 8)}</code></td></tr>)}</tbody></table></div>
          ) : <div className="empty-state"><p>No support requests are waiting.</p></div>}
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Staff navigation" className="product-section--compact"><Link className="text-link" href="/admin">Back to staff overview</Link></ProductSection>
    </ProductPage>
  );
}
