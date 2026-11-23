import Link from "next/link";
import type { Metadata } from "next";
import { OrigamiProductShell } from "@/components/product-shell";
import { jlptFormats } from "@/lib/jlpt-format";
import { LocalizedText } from "@/components/i18n/localized-text";
import type { MessageKey } from "@/lib/i18n";

export const metadata: Metadata = { title: "N5 exam interface preview" };

export default function N5PreviewDetailsPage() {
  const format = jlptFormats.N5;
  const sectionKeys: Record<string, MessageKey> = {
    vocabulary: "exam.section.language_knowledge_vocabulary",
    "grammar-reading": "exam.section.language_knowledge_grammar_reading",
    listening: "exam.section.listening",
  };

  return (
    <OrigamiProductShell>
      <section className="product-hero product-hero--compact" data-enter>
        <div className="product-wrap">
          <nav className="product-breadcrumb" aria-label="Breadcrumb"><Link href="/"><LocalizedText messageKey="preview.home" /></Link><span aria-hidden="true">/</span><Link href="/levels/n5"><LocalizedText messageKey="preview.levelGuide" /></Link><span aria-hidden="true">/</span><span><LocalizedText messageKey="preview.overviewCrumb" /></span></nav>
          <p className="product-eyebrow"><span aria-hidden="true">✳</span> <LocalizedText messageKey="preview.eyebrow" /></p>
          <h1><LocalizedText messageKey="preview.title" /></h1>
          <p className="product-lede"><LocalizedText messageKey="preview.lede" /></p>
          <div className="preview-disclosure"><strong><LocalizedText messageKey="preview.includes" /></strong><p><LocalizedText messageKey="preview.includesBody" /></p></div>
        </div>
      </section>

      <section className="product-section">
        <div className="product-wrap">
          <div className="product-section__heading"><div><p className="product-eyebrow"><LocalizedText messageKey="preview.structure" /></p><h2><LocalizedText messageKey="preview.threeSections" /></h2></div><span className="product-small-label"><LocalizedText messageKey="preview.formatReference" /></span></div>
          <div className="preview-section-list">
            {format.sections.map((section, index) => (
              <div className="preview-section-row" key={section.code}>
                <span className="preview-section-row__index">0{index + 1}</span>
                <strong>{sectionKeys[section.code] ? <LocalizedText messageKey={sectionKeys[section.code]} /> : section.label}</strong>
                <span>{section.minutes} <LocalizedText messageKey="preview.minute" /></span>
                <span className="preview-section-row__status"><LocalizedText messageKey={index === 2 ? "preview.audioPlaceholder" : "preview.sampleQuestion"} /></span>
              </div>
            ))}
          </div>
          <div className="product-cta-row"><Link className="product-button" href="/exams/n5/preview/instructions"><LocalizedText messageKey="preview.readInstructions" /> <span aria-hidden="true">↗</span></Link><Link className="product-text-link" href="/levels/n5"><LocalizedText messageKey="preview.backLevel" /></Link></div>
        </div>
      </section>
    </OrigamiProductShell>
  );
}
