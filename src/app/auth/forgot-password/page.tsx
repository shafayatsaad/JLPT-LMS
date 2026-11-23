import Link from "next/link";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { AuthForm } from "@/components/auth-form";
import { LocalizedText } from "@/components/i18n/localized-text";

export const metadata = { title: "Account recovery · JLPT practice" };

export default function ForgotPasswordPage() {
  return (
    <ProductPage eyebrow="Account recovery" eyebrowKey="auth.recovery.eyebrow" title="Reset your password" titleKey="auth.recovery.title" description="Enter the email address on your account to continue. Phone recovery will be available after SMS is configured." descriptionKey="auth.recovery.description" className="product-page--auth">
      <ProductSection title="Request account recovery" titleKey="auth.recovery.section">
        <PaperPanel className="auth-panel">
          <AuthForm mode="recovery" />
          <p className="auth-switch"><Link href="/auth/login"><LocalizedText messageKey="auth.recovery.return" /></Link></p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
