import Link from "next/link";
import type { Metadata } from "next";
import { OrigamiProductShell } from "@/components/product-shell";
import { jlptFormats } from "@/lib/jlpt-format";

export const metadata: Metadata = { title: "N5 preview instructions" };

export default function N5PreviewInstructionsPage() {
  return (
    <OrigamiProductShell>
      <section className="product-hero product-hero--compact" data-enter>
        <div className="product-wrap">
          <nav className="product-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/exams/n5/preview">N5 preview</Link><span aria-hidden="true">/</span><span>Instructions</span></nav>
          <p className="product-eyebrow"><span aria-hidden="true">✳</span> Before the preview</p>
          <h1>Read the exam instructions</h1>
          <p className="product-lede">A short orientation to the N5 workspace and the limits of this interactive preview.</p>
        </div>
      </section>
      <section className="product-section">
        <div className="product-wrap instruction-layout">
          <article className="instruction-card">
            <span className="instruction-card__step">01</span><h2>Move through the sections</h2><p>The N5 format has vocabulary, grammar and reading, and listening test sections. The preview shows their official time references, but it contains only two sample questions.</p>
          </article>
          <article className="instruction-card">
            <span className="instruction-card__step">02</span><h2>Choose an answer</h2><p>Use the keyboard or select one answer choice. You can change your response before ending the preview.</p>
          </article>
          <article className="instruction-card">
            <span className="instruction-card__step">03</span><h2>Review the sample result</h2><p>At the end, the preview shows the two sample responses and prewritten explanations. It does not calculate an official JLPT score.</p>
          </article>
          <aside className="preview-disclosure instruction-warning"><strong>Preview behavior</strong><p>The countdown and answer storage run only in this browser tab. There is no account, server timer, saved attempt or listening audio in this build.</p></aside>
          <div className="product-cta-row instruction-actions"><Link className="product-button" href="/exams/n5/preview/session">Open exam interface <span aria-hidden="true">↗</span></Link><Link className="product-text-link" href="/exams/n5/preview">Back to overview</Link></div>
          <p className="instruction-timing">Official N5 timing reference: {jlptFormats.N5.sections.map((section) => `${section.minutes} min ${section.label}`).join(" · ")}</p>
        </div>
      </section>
    </OrigamiProductShell>
  );
}
