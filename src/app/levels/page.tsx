import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { jlptFormats, jlptLevels } from "@/lib/jlpt-format";

export const metadata: Metadata = {
  title: "JLPT levels N1–N5 | JLPT practice",
  description: "Compare the JLPT N1 through N5 test sections, timings, and score-report categories.",
};

const descriptions = {
  N1: "For advanced Japanese learners working toward broad, fluent comprehension.",
  N2: "For learners developing the Japanese needed in everyday and professional settings.",
  N3: "A bridge between foundational Japanese and independent comprehension.",
  N4: "For learners who can understand basic Japanese in familiar situations.",
  N5: "An introduction to basic Japanese reading, language knowledge, and listening.",
} as const;

export default function LevelsPage() {
  return (
    <ProductPage
      eyebrow="JLPT level guides"
      title="Find your level"
      description="Compare the five JLPT levels, their timed sections, and score-report categories before choosing where to begin."
      className="product-page--editorial"
    >
      <ProductSection title="Explore N1 through N5" className="product-section--tint">
        <div className="level-directory-grid">
          {jlptLevels.map((level) => {
            const format = jlptFormats[level];
            const totalMinutes = format.sections.reduce((total, section) => total + section.minutes, 0);

            return (
              <PaperPanel className="level-directory-card" key={level}>
                <div className="level-directory-card__top">
                  <span>JLPT LEVEL</span>
                  <strong>{level}</strong>
                </div>
                <h3>{descriptions[level]}</h3>
                <div className="level-directory-card__meta">
                  <span>{format.sections.length} timed sections</span>
                  <span>{totalMinutes} minutes</span>
                </div>
                <p className="level-directory-card__categories">
                  {format.scoreCategories.map((category) => category.label).join(" · ")}
                </p>
                <Link className="product-text-link" href={`/levels/${level.toLowerCase()}`}>
                  Explore {level} guide <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
                {level === "N5" ? (
                  <Link className="product-text-link level-directory-card__preview" href="/exams/n5/preview">
                    Try the browser-only N5 interface preview <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                ) : null}
              </PaperPanel>
            );
          })}
        </div>
        <p className="product-note"><span aria-hidden="true">◎</span> Mock results show raw platform performance and are not official JLPT scaled scores. Published papers depend on original content passing review.</p>
      </ProductSection>
    </ProductPage>
  );
}
