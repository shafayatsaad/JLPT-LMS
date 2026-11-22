import { ConfirmEmail } from "@/components/confirm-email";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";

export const metadata = { title: "Continue securely · JLPT practice" };

export default function ConfirmEmailPage() {
  return (
    <ProductPage eyebrow="Account verification" title="Continue securely" description="Confirm your email or continue an account recovery request." className="product-page--auth">
      <ProductSection title="One more step">
        <PaperPanel className="auth-panel">
          <ConfirmEmail />
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
