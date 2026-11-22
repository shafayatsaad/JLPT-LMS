import { redirect } from "next/navigation";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { AuthForm } from "@/components/auth-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Choose a new password · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return (
      <ProductPage eyebrow="Account recovery" title="Choose a new password" description="Configure Supabase before updating account credentials." className="product-page--auth">
        <ProductSection title="Supabase setup required"><PaperPanel><p>Copy the project values into <code>.env.local</code> and restart the app.</p></PaperPanel></ProductSection>
      </ProductPage>
    );
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?notice=recovery-session-missing");

  return (
    <ProductPage eyebrow="Account recovery" title="Choose a new password" description="Set a new password for the verified recovery session." className="product-page--auth">
      <ProductSection title="Update password"><PaperPanel className="auth-panel"><AuthForm mode="update-password" /></PaperPanel></ProductSection>
    </ProductPage>
  );
}
