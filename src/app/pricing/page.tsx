import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { LocalizedText } from "@/components/i18n/localized-text";
import { PricingAccessMatrix, PricingPlanCards } from "@/components/pricing-preview";

export const metadata = { title: "Plans and access · JLPT practice" };

export default function PricingPage() {
  return (
    <ProductPage eyebrow="Plans and access" title="A proposed way to practice" description="The V7.2 access matrix is presented here as a planning preview. Final entitlements and BDT prices still need owner approval." eyebrowKey="pricing.eyebrow" titleKey="pricing.title" descriptionKey="pricing.description" className="product-page--editorial">
      <ProductSection title="Premium plan structure" titleKey="pricing.planSection" className="product-section--tint">
        <PricingPlanCards />
        <p className="product-note"><LocalizedText messageKey="pricing.planNote" /></p>
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
