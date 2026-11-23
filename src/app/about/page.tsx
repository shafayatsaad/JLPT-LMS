import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, ShieldCheck, Target } from "lucide-react";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { LocalizedText } from "@/components/i18n/localized-text";

export const metadata = {
  title: "About JLPT practice · Independent mock exams",
  description: "How JLPT practice prepares original mock questions, reviews answers, and reports raw results.",
};

export default function AboutPage() {
  return (
    <ProductPage eyebrow="About the platform" eyebrowKey="about.eyebrow" title="Independent JLPT preparation" titleKey="about.title" description="A practice platform for learners preparing for JLPT N1 through N5. Questions and explanations are prepared and reviewed before they are used." descriptionKey="about.description" className="product-page--editorial">
      <ProductSection title="How the practice is built" titleKey="about.section.build" className="product-section--tint">
        <div className="paper-grid paper-grid--3">
          <PaperPanel className="feature-panel"><BookOpenCheck aria-hidden="true" /><h3><LocalizedText messageKey="about.original.title" /></h3><p><LocalizedText messageKey="about.original.description" /></p></PaperPanel>
          <PaperPanel className="feature-panel"><ShieldCheck aria-hidden="true" /><h3><LocalizedText messageKey="about.review.title" /></h3><p><LocalizedText messageKey="about.review.description" /></p></PaperPanel>
          <PaperPanel className="feature-panel"><Target aria-hidden="true" /><h3><LocalizedText messageKey="about.raw.title" /></h3><p><LocalizedText messageKey="about.raw.description" /></p></PaperPanel>
        </div>
      </ProductSection>
      <ProductSection title="What the platform does not claim" titleKey="about.section.claims">
        <PaperPanel className="statement-panel"><p><LocalizedText messageKey="about.claims.description" /></p><Link className="text-link" href="/#levels"><LocalizedText messageKey="about.exploreLevels" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
