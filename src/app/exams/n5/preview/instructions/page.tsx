import Link from "next/link";
import type { Metadata } from "next";
import { OrigamiProductShell } from "@/components/product-shell";
import { jlptFormats } from "@/lib/jlpt-format";
import { LocalizedText } from "@/components/i18n/localized-text";
import type { MessageKey } from "@/lib/i18n";

export const metadata: Metadata = { title: "N5 preview instructions" };

export default function N5PreviewInstructionsPage() {
  const sectionKeys: Record<string, MessageKey> = {
    vocabulary: "exam.section.language_knowledge_vocabulary",
    "grammar-reading": "exam.section.language_knowledge_grammar_reading",
    listening: "exam.section.listening",
  };
  return (
    <OrigamiProductShell>
      <section className="product-hero product-hero--compact" data-enter>
        <div className="product-wrap">
          <nav className="product-breadcrumb" aria-label="Breadcrumb"><Link href="/"><LocalizedText messageKey="preview.home" /></Link><span aria-hidden="true">/</span><Link href="/exams/n5/preview"><LocalizedText messageKey="preview.overviewCrumb" /></Link><span aria-hidden="true">/</span><span><LocalizedText messageKey="preview.instructionsCrumb" /></span></nav>
          <p className="product-eyebrow"><span aria-hidden="true">✳</span> <LocalizedText messageKey="preview.beforeStart" /></p>
          <h1><LocalizedText messageKey="preview.instructionsTitle" /></h1>
          <p className="product-lede"><LocalizedText messageKey="preview.instructionsLede" /></p>
        </div>
      </section>
      <section className="product-section">
        <div className="product-wrap instruction-layout">
          <article className="instruction-card">
            <span className="instruction-card__step">01</span><h2><LocalizedText messageKey="preview.moveSections" /></h2><p><LocalizedText messageKey="preview.moveSectionsBody" /></p>
          </article>
          <article className="instruction-card">
            <span className="instruction-card__step">02</span><h2><LocalizedText messageKey="preview.chooseAnswerTitle" /></h2><p><LocalizedText messageKey="preview.chooseAnswerBody" /></p>
          </article>
          <article className="instruction-card">
            <span className="instruction-card__step">03</span><h2><LocalizedText messageKey="preview.seeSampleResult" /></h2><p><LocalizedText messageKey="preview.seeSampleResultBody" /></p>
          </article>
          <aside className="preview-disclosure instruction-warning"><strong><LocalizedText messageKey="preview.behavior" /></strong><p><LocalizedText messageKey="preview.behaviorBody" /></p></aside>
          <div className="product-cta-row instruction-actions"><Link className="product-button" href="/exams/n5/preview/session"><LocalizedText messageKey="preview.openSession" /> <span aria-hidden="true">↗</span></Link><Link className="product-text-link" href="/exams/n5/preview"><LocalizedText messageKey="preview.backOverview" /></Link></div>
          <p className="instruction-timing"><LocalizedText messageKey="preview.officialTiming" />: {jlptFormats.N5.sections.map((section, index) => <span key={section.code}>{index ? " · " : ""}{section.minutes} <LocalizedText messageKey="preview.minute" /> {sectionKeys[section.code] ? <LocalizedText messageKey={sectionKeys[section.code]} /> : section.label}</span>)}</p>
        </div>
      </section>
    </OrigamiProductShell>
  );
}
