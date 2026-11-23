import { ConfirmEmail } from "@/components/confirm-email";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";

export const metadata = { title: "Continue securely · JLPT practice" };

export default function ConfirmEmailPage() {
  return (
    <ProductPage eyebrow="Account verification" eyebrowKey="auth.confirm.eyebrow" title="Continue securely" titleKey="auth.confirm.title" description="Confirm your email or continue an account recovery request." descriptionKey="auth.confirm.description" className="product-page--auth">
      <ProductSection title="One more step" titleKey="auth.confirm.section">
        <PaperPanel className="auth-panel">
          <ConfirmEmail />
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
