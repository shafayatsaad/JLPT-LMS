import Link from "next/link";
import type { Metadata } from "next";
import { OrigamiProductShell } from "@/components/product-shell";
import { jlptFormats } from "@/lib/jlpt-format";

export const metadata: Metadata = { title: "N5 exam interface preview" };

export default function N5PreviewDetailsPage() {
  const format = jlptFormats.N5;

  return (
    <OrigamiProductShell>
      <section className="product-hero product-hero--compact" data-enter>
        <div className="product-wrap">
          <nav className="product-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/levels/n5">N5 guide</Link><span aria-hidden="true">/</span><span>Interface preview</span></nav>
          <p className="product-eyebrow"><span aria-hidden="true">✳</span> N5 · Interface preview</p>
          <h1>Walk through an N5 mock exam</h1>
          <p className="product-lede">Preview the exam instructions, a focused question workspace, sample results and answer explanations.</p>
          <div className="preview-disclosure"><strong>What this preview includes</strong><p>Two original sample questions across vocabulary and grammar. The listening section is shown as a placeholder because no exam audio is attached. This is not a published exam form or a saved attempt.</p></div>
        </div>
      </section>

      <section className="product-section">
        <div className="product-wrap">
          <div className="product-section__heading"><div><p className="product-eyebrow">N5 test structure</p><h2>Three timed sections</h2></div><span className="product-small-label">Format reference</span></div>
          <div className="preview-section-list">
            {format.sections.map((section, index) => (
              <div className="preview-section-row" key={section.code}>
                <span className="preview-section-row__index">0{index + 1}</span>
                <strong>{section.label}</strong>
                <span>{section.minutes} min</span>
                <span className="preview-section-row__status">{index === 2 ? "Audio placeholder" : "Sample question"}</span>
              </div>
            ))}
          </div>
          <div className="product-cta-row"><Link className="product-button" href="/exams/n5/preview/instructions">Read instructions <span aria-hidden="true">↗</span></Link><Link className="product-text-link" href="/levels/n5">Back to N5 guide</Link></div>
        </div>
      </section>
    </OrigamiProductShell>
  );
}
