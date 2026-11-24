import Link from "next/link";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { LocalizedText } from "@/components/i18n/localized-text";

export const metadata = {
  title: "Contact and support · JLPT practice",
  description: "Contact the JLPT practice support team through a private learner support request.",
};

export default function ContactPage() {
  return (
    <ProductPage eyebrow="Contact" eyebrowKey="contact.eyebrow" title="Get help with your practice space" titleKey="contact.title" description="Support requests are handled through the signed-in learner inbox so replies stay connected to the right account." descriptionKey="contact.description" className="product-page--editorial">
      <ProductSection title="Private learner support" titleKey="contact.section.private" className="product-section--tint">
        <PaperPanel className="statement-panel contact-panel">
          <MessageCircle aria-hidden="true" />
          <h2><LocalizedText messageKey="contact.openTitle" /></h2>
          <p><LocalizedText messageKey="contact.openDescription" /></p>
          <div className="product-cta-row"><Link className="btn btn--primary" href="/support"><LocalizedText messageKey="contact.openSupport" /> <ArrowUpRight size={15} aria-hidden="true" /></Link><Link className="text-link" href="/auth/login?next=%2Fsupport"><LocalizedText messageKey="contact.signIn" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Before writing" titleKey="contact.section.before">
        <PaperPanel className="statement-panel"><p><LocalizedText messageKey="contact.beforeIntro" /> <Link className="text-link" href="/faq"><LocalizedText messageKey="faq.title" /></Link>. <LocalizedText messageKey="contact.beforeEnd" /></p></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
