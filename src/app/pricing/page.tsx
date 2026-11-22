import Link from "next/link";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";

export const metadata = { title: "Plans and access · JLPT practice" };

export default function PricingPage() {
  return (
    <ProductPage eyebrow="Plans and access" title="Access details are being prepared" description="Plan limits, prices, currency, duration, payment methods, and refund terms have not been approved yet." className="product-page--editorial">
      <ProductSection title="No plan is offered yet" className="product-section--tint">
        <PaperPanel className="statement-panel">
          <p>This page will show the free and paid feature matrix after those decisions are confirmed. There is no payment form or active checkout on this site.</p>
          <p>Payment instructions will be published only after the provider, verification process, refund terms, and support process are set.</p>
          <Link className="btn btn--secondary" href="/#levels">Review JLPT levels</Link>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
