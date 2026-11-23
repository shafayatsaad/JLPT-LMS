import { redirect } from "next/navigation";
import { LearnerMfa } from "@/components/learner-mfa";
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
  if (!supabase) return <ProductPage eyebrow="Account security" title="Authenticator verification" description="Supabase is not configured for this environment." className="product-page--auth"><ProductSection title="Account verification"><PaperPanel className="auth-panel"><p>Connect Supabase to continue.</p></PaperPanel></ProductSection></ProductPage>;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/auth/mfa?next=${encodeURIComponent(nextPath)}`)}`);
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel === "aal2") redirect(nextPath);

  return <ProductPage eyebrow="Account security" title="Verify your sign-in" description="Use your authenticator app to confirm this new or unrecognized session." className="product-page--auth">
    <ProductSection title="Authenticator verification" className="product-section--tint">
      <PaperPanel className="auth-panel"><LearnerMfa variant="challenge" nextPath={nextPath} /></PaperPanel>
    </ProductSection>
  </ProductPage>;
}
