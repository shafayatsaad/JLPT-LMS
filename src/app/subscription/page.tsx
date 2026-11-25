import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { EntitlementRecords } from "@/components/payment-access-records";
import { PaymentHistoryTable } from "@/components/payment-access-records";
import { LocalizedText } from "@/components/i18n/localized-text";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";
import { isLocalDemoEnvironment } from "@/lib/local-demo";

export const metadata = { title: "Plans & Payments · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const demoMode = isLocalDemoEnvironment();
  const { supabase, user } = await requireSignedInUser("/subscription");
  if (!supabase || !user) {
    return (
      <ProductPage eyebrow="Learner workspace" title="Plan and access" description="Sign in to view access records connected to your account." eyebrowKey="subscription.eyebrow" titleKey="subscription.title" descriptionKey="subscription.signInDescription">
        <ProductSection title="Account access" titleKey="payments.signInTitle">
          <PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fsubscription"><LocalizedText messageKey="payments.signIn" /></Link></PaperPanel>
        </ProductSection>
      </ProductPage>
    );
  }

  const [{ data: entitlements, error }, { data: payments, error: paymentError }, { data: profile }] = await Promise.all([
    supabase.from("user_entitlements").select("status,starts_at,ends_at,plan_id").eq("user_id", user.id).order("ends_at", { ascending: false }).limit(20),
    supabase.from("payment_submissions").select("id,provider,payment_method,amount,currency,status,submitted_at,plan_snapshot,cancellation_requested_at,cancelled_at,transaction_reference,receipt_uploaded_at").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(50),
    supabase.from("profiles").select("preferred_timezone").eq("user_id", user.id).maybeSingle(),
  ]);
  const timeZone = profile?.preferred_timezone || "UTC";

  return (
    <ProductPage eyebrow="Learner workspace" title="Plan and access" description={demoMode ? "Your local sandbox account includes demo premium access." : "Check access records tied to your account. New premium purchases are not available yet."} eyebrowKey="subscription.eyebrow" titleKey="subscription.title" descriptionKey={demoMode ? "subscription.demoDescription" : "subscription.description"} className="product-page--dashboard">
      <ProductSection title="Recorded access" titleKey="subscription.section" className="product-section--tint">
        <PaperPanel className="data-panel">
          {error ? <p className="inline-notice"><LocalizedText messageKey="subscription.unavailable" /></p> : entitlements?.length ? <EntitlementRecords entitlements={entitlements} timeZone={timeZone} /> : <div className="empty-state"><p><LocalizedText messageKey="subscription.empty" /></p><Link className="text-link" href="/pricing"><LocalizedText messageKey="payments.viewPlans" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Payment history" titleKey="subscription.activity" className="product-section--compact">
        <PaperPanel className="data-panel">
          {paymentError ? <p className="inline-notice"><LocalizedText messageKey="payments.unavailable" /></p> : payments?.length ? <PaymentHistoryTable payments={payments} timeZone={timeZone} /> : <div className="empty-state"><p><LocalizedText messageKey="payments.empty" /></p><Link className="text-link" href="/upgrade/bkash"><LocalizedText messageKey="payment.viewOptions" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}
          <p className="data-footnote"><LocalizedText messageKey={demoMode ? "payments.demoWarning" : "payments.placeholderWarning"} /></p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
