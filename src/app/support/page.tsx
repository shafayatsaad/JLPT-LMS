import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LocalizedText } from "@/components/i18n/localized-text";
import { NewSupportTicketForm } from "@/components/support-forms";
import { SupportRequestList } from "@/components/support-ui";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Support center · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const { supabase, user } = await requireSignedInUser("/support");
  if (!supabase || !user) {
    return <ProductPage eyebrow="" eyebrowKey="support.eyebrow" title="" titleKey="support.signInTitle" description="" descriptionKey="support.signInDescription"><ProductSection title="" titleKey="support.signInRequired"><PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fsupport"><LocalizedText messageKey="support.continueSignIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: tickets, error } = await supabase
    .from("support_tickets")
    .select("id,category,subject,status,created_at,updated_at,last_message_at")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(50);

  return (
    <ProductPage eyebrow="" eyebrowKey="support.eyebrow" title="" titleKey="support.centerTitle" description="" descriptionKey="support.centerDescription" className="product-page--dashboard">
      <ProductSection title="" titleKey="support.requestsTitle" className="product-section--tint">
        <PaperPanel className="data-panel">
          {error ? <p className="inline-notice"><LocalizedText messageKey="support.requestsUnavailable" /></p> : tickets?.length ? <SupportRequestList tickets={tickets} /> : <div className="empty-state"><p><LocalizedText messageKey="support.noRequests" /></p></div>}
        </PaperPanel>
      </ProductSection>
      <ProductSection title="" titleKey="support.contactTitle">
        <PaperPanel className="auth-panel">
          <p className="section-note"><LocalizedText messageKey="support.formNote" /></p>
          {error ? null : <NewSupportTicketForm />}
        </PaperPanel>
      </ProductSection>
      <ProductSection title="" titleKey="support.backToLearning" className="product-section--compact"><Link className="text-link" href="/dashboard"><LocalizedText messageKey="support.returnDashboard" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></ProductSection>
    </ProductPage>
  );
}
