import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LocalizedText } from "@/components/i18n/localized-text";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { PaymentHistoryTable } from "@/components/payment-access-records";
import { requireSignedInUser } from "@/lib/auth";
import { isLocalDemoEnvironment } from "@/lib/local-demo";

export const metadata = { title: "Payment history · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function PaymentHistoryPage() {
  const demoMode = isLocalDemoEnvironment();
  const { supabase, user } = await requireSignedInUser("/payments");
  if (!supabase || !user) {
    return (
      <ProductPage eyebrow="Learner workspace" title="Payment history" description="Sign in to view payment records connected to your account." eyebrowKey="payments.eyebrow" titleKey="payments.title" descriptionKey="payments.signInDescription">
        <ProductSection title="Account access" titleKey="payments.signInTitle">
          <PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fpayments"><LocalizedText messageKey="payments.signIn" /></Link></PaperPanel>
        </ProductSection>
      </ProductPage>
    );
  }

  const [{ data: payments, error }, { data: profile }] = await Promise.all([
    supabase.from("payment_submissions").select("id,provider,payment_method,amount,currency,status,submitted_at,plan_snapshot,cancellation_requested_at,cancelled_at,transaction_reference,receipt_uploaded_at").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(50),
    supabase.from("profiles").select("preferred_timezone").eq("user_id", user.id).maybeSingle(),
  ]);
  const timeZone = profile?.preferred_timezone || "UTC";

  return (
    <ProductPage eyebrow="Learner workspace" title="Payment history" description="Review payment requests already associated with your account." eyebrowKey="payments.eyebrow" titleKey="payments.title" descriptionKey="payments.description" className="product-page--dashboard">
      <ProductSection title="Your payment requests" titleKey="payments.section" className="product-section--tint">
        <PaperPanel className="data-panel">
          {error ? <p className="inline-notice"><LocalizedText messageKey="payments.unavailable" /></p> : payments?.length ? <PaymentHistoryTable payments={payments} timeZone={timeZone} /> : <div className="empty-state"><p><LocalizedText messageKey="payments.empty" /></p><Link className="text-link" href="/upgrade/bkash"><LocalizedText messageKey="payment.viewOptions" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}
          <p className="data-footnote"><LocalizedText messageKey={demoMode ? "payments.demoWarning" : "payments.placeholderWarning"} /></p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
