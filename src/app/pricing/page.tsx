import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { LocalizedText } from "@/components/i18n/localized-text";
import { PricingAccessMatrix, PricingPlanCards } from "@/components/pricing-preview";
import { isLocalDemoEnvironment } from "@/lib/local-demo";

export const metadata = { title: "Plans and access · JLPT practice" };

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const query = await searchParams;
  const candidateNext = query.next ?? "/exams";
  const nextPath = candidateNext.startsWith("/") && !candidateNext.startsWith("//") && !candidateNext.includes("\\") ? candidateNext : "/exams";
  const demoMode = isLocalDemoEnvironment();
  return (
    <ProductPage eyebrow="Plans and access" title={demoMode ? "Try the local plan sandbox" : "A proposed way to practice"} description={demoMode ? "Sample plans and simulated payments for this local test environment." : "The V7.2 access matrix is presented here as a planning preview. Final entitlements and BDT prices still need owner approval."} eyebrowKey={demoMode ? "pricing.demoEyebrow" : "pricing.eyebrow"} titleKey={demoMode ? "pricing.demoTitle" : "pricing.title"} descriptionKey={demoMode ? "pricing.demoDescription" : "pricing.description"} className="product-page--editorial">
      <ProductSection title="Premium plan structure" titleKey="pricing.planSection" className="product-section--tint">
        <PricingPlanCards demoMode={demoMode} nextPath={nextPath} />
        {demoMode ? <p className="local-demo-pricing-note"><LocalizedText messageKey="pricing.demoPlanNote" /></p> : <p className="product-note"><LocalizedText messageKey="pricing.planNote" /></p>}
      </ProductSection>
      <ProductSection title="Proposed free and premium access" titleKey="pricing.accessSection">
        <PaperPanel className="data-panel access-matrix-panel">
          <PricingAccessMatrix />
          <p className="data-footnote"><LocalizedText messageKey="pricing.accessNote" /></p>
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Start with a free account" titleKey="pricing.closingSection" className="product-section--compact">
        <PaperPanel className="statement-panel"><p><LocalizedText messageKey="pricing.freeTierDescription" /></p><Link className="btn btn--primary" href="/auth/register"><LocalizedText messageKey="pricing.createAccount" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
