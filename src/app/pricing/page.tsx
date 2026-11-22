import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { proposedAccessRows, proposedPlans } from "@/lib/access-catalog";

export const metadata = { title: "Plans and access · JLPT practice" };

export default function PricingPage() {
  return (
    <ProductPage eyebrow="Plans and access" title="A proposed way to practice" description="The V7.2 access matrix is presented here as a planning preview. Final entitlements and BDT prices still need owner approval." className="product-page--editorial">
      <ProductSection title="Premium plan structure" className="product-section--tint">
        <div className="plan-preview-grid">
          {proposedPlans.map((plan, index) => (
            <PaperPanel className={`plan-preview-card${index === 1 ? " plan-preview-card--featured" : ""}`} key={plan.code}>
              <span className="product-small-label">{plan.durationDays} days</span>
              <h3>{plan.name}</h3>
              <p className="plan-preview-price">Price pending</p>
              <p>BDT price will be set after owner approval.</p>
              <button className="btn btn--secondary" type="button" disabled aria-disabled="true">Purchases not open</button>
            </PaperPanel>
          ))}
        </div>
        <p className="product-note">These proposed fixed durations are configuration defaults, not active offers. No checkout, payment instructions, or premium activation is available yet.</p>
      </ProductSection>
      <ProductSection title="Proposed free and premium access">
        <PaperPanel className="data-panel access-matrix-panel">
          <div className="table-scroll">
            <table className="access-matrix">
              <thead><tr><th>Feature</th><th>Free</th><th>Premium</th></tr></thead>
              <tbody>{proposedAccessRows.map(([feature, free, premium]) => <tr key={feature}><th scope="row">{feature}</th><td>{free}</td><td><Check size={15} aria-hidden="true" />{premium}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="data-footnote">This matrix remains proposed and content dependent. Access must eventually be enforced by database entitlements, not by these display rows.</p>
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Start with a free account" className="product-section--compact">
        <PaperPanel className="statement-panel"><p>Account access, profile preferences and level guides are part of the proposed free tier.</p><Link className="btn btn--primary" href="/auth/register">Create an account <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
