import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function Breakdown({ title, value }: { title: string; value: unknown }) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return null;
  return <PaperPanel className="data-panel"><h3>{title}</h3><ul className="record-list">{entries.map(([label, count]) => <li key={label}><span>{label.replaceAll("_", " ")}</span><strong>{count && typeof count === "object" ? Object.entries(count as Record<string, unknown>).map(([metric, amount]) => `${metric}: ${String(amount)}`).join(" · ") : String(count)}</strong></li>)}</ul></PaperPanel>;
}

export default async function AttemptResultsPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const { supabase, user } = await requireSignedInUser(`/results/${attemptId}`);
  if (!supabase || !user) {
    return <ProductPage eyebrow="Mock exam results" title="Your result" description="Connect Supabase and sign in to view a saved attempt result."><ProductSection title="Supabase setup required"><PaperPanel><p>Apply the database migration and sign in to access private results.</p><Link className="btn btn--primary" href="/auth/login">Sign in</Link></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: attempt, error: attemptError } = await supabase.from("exam_attempts").select("id,level,status,started_at,submitted_at").eq("id", attemptId).eq("user_id", user.id).maybeSingle();
  if (!attempt && !attemptError) notFound();
  const { data: result, error: resultError } = attempt
    ? await supabase.from("exam_results").select("raw_correct,raw_incorrect,raw_unanswered,section_breakdown,score_category_breakdown,published_at").eq("attempt_id", attemptId).maybeSingle()
    : { data: null, error: null };

  return (
    <ProductPage eyebrow={`Mock exam result · ${attempt?.level ?? "JLPT"}`} title="Practice result" description="Raw answer counts from a saved attempt. This page does not estimate an official scaled score or pass outcome." className="product-page--dashboard">
      <ProductSection title="Result summary" className="product-section--tint">
        {attemptError ? <PaperPanel><p className="inline-notice">Attempt details could not be loaded. Confirm that the migration is applied and try again.</p></PaperPanel> : !attempt || !["submitted", "expired"].includes(attempt.status) ? <PaperPanel><p>This attempt has not reached a completed state. Answers and answer keys stay unavailable until submission or expiry.</p><Link className="text-link" href="/dashboard">Return to your dashboard <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel> : resultError ? <PaperPanel><p className="inline-notice">The result could not be loaded. Confirm that the results migration and row-level policies are applied.</p></PaperPanel> : !result ? <PaperPanel><p>No result record has been published for this attempt.</p></PaperPanel> : (
          <>
            <div className="result-count-grid">
              <PaperPanel><span>Correct</span><strong>{result.raw_correct}</strong></PaperPanel>
              <PaperPanel><span>Incorrect</span><strong>{result.raw_incorrect}</strong></PaperPanel>
              <PaperPanel><span>Unanswered</span><strong>{result.raw_unanswered}</strong></PaperPanel>
            </div>
            <div className="dashboard-grid dashboard-grid--two result-breakdowns">
              <Breakdown title="Timed sections" value={result.section_breakdown} />
              <Breakdown title="Score categories" value={result.score_category_breakdown} />
            </div>
            <PaperPanel className="result-caveat"><strong>Raw performance only</strong><p>JLPT scaled scores use a scoring method that is not calculated here. These counts do not predict a passing result.</p><Link className="btn btn--primary" href={`/review/${attemptId}`}>Review answers <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel>
          </>
        )}
      </ProductSection>
      <ProductSection title="Attempt details" className="product-section--compact"><PaperPanel className="data-panel"><ul className="record-list"><li><span>Attempt status</span><strong>{attempt?.status ?? "Unavailable"}</strong></li><li><span>Level</span><strong>{attempt?.level ?? "—"}</strong></li><li><span>Submitted</span><strong>{attempt?.submitted_at ? new Date(attempt.submitted_at).toLocaleString("en", { timeZone: "UTC" }) : "—"}</strong></li></ul></PaperPanel></ProductSection>
    </ProductPage>
  );
}
