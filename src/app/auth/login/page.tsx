import Link from "next/link";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { AuthForm } from "@/components/auth-form";
import { LocalizedText } from "@/components/i18n/localized-text";
import { isLocalDemoEnvironment } from "@/lib/local-demo";

export const metadata = { title: "Sign in · JLPT practice" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const showLocalDemoAccounts = isLocalDemoEnvironment();
  return (
    <ProductPage eyebrow="Account access" eyebrowKey="auth.login.eyebrow" title="Sign in to your practice space" titleKey="auth.login.title" description="Sign in with email and password, or continue with Google. Every account verifies a phone number before opening the learner workspace." descriptionKey="auth.login.description" className="product-page--auth">
      <ProductSection title="Email or Google sign-in" titleKey="auth.login.section">
        <PaperPanel className="auth-panel">
          <AuthForm mode="login" />
          <p className="auth-switch"><Link href="/auth/register"><LocalizedText messageKey="auth.login.create" /></Link><span>·</span><Link href="/auth/forgot-password"><LocalizedText messageKey="auth.login.recover" /></Link></p>
          {showLocalDemoAccounts ? <p className="auth-switch"><Link href="/dev/test-accounts">View local test profiles</Link></p> : null}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
