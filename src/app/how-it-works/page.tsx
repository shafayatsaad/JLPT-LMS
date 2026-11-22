import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, Clock3, RotateCcw } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";

export const metadata = {
  title: "How JLPT practice works · JLPT practice",
  description: "Learn how level selection, timed practice, answer review and focused revision fit together.",
};

const steps = [
  { number: "01", title: "Choose a level", icon: BookOpenCheck, detail: "Review N1–N5 test sections and timings before choosing the level you are preparing for." },
  { number: "02", title: "Take a published mock", icon: Clock3, detail: "When a reviewed exam form is published, the intended workflow uses timed sections and saves an authenticated attempt." },
  { number: "03", title: "Review and revisit", icon: RotateCcw, detail: "After a supported attempt, compare answers with explanations and return to skills that need more practice." },
];

export default function HowItWorksPage() {
  return (
    <ProductPage eyebrow="Practice workflow" title="A clear path from paper to review" description="The product is designed around level choice, focused exam practice and answer review. Some parts remain in development." className="product-page--editorial">
      <ProductSection title="The intended learner journey" className="product-section--tint">
        <div className="instruction-layout how-it-works-grid">
          {steps.map(({ number, title, icon: Icon, detail }) => (
            <PaperPanel className="instruction-card" key={number}>
              <span className="instruction-card__step">{number}</span>
              <Icon aria-hidden="true" />
              <h3>{title}</h3>
              <p>{detail}</p>
            </PaperPanel>
          ))}
        </div>
      </ProductSection>
      <ProductSection title="What is available in this testing build">
        <PaperPanel className="statement-panel"><p>You can view level formats, create an account with email or Google, manage basic profile preferences, and explore an N5 interface preview. That preview is not a saved, timed or scored exam attempt. Published mock exams and the server-authoritative exam loop are still being built.</p><div className="product-cta-row"><Link className="btn btn--primary" href="/#levels">Explore JLPT levels <ArrowUpRight size={15} aria-hidden="true" /></Link><Link className="text-link" href="/exams/n5/preview">Open the N5 interface preview <ArrowUpRight size={15} aria-hidden="true" /></Link></div></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
