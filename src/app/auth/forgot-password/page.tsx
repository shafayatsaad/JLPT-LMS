import Link from "next/link";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Account recovery · JLPT practice" };

export default function ForgotPasswordPage() {
  return (
    <ProductPage eyebrow="Account recovery" title="Reset your password" description="We will send recovery instructions to the account email address if an account matches it." className="product-page--auth">
      <ProductSection title="Request a recovery email">
        <PaperPanel className="auth-panel">
          <AuthForm mode="recovery" />
          <p className="auth-switch"><Link href="/auth/login">Return to sign in</Link></p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
