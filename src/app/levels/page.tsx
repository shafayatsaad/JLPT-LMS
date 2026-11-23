import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { LocalizedText } from "@/components/i18n/localized-text";
import { jlptFormats, jlptLevels, type JlptLevel, type ScoreCategoryCode } from "@/lib/jlpt-format";
import type { MessageKey } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "JLPT levels N1–N5 | JLPT practice",
  description: "Compare the JLPT N1 through N5 test sections, timings, and score-report categories.",
};

const descriptions: Record<JlptLevel, MessageKey> = {
  N1: "levels.description.n1",
  N2: "levels.description.n2",
  N3: "levels.description.n3",
  N4: "levels.description.n4",
  N5: "levels.description.n5",
};

const categoryKeys: Record<ScoreCategoryCode, MessageKey> = {
  "language-knowledge": "format.category.languageKnowledge",
  reading: "format.category.reading",
  listening: "format.category.listening",
  "language-knowledge-reading": "format.category.languageKnowledgeReading",
};

export default function LevelsPage() {
  return (
    <ProductPage
      eyebrow="JLPT level guides" eyebrowKey="levels.eyebrow"
      title="Find your level" titleKey="levels.title"
      description="Compare the five JLPT levels, their timed sections, and score-report categories before choosing where to begin." descriptionKey="levels.description"
      className="product-page--editorial"
    >
      <ProductSection title="Explore N1 through N5" titleKey="levels.section.explore" className="product-section--tint">
        <div className="level-directory-grid">
          {jlptLevels.map((level) => {
            const format = jlptFormats[level];
            const totalMinutes = format.sections.reduce((total, section) => total + section.minutes, 0);

            return (
              <PaperPanel className="level-directory-card" key={level}>
                <div className="level-directory-card__top">
                  <span><LocalizedText messageKey="levels.card.label" /></span>
                  <strong>{level}</strong>
                </div>
                <h3><LocalizedText messageKey={descriptions[level]} /></h3>
                <div className="level-directory-card__meta">
                  <span>{format.sections.length} <LocalizedText messageKey="levels.card.timedSections" /></span>
                  <span>{totalMinutes} <LocalizedText messageKey="levels.card.minutes" /></span>
                </div>
                <p className="level-directory-card__categories">
                  {format.scoreCategories.map((category, index) => (
                    <span key={category.code}>{index > 0 ? " · " : null}<LocalizedText messageKey={categoryKeys[category.code]} /></span>
                  ))}
                </p>
                <Link className="product-text-link" href={`/levels/${level.toLowerCase()}`}>
                  <LocalizedText messageKey="levels.card.explore" values={{ level }} /> <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
                {level === "N5" ? (
                  <Link className="product-text-link level-directory-card__preview" href="/exams/n5/preview">
                    <LocalizedText messageKey="levels.card.preview" /> <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                ) : null}
              </PaperPanel>
            );
          })}
        </div>
        <p className="product-note"><span aria-hidden="true">◎</span> <LocalizedText messageKey="levels.note" /></p>
      </ProductSection>
    </ProductPage>
  );
}
