import Link from "next/link";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in · JLPT practice" };

export default function LoginPage() {
  return (
    <ProductPage eyebrow="Account access" title="Sign in to your practice space" description="Use a one-time email code or continue with your Google account." className="product-page--auth">
      <ProductSection title="Email or Google sign-in">
        <PaperPanel className="auth-panel">
          <AuthForm mode="login" />
          <p className="auth-switch"><Link href="/auth/register">Create an account</Link><span>·</span><Link href="/auth/forgot-password">Recover account</Link></p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
