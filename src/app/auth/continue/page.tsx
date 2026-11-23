import { StepUpContinue } from "@/components/auth-step-up-continue";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";

export const dynamic = "force-dynamic";
export const metadata = { title: "Continue sign-in · JLPT Practice", robots: { index: false, follow: false } };

function safeNext(value: string | string[] | undefined) {
  if (typeof value !== "string") return "/dashboard";
  try {
    const parsed = new URL(value, "https://local.invalid");
    if (parsed.origin !== "https://local.invalid" || parsed.pathname.startsWith("/auth/")) return "/dashboard";
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch { return "/dashboard"; }
}

export default async function ContinueSignInPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const nextPath = safeNext((await searchParams).next);
  return <ProductPage eyebrow="Account security" title="Checking this sign-in" description="We’re confirming that this session can continue to your JLPT practice account." className="product-page--auth">
    <ProductSection title="Account verification" className="product-section--tint">
      <PaperPanel className="auth-panel"><StepUpContinue nextPath={nextPath} /></PaperPanel>
    </ProductSection>
  </ProductPage>;
}
