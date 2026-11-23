import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { LocalizedText } from "@/components/i18n/localized-text";
import type { MessageKey } from "@/lib/i18n";
import { requireSignedInUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function breakdownMessageKey(value: string): MessageKey | null {
  const normalized = value.toLowerCase().replaceAll("_", "-");
  const labels: Record<string, MessageKey> = {
    "language-knowledge": "results.languageKnowledge",
    "language-knowledge-reading": "results.languageKnowledgeReading",
    reading: "results.reading",
    listening: "results.listening",
    vocabulary: "exam.section.vocabulary",
    grammar: "exam.section.grammar",
    "grammar-reading": "exam.section.grammar_reading",
    "language-knowledge-vocabulary": "exam.section.language_knowledge_vocabulary",
    "language-knowledge-grammar-reading": "exam.section.language_knowledge_grammar_reading",
    correct: "results.correct",
    "raw-correct": "results.correct",
    incorrect: "results.incorrect",
    "raw-incorrect": "results.incorrect",
    unanswered: "results.unanswered",
    "raw-unanswered": "results.unanswered",
    questions: "results.questions",
    total: "results.questions",
  };
  return labels[normalized] ?? null;
}

function Breakdown({ titleKey, value }: { titleKey: MessageKey; value: unknown }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return null;
  return <PaperPanel className="data-panel"><h3><LocalizedText messageKey={titleKey} /></h3><ul className="record-list">{entries.map(([label, count]) => { const labelKey = breakdownMessageKey(label); return <li key={label}><span>{labelKey ? <LocalizedText messageKey={labelKey} /> : label.replaceAll("_", " ")}</span><strong>{count && typeof count === "object" ? Object.entries(count as Record<string, unknown>).map(([metric, amount], index) => { const metricKey = breakdownMessageKey(metric); return <span key={metric}>{index ? " · " : ""}{metricKey ? <LocalizedText messageKey={metricKey} /> : metric}: {String(amount)}</span>; }) : String(count)}</strong></li>; })}</ul></PaperPanel>;
}

export default async function AttemptResultsPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const { supabase, user } = await requireSignedInUser(`/results/${attemptId}`);
  if (!supabase || !user) {
    return <ProductPage eyebrow="Mock exam results" eyebrowKey="results.eyebrow" title="Your result" titleKey="results.title" description="Connect Supabase and sign in to view a saved attempt result." descriptionKey="results.description"><ProductSection title="Supabase setup required" titleKey="results.setupTitle"><PaperPanel><p><LocalizedText messageKey="results.setupMessage" /></p><Link className="btn btn--primary" href="/auth/login"><LocalizedText messageKey="results.signIn" /></Link></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: attempt, error: attemptError } = await supabase.from("exam_attempts").select("id,level,status,started_at,submitted_at").eq("id", attemptId).eq("user_id", user.id).maybeSingle();
  if (!attempt && !attemptError) notFound();
  const { data: result, error: resultError } = attempt
    ? await supabase.from("exam_results").select("raw_correct,raw_incorrect,raw_unanswered,section_breakdown,score_category_breakdown,published_at").eq("attempt_id", attemptId).maybeSingle()
    : { data: null, error: null };

  return (
    <ProductPage eyebrow="Mock exam results" eyebrowKey="results.eyebrow" title="Practice result" titleKey="results.title" description="Raw answer counts from a saved attempt. This page does not estimate an official scaled score or pass outcome." descriptionKey="results.description" className="product-page--dashboard">
      <ProductSection title="Result summary" titleKey="results.summary" className="product-section--tint">
        {attemptError ? <PaperPanel><p className="inline-notice"><LocalizedText messageKey="results.attemptError" /></p></PaperPanel> : !attempt || !["submitted", "expired"].includes(attempt.status) ? <PaperPanel><p><LocalizedText messageKey="results.notComplete" /></p><Link className="text-link" href="/dashboard"><LocalizedText messageKey="results.returnDashboard" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel> : resultError ? <PaperPanel><p className="inline-notice"><LocalizedText messageKey="results.loadError" /></p></PaperPanel> : !result ? <PaperPanel><p><LocalizedText messageKey="results.noRecord" /></p></PaperPanel> : (
          <>
            <div className="result-count-grid">
              <PaperPanel><span><LocalizedText messageKey="results.correct" /></span><strong>{result.raw_correct}</strong></PaperPanel>
              <PaperPanel><span><LocalizedText messageKey="results.incorrect" /></span><strong>{result.raw_incorrect}</strong></PaperPanel>
              <PaperPanel><span><LocalizedText messageKey="results.unanswered" /></span><strong>{result.raw_unanswered}</strong></PaperPanel>
            </div>
            <div className="dashboard-grid dashboard-grid--two result-breakdowns">
              <Breakdown titleKey="results.sections" value={result.section_breakdown} />
              <Breakdown titleKey="results.categories" value={result.score_category_breakdown} />
            </div>
            <PaperPanel className="result-caveat"><strong><LocalizedText messageKey="results.caveatTitle" /></strong><p><LocalizedText messageKey="results.caveatBody" /></p><Link className="btn btn--primary" href={`/review/${attemptId}`}><LocalizedText messageKey="results.reviewAnswers" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
          </>
        )}
      </ProductSection>
      <ProductSection title="Attempt details" titleKey="results.attemptDetails" className="product-section--compact"><PaperPanel className="data-panel"><ul className="record-list"><li><span><LocalizedText messageKey="results.status" /></span><strong>{attempt ? <LocalizedText messageKey={attempt.status === "submitted" ? "common.submitted" : attempt.status === "expired" ? "common.expired" : "common.inProgress"} /> : <LocalizedText messageKey="results.unavailable" />}</strong></li><li><span><LocalizedText messageKey="results.level" /></span><strong>{attempt?.level ?? "—"}</strong></li><li><span><LocalizedText messageKey="results.submitted" /></span><strong>{attempt?.submitted_at ? new Date(attempt.submitted_at).toLocaleString("en", { timeZone: "UTC" }) : "—"}</strong></li></ul></PaperPanel></ProductSection>
    </ProductPage>
  );
}
