import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { OrigamiProductShell } from "@/components/product-shell";
import { jlptFormats, jlptLevels, type JlptLevel } from "@/lib/jlpt-format";

const levelCopy: Record<JlptLevel, { title: string; description: string }> = {
  N1: { title: "Refine your advanced Japanese", description: "Review the N1 timed test structure and the score categories reported after the official test." },
  N2: { title: "Build consistency at N2", description: "See how N2 combines language knowledge and reading in a timed section, followed by listening." },
  N3: { title: "Make the move to independent Japanese", description: "Explore the three N3 timed sections and how they map to reported score categories." },
  N4: { title: "Strengthen your everyday Japanese", description: "Review the N4 section timings and the combined language knowledge and reading score category." },
  N5: { title: "Begin with the N5 format", description: "Get familiar with the N5 timed sections, then explore an interface preview built around two original sample questions." },
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
  const categories = new Map(format.scoreCategories.map((category) => [category.code, category.label]));

  return (
    <OrigamiProductShell>
      <section className="product-hero" data-enter>
        <div className="product-wrap">
          <nav className="product-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/levels">All levels</Link><span aria-hidden="true">/</span><span>{level} guide</span></nav>
          <p className="product-eyebrow"><span aria-hidden="true">✳</span> Level guide · {level}</p>
          <h1>{copy.title}</h1>
          <p className="product-lede">{copy.description}</p>
          <div className="level-summary">
            <div><strong>{level}</strong><span>JLPT level</span></div>
            <div><strong>{format.sections.length}</strong><span>timed sections</span></div>
            <div><strong>{totalMinutes}<small> min</small></strong><span>total section time</span></div>
          </div>
        </div>
      </section>

      <section className="product-section">
        <div className="product-wrap">
          <div className="product-section__heading">
            <div><p className="product-eyebrow">Test format</p><h2>{level} timed sections</h2></div>
            <a className="product-text-link" href="https://www.jlpt.jp/e/guideline/testsections.html" target="_blank" rel="noreferrer">Official JLPT section guide ↗</a>
          </div>
          <div className="level-section-grid">
            {format.sections.map((section, index) => (
              <article className="level-section-card" key={section.code}>
                <span className="level-section-card__number">0{index + 1}</span>
                <span className="level-section-card__time">{section.minutes}<small> min</small></span>
                <h3>{section.label}</h3>
                <p>Score report: {section.scoreCategories.map((code) => categories.get(code)).join(" · ")}</p>
                <span className="level-section-card__fold" aria-hidden="true" />
              </article>
            ))}
          </div>
          <p className="product-note"><span aria-hidden="true">◎</span> Timed test sections and score-report categories are different parts of the JLPT format. Platform practice results use raw performance and are not official scaled scores.</p>
        </div>
      </section>

      <section className="product-section product-section--tint">
        <div className="product-wrap product-next-step">
          <div>
            <p className="product-eyebrow">Next step</p>
            <h2>{level === "N5" ? "Explore the N5 exam interface" : `Explore the ${level} format`}</h2>
            <p>{level === "N5" ? "The preview shows the instructions, question workspace, a sample result and answer review. It does not create a real attempt." : "Reviewed mock papers will appear here after they are prepared and published."}</p>
          </div>
          {level === "N5" ? (
            <Link className="product-button" href="/exams/n5/preview">Open N5 interface preview <span aria-hidden="true">↗</span></Link>
          ) : (
            <Link className="product-button product-button--quiet" href="/levels">Compare all five formats <span aria-hidden="true">↗</span></Link>
          )}
        </div>
      </section>
    </OrigamiProductShell>
  );
}
