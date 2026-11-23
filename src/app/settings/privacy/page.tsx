import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";
import { LocalizedText } from "@/components/i18n/localized-text";
import { PrivacyDeletionRequest, type AccountDeletionRequestSummary } from "@/components/privacy-deletion-request";

export const metadata = { title: "Privacy requests · JLPT practice" };

export default async function PrivacySettingsPage() {
  const { supabase, user } = await requireSignedInUser("/settings/privacy");
  if (!user) return <ProductPage eyebrow="Account settings" title="Privacy requests" titleKey="privacy.title" description="Connect Supabase and sign in to request help with account data." descriptionKey="privacy.description"><ProductSection title="Account access" titleKey="settings.title"><PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fsettings%2Fprivacy"><LocalizedText messageKey="settings.signIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  const { data: deletionRequest, error: deletionRequestError } = await supabase!.rpc("get_my_account_deletion_request");
  const initialRequest = deletionRequest && typeof deletionRequest === "object" && "id" in deletionRequest
    ? deletionRequest as AccountDeletionRequestSummary
    : null;
  return (
    <ProductPage eyebrow="Account settings" title="Privacy requests" titleKey="privacy.title" description="Download data belonging to your signed-in account or request verified account deletion help." descriptionKey="privacy.description" className="product-page--dashboard">
      <ProductSection title="Download your account data" titleKey="privacy.exportTitle" className="product-section--tint">
        <PaperPanel className="statement-panel"><p><LocalizedText messageKey="privacy.exportDescription" /></p><a className="btn btn--primary" href="/settings/privacy/export"><LocalizedText messageKey="privacy.exportButton" /> <ArrowUpRight size={15} aria-hidden="true" /></a><p className="section-note"><LocalizedText messageKey="privacy.draftPolicy" /></p></PaperPanel>
      </ProductSection>
      <ProductSection title="Request account deletion" titleKey="privacy.deleteTitle">
        <PaperPanel className="statement-panel"><PrivacyDeletionRequest initialRequest={initialRequest} unavailable={Boolean(deletionRequestError)} /></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
