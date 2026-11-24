import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { LocalizedText } from "@/components/i18n/localized-text";
import type { MessageKey } from "@/lib/i18n";

export const metadata = {
  title: "Frequently asked questions · JLPT practice",
  description: "Answers about account access, practice previews, scores, payments and the independent JLPT practice platform.",
};

const questions = [
  ["faq.q.official", "faq.a.official"],
  ["faq.q.exams", "faq.a.exams"],
  ["faq.q.content", "faq.a.content"],
  ["faq.q.results", "faq.a.results"],
  ["faq.q.account", "faq.a.account"],
  ["faq.q.payment", "faq.a.payment"],
  ["faq.q.support", "faq.a.support"],
] as const satisfies ReadonlyArray<readonly [MessageKey, MessageKey]>;

export default function FaqPage() {
  return (
    <ProductPage eyebrow="Questions" eyebrowKey="faq.eyebrow" title="Answers before you begin" titleKey="faq.title" description="Current account and practice details for learners testing the platform." descriptionKey="faq.description" className="product-page--editorial">
      <ProductSection title="Common questions" titleKey="faq.section.common" className="product-section--tint">
        <div className="faq-page-list">
          {questions.map(([questionKey, answerKey], index) => (
            <PaperPanel className="faq-page-item" key={questionKey}>
              <span className="product-small-label">{String(index + 1).padStart(2, "0")}</span>
              <h3><LocalizedText messageKey={questionKey} /></h3>
              <p><LocalizedText messageKey={answerKey} /></p>
            </PaperPanel>
          ))}
        </div>
      </ProductSection>
      <ProductSection title="Need help with your account?" titleKey="faq.section.help">
        <PaperPanel className="statement-panel"><p><LocalizedText messageKey="faq.help.description" /></p><div className="product-cta-row"><Link className="btn btn--primary" href="/support"><LocalizedText messageKey="faq.help.support" /> <ArrowUpRight size={15} aria-hidden="true" /></Link><Link className="text-link" href="/#levels"><LocalizedText messageKey="faq.help.levels" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></div></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
