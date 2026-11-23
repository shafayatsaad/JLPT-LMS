import { redirect } from "next/navigation";
import { LearnerMfa } from "@/components/learner-mfa";
import { LocalizedText } from "@/components/i18n/localized-text";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Authenticator verification · JLPT Practice", robots: { index: false, follow: false } };

function safeNext(value: string | string[] | undefined) {
  if (typeof value !== "string") return "/dashboard";
  try {
    const parsed = new URL(value, "https://local.invalid");
    if (parsed.origin !== "https://local.invalid" || parsed.pathname.startsWith("/auth/")) return "/dashboard";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch { return "/dashboard"; }
}

export default async function LearnerMfaPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const nextPath = safeNext((await searchParams).next);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return <ProductPage eyebrow="Account security" eyebrowKey="auth.stepUp.eyebrow" title="Authenticator verification" titleKey="auth.mfa.unconfiguredTitle" description="Supabase is not configured for this environment." descriptionKey="auth.mfa.unconfiguredDescription" className="product-page--auth"><ProductSection title="Authenticator verification" titleKey="auth.mfa.section"><PaperPanel className="auth-panel"><p><LocalizedText messageKey="auth.mfa.connect" /></p></PaperPanel></ProductSection></ProductPage>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/auth/mfa?next=${encodeURIComponent(nextPath)}`)}`);
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel === "aal2") redirect(nextPath);

  return <ProductPage eyebrow="Account security" eyebrowKey="auth.stepUp.eyebrow" title="Verify your sign-in" titleKey="auth.mfa.title" description="Use your authenticator app to confirm this new or unrecognized session." descriptionKey="auth.mfa.description" className="product-page--auth">
    <ProductSection title="Authenticator verification" titleKey="auth.mfa.section" className="product-section--tint">
      <PaperPanel className="auth-panel"><LearnerMfa variant="challenge" nextPath={nextPath} /></PaperPanel>
    </ProductSection>
  </ProductPage>;
}
