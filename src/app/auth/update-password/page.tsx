import { redirect } from "next/navigation";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { AuthForm } from "@/components/auth-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LocalizedText } from "@/components/i18n/localized-text";

export const metadata = { title: "Choose a new password · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <ProductPage eyebrow="Account recovery" eyebrowKey="auth.recovery.eyebrow" title="Choose a new password" titleKey="auth.update.title" description="Configure Supabase before updating account credentials." descriptionKey="auth.error.supabase" className="product-page--auth">
        <ProductSection title="Supabase setup required" titleKey="dashboard.setupRequired"><PaperPanel><p><LocalizedText messageKey="auth.error.supabase" /></p></PaperPanel></ProductSection>
      </ProductPage>
    );
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?notice=recovery-session-missing");

  return (
    <ProductPage eyebrow="Account recovery" eyebrowKey="auth.recovery.eyebrow" title="Choose a new password" titleKey="auth.update.title" description="Set a new password for the verified recovery session." descriptionKey="auth.update.description" className="product-page--auth">
      <ProductSection title="Update password" titleKey="auth.update.section"><PaperPanel className="auth-panel"><AuthForm mode="update-password" /></PaperPanel></ProductSection>
    </ProductPage>
  );
}
