import Link from "next/link";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Create account · JLPT practice" };

export default function RegisterPage() {
  return (
    <ProductPage eyebrow="Create a learner account" title="Set up your practice space" description="Sign up with email or Google, confirm your account, and keep your JLPT practice in one place." className="product-page--auth">
      <ProductSection title="Email verification is required">
        <PaperPanel className="auth-panel">
          <AuthForm mode="register" />
          <p className="auth-switch">Already registered? <Link href="/auth/login">Sign in with email</Link></p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
