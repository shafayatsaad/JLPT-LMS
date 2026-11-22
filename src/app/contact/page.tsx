import Link from "next/link";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";

export const metadata = {
  title: "Contact and support · JLPT practice",
  description: "Contact the JLPT practice support team through a private learner support request.",
};

export default function ContactPage() {
  return (
    <ProductPage eyebrow="Contact" title="Get help with your practice space" description="Support requests are handled through the signed-in learner inbox so replies stay connected to the right account." className="product-page--editorial">
      <ProductSection title="Private learner support" className="product-section--tint">
        <PaperPanel className="statement-panel contact-panel">
          <MessageCircle aria-hidden="true" />
          <h2>Open or review a support request</h2>
          <p>Sign in to describe an account, payment, exam, content or technical issue. Do not include passwords, one-time codes, wallet PINs or other credentials.</p>
          <div className="product-cta-row"><Link className="btn btn--primary" href="/support">Open support center <ArrowUpRight size={15} aria-hidden="true" /></Link><Link className="text-link" href="/auth/login?next=%2Fsupport">Sign in first <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Before writing">
        <PaperPanel className="statement-panel"><p>For questions about access and current availability, see the <Link className="text-link" href="/faq">FAQ</Link>. Public email and business contact details will be added after the platform operator and support address are confirmed.</p></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
