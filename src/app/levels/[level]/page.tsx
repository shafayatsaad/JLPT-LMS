import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LevelGuideBreadcrumb } from "@/components/level-guide-breadcrumb";
import { OrigamiProductShell } from "@/components/product-shell";
import { LocalizedText } from "@/components/i18n/localized-text";
import { jlptFormats, jlptLevels, type JlptLevel } from "@/lib/jlpt-format";
import type { MessageKey } from "@/lib/i18n";

const levelCopy: Record<JlptLevel, { title: MessageKey; description: MessageKey }> = {
  N1: { title: "levelGuide.copy.n1.title", description: "levelGuide.copy.n1.description" },
  N2: { title: "levelGuide.copy.n2.title", description: "levelGuide.copy.n2.description" },
  N3: { title: "levelGuide.copy.n3.title", description: "levelGuide.copy.n3.description" },
  N4: { title: "levelGuide.copy.n4.title", description: "levelGuide.copy.n4.description" },
  N5: { title: "levelGuide.copy.n5.title", description: "levelGuide.copy.n5.description" },
};

const sectionKeys: Record<string, MessageKey> = {
  "language-knowledge-reading": "format.section.languageKnowledgeReading",
  "grammar-reading": "format.section.grammarReading",
  vocabulary: "format.section.vocabulary",
  listening: "format.section.listening",
};

const categoryKeys: Record<string, MessageKey> = {
  "language-knowledge": "format.category.languageKnowledge",
  reading: "format.category.reading",
  listening: "format.category.listening",
  "language-knowledge-reading": "format.category.languageKnowledgeReading",
};

export async function generateMetadata({ params }: { params: Promise<{ level: string }> }): Promise<Metadata> {
  const { level } = await params;
  const normalizedLevel = level.toUpperCase();
  return {
    title: `${normalizedLevel} JLPT level guide`,
    description: `Review the ${normalizedLevel} JLPT timed test sections and score-report categories.`,
  };
}

export default async function LevelOverviewPage({ params }: { params: Promise<{ level: string }> }) {
  const { level: rawLevel } = await params;
  const level = rawLevel.toUpperCase() as JlptLevel;
  if (!jlptLevels.includes(level)) notFound();

  const format = jlptFormats[level];
  const copy = levelCopy[level];
  const totalMinutes = format.sections.reduce((sum, section) => sum + section.minutes, 0);

  return (
    <OrigamiProductShell>
      <section className="product-hero" data-enter>
        <div className="product-wrap">
          <LevelGuideBreadcrumb level={level} />
          <p className="product-eyebrow"><span aria-hidden="true">✳</span> <LocalizedText messageKey="levelGuide.eyebrow" values={{ level }} /></p>
          <h1><LocalizedText messageKey={copy.title} /></h1>
          <p className="product-lede"><LocalizedText messageKey={copy.description} /></p>
          <div className="level-summary">
            <div><strong>{level}</strong><span><LocalizedText messageKey="levelGuide.level" /></span></div>
            <div><strong>{format.sections.length}</strong><span><LocalizedText messageKey="levelGuide.timedSections" /></span></div>
            <div><strong>{totalMinutes}<small> <LocalizedText messageKey="format.minutes" /></small></strong><span><LocalizedText messageKey="levelGuide.totalTime" /></span></div>
          </div>
        </div>
      </section>

      <section className="product-section">
        <div className="product-wrap">
          <div className="product-section__heading">
            <div><p className="product-eyebrow"><LocalizedText messageKey="levelGuide.format" /></p><h2><LocalizedText messageKey="levelGuide.timedTitle" values={{ level }} /></h2></div>
            <a className="product-text-link" href="https://www.jlpt.jp/e/guideline/testsections.html" target="_blank" rel="noreferrer"><LocalizedText messageKey="levelGuide.officialGuide" /> ↗</a>
          </div>
          <div className="level-section-grid">
            {format.sections.map((section, index) => (
              <article className="level-section-card" key={section.code}>
                <span className="level-section-card__number">0{index + 1}</span>
                <span className="level-section-card__time">{section.minutes}<small> <LocalizedText messageKey="format.minutes" /></small></span>
                <h3><LocalizedText messageKey={sectionKeys[section.code]} /></h3>
                <p><LocalizedText messageKey="levelGuide.scoreReport" /> {section.scoreCategories.map((code, categoryIndex) => (
                  <span key={code}>{categoryIndex > 0 ? " · " : null}<LocalizedText messageKey={categoryKeys[code]} /></span>
                ))}</p>
                <span className="level-section-card__fold" aria-hidden="true" />
              </article>
            ))}
          </div>
          <p className="product-note"><span aria-hidden="true">◎</span> <LocalizedText messageKey="levelGuide.note" /></p>
        </div>
      </section>

      <section className="product-section product-section--tint">
        <div className="product-wrap product-next-step">
          <div>
            <p className="product-eyebrow"><LocalizedText messageKey="levelGuide.nextStep" /></p>
            <h2>{level === "N5" ? <LocalizedText messageKey="levelGuide.n5.nextTitle" /> : <LocalizedText messageKey="levelGuide.other.nextTitle" values={{ level }} />}</h2>
            <p>{level === "N5" ? <LocalizedText messageKey="levelGuide.n5.nextDescription" /> : <LocalizedText messageKey="levelGuide.other.nextDescription" />}</p>
          </div>
          {level === "N5" ? (
            <Link className="product-button" href="/exams/n5/preview"><LocalizedText messageKey="levelGuide.openPreview" /> <span aria-hidden="true">↗</span></Link>
          ) : (
            <Link className="product-button product-button--quiet" href="/levels"><LocalizedText messageKey="levelGuide.compareFormats" /> <span aria-hidden="true">↗</span></Link>
          )}
        </div>
      </section>
    </OrigamiProductShell>
  );
}
