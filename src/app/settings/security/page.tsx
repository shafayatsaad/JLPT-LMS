import Link from "next/link";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { SignOutButton } from "@/components/sign-out-button";
import { RevokeOtherSessionsButton } from "@/components/security-session-controls";
import { requireSignedInUser } from "@/lib/auth";
import { LocalizedText } from "@/components/i18n/localized-text";
import { LearnerMfa } from "@/components/learner-mfa";

export const metadata = { title: "Sign-in and security · JLPT practice" };

export default async function SecuritySettingsPage() {
  const { user } = await requireSignedInUser("/settings/security");
  if (!user) return <ProductPage eyebrow="Account settings" title="Sign-in and security" titleKey="security.title" description="Connect Supabase and sign in to review your account security." descriptionKey="security.description"><ProductSection title="Account access" titleKey="settings.title"><PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fsettings%2Fsecurity"><LocalizedText messageKey="settings.signIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  return (
    <ProductPage eyebrow="Account settings" title="Sign-in and security" titleKey="security.title" description="Review your sign-in identity and use the configured Supabase recovery flow." descriptionKey="security.description" className="product-page--dashboard">
      <ProductSection title="Account identity" titleKey="security.accountIdentity" className="product-section--tint">
        <PaperPanel className="data-panel"><div className="security-row"><span><strong><LocalizedText messageKey="security.primarySignIn" /></strong><br />{user.email ?? user.phone ?? <LocalizedText messageKey="security.connectedIdentity" />}</span><span><LocalizedText messageKey={user.email_confirmed_at ? "security.emailConfirmed" : "security.confirmationPending"} /></span></div><div className="security-row"><span><strong><LocalizedText messageKey="security.provider" /></strong><br />{(user.app_metadata?.providers as string[] | undefined)?.join(", ") || user.app_metadata?.provider || "Email"}</span><span>Supabase Auth</span></div><p className="section-note"><LocalizedText messageKey="security.smsPending" /></p><div className="product-cta-row"><Link className="btn btn--secondary" href="/auth/forgot-password"><LocalizedText messageKey="security.resetPassword" /></Link><SignOutButton /></div></PaperPanel>
      </ProductSection>
      <ProductSection title="security.sessionsTitle" titleKey="security.sessionsTitle">
        <PaperPanel className="data-panel"><RevokeOtherSessionsButton /></PaperPanel>
      </ProductSection>
      <ProductSection title="Authenticator protection" className="product-section--tint">
        <PaperPanel className="data-panel"><LearnerMfa variant="settings" /></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
