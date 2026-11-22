import Link from "next/link";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Create account · JLPT practice" };

export default function RegisterPage() {
  return (
    <ProductPage eyebrow="Create a learner account" title="Set up your practice space" description="Create an account with email or phone and a password, or continue with Google." className="product-page--auth">
      <ProductSection title="Create your account">
        <PaperPanel className="auth-panel">
          <AuthForm mode="register" />
          <p className="auth-switch">Already registered? <Link href="/auth/login">Sign in with email</Link></p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
