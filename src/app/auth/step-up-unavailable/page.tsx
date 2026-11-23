import Link from "next/link";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";

export const metadata = { title: "Sign-in verification unavailable · JLPT Practice", robots: { index: false, follow: false } };

export default function StepUpUnavailablePage() {
  return <ProductPage eyebrow="Account security" title="Sign-in verification is not ready" description="The account security hook is not active for this environment yet." className="product-page--auth">
    <ProductSection title="Finish Supabase setup" className="product-section--tint">
      <PaperPanel className="auth-panel">
        <p>Ask the platform administrator to apply the trusted-device migration, enable the Custom Access Token Hook, and confirm the Preview environment before continuing.</p>
        <Link className="btn btn--primary" href="/auth/login">Return to sign in</Link>
      </PaperPanel>
    </ProductSection>
  </ProductPage>;
}
