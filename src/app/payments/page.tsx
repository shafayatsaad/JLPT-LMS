import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Payment history · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function PaymentHistoryPage() {
  const { supabase, user } = await requireSignedInUser("/payments");
  if (!supabase || !user) return <ProductPage eyebrow="Learner workspace" title="Payment history" description="Configure Supabase and sign in to view your own payment records."><ProductSection title="Account access"><PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fpayments">Sign in</Link></PaperPanel></ProductSection></ProductPage>;
  const { data: payments, error } = await supabase.from("payment_submissions").select("id,provider,payment_method,amount,currency,status,submitted_at").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(50);

  return (
    <ProductPage eyebrow="Learner workspace" title="Payment history" description="Review payment requests already associated with your account." className="product-page--dashboard">
      <ProductSection title="Your payment requests" className="product-section--tint">
        <PaperPanel className="data-panel">
          {error ? <p className="inline-notice">Payment history is unavailable. Apply the database migrations and confirm the signed-in account has access to its own records.</p> : payments?.length ? <div className="table-scroll"><table><thead><tr><th>Submitted</th><th>Method</th><th>Amount</th><th>Status</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{new Date(payment.submitted_at).toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" })}</td><td>{payment.provider} · {payment.payment_method}</td><td>{payment.currency} {payment.amount}</td><td><span className="status-chip">{payment.status.replaceAll("_", " ")}</span></td></tr>)}</tbody></table></div> : <div className="empty-state"><p>No payment requests are recorded. Checkout is not open yet.</p><Link className="text-link" href="/pricing">View plan preview <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}
          <p className="data-footnote">Do not send money to a placeholder. Verified bKash recipient details and prices have not been supplied.</p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
