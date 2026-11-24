import Link from "next/link";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { AuthForm } from "@/components/auth-form";
import { LocalizedText } from "@/components/i18n/localized-text";

export const metadata = { title: "Create account · JLPT practice" };

export default function RegisterPage() {
  return (
    <ProductPage eyebrow="Create a learner account" eyebrowKey="auth.register.eyebrow" title="Set up your practice space" titleKey="auth.register.title" description="Create an account with email and a password, or continue with Google. Every account verifies a phone number before entering the practice space." descriptionKey="auth.register.description" className="product-page--auth">
      <ProductSection title="Create your account" titleKey="auth.register.section">
        <PaperPanel className="auth-panel">
          <AuthForm mode="register" />
          <p className="auth-switch"><LocalizedText messageKey="auth.register.already" /> <Link href="/auth/login"><LocalizedText messageKey="auth.register.signIn" /></Link></p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
