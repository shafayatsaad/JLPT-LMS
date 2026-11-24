import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, Clock3, RotateCcw } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { LocalizedText } from "@/components/i18n/localized-text";

export const metadata = {
  title: "How JLPT practice works · JLPT practice",
  description: "Learn how level selection, timed practice, answer review and focused revision fit together.",
};

const steps = [
  { number: "01", titleKey: "how.step.level.title" as const, detailKey: "how.step.level.description" as const, icon: BookOpenCheck },
  { number: "02", titleKey: "how.step.exam.title" as const, detailKey: "how.step.exam.description" as const, icon: Clock3 },
  { number: "03", titleKey: "how.step.review.title" as const, detailKey: "how.step.review.description" as const, icon: RotateCcw },
];

export default function HowItWorksPage() {
  return (
    <ProductPage eyebrow="Practice workflow" eyebrowKey="how.eyebrow" title="A clear path from paper to review" titleKey="how.title" description="The product is designed around level choice, focused exam practice and answer review. Some parts remain in development." descriptionKey="how.description" className="product-page--editorial">
      <ProductSection title="The intended learner journey" titleKey="how.section.journey" className="product-section--tint">
        <div className="instruction-layout how-it-works-grid">
          {steps.map(({ number, titleKey, icon: Icon, detailKey }) => (
            <PaperPanel className="instruction-card" key={number}>
              <span className="instruction-card__step">{number}</span>
              <Icon aria-hidden="true" />
              <h3><LocalizedText messageKey={titleKey} /></h3>
              <p><LocalizedText messageKey={detailKey} /></p>
            </PaperPanel>
          ))}
        </div>
      </ProductSection>
      <ProductSection title="What is available in this testing build" titleKey="how.section.available">
        <PaperPanel className="statement-panel"><p><LocalizedText messageKey="how.available.description" /></p><div className="product-cta-row"><Link className="btn btn--primary" href="/#levels"><LocalizedText messageKey="how.exploreLevels" /> <ArrowUpRight size={15} aria-hidden="true" /></Link><Link className="text-link" href="/exams/n5/preview"><LocalizedText messageKey="how.openPreview" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></div></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
