import Link from "next/link";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in · JLPT practice" };

export default function LoginPage() {
  return (
    <ProductPage eyebrow="Account access" title="Sign in to your practice space" description="Sign in with your email and password, or continue with Google. Phone sign-in will be available after SMS is configured." className="product-page--auth">
      <ProductSection title="Email or Google sign-in">
        <PaperPanel className="auth-panel">
          <AuthForm mode="login" />
          <p className="auth-switch"><Link href="/auth/register">Create an account</Link><span>·</span><Link href="/auth/forgot-password">Recover account</Link></p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
