import Link from "next/link";
import { LocalizedText } from "@/components/i18n/localized-text";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";

export const metadata = { title: "Sign-in verification unavailable · JLPT Practice", robots: { index: false, follow: false } };

export default function StepUpUnavailablePage() {
  return <ProductPage eyebrow="Account security" eyebrowKey="auth.stepUp.eyebrow" title="Sign-in verification is not ready" titleKey="auth.stepUpUnavailable.title" description="The account security hook is not active for this environment yet." descriptionKey="auth.stepUpUnavailable.description" className="product-page--auth">
    <ProductSection title="Finish Supabase setup" titleKey="auth.stepUpUnavailable.section" className="product-section--tint">
      <PaperPanel className="auth-panel">
        <p><LocalizedText messageKey="auth.stepUpUnavailable.body" /></p>
        <Link className="btn btn--primary" href="/auth/login"><LocalizedText messageKey="auth.stepUpUnavailable.return" /></Link>
      </PaperPanel>
    </ProductSection>
  </ProductPage>;
}
