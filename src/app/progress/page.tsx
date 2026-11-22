import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Progress · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const { supabase, user } = await requireSignedInUser("/progress");
  if (!supabase || !user) return <ProductPage eyebrow="Learner workspace" title="Your progress" description="Configure Supabase and sign in to view saved attempt history."><ProductSection title="Account access"><PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fprogress">Sign in</Link></PaperPanel></ProductSection></ProductPage>;
  const { data: attempts, error } = await supabase.from("exam_attempts").select("id,level,status,created_at,submitted_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  const completed = (attempts ?? []).filter((attempt) => ["submitted", "expired"].includes(attempt.status));
  const resultQuery = completed.length
    ? await supabase.from("exam_results").select("attempt_id,raw_correct,raw_incorrect,raw_unanswered").in("attempt_id", completed.map((attempt) => attempt.id))
    : { data: [], error: null };
  const resultByAttempt = new Map((resultQuery.data ?? []).map((result) => [result.attempt_id, result]));

  return (
    <ProductPage eyebrow="Learner workspace" title="Your progress" description="Review saved attempt status and raw result counts. Trends will become more useful as secure mock exams are published." className="product-page--dashboard">
      <ProductSection title="Attempt history" className="product-section--tint">
        <PaperPanel className="data-panel">
          {error ? <p className="inline-notice">Attempt history is unavailable until the platform schema is applied.</p> : attempts?.length ? <div className="table-scroll"><table><thead><tr><th>Level</th><th>Status</th><th>Started</th><th>Raw counts</th><th></th></tr></thead><tbody>{attempts.map((attempt) => { const result = resultByAttempt.get(attempt.id); return <tr key={attempt.id}><td>{attempt.level}</td><td><span className="status-chip">{attempt.status.replaceAll("_", " ")}</span></td><td>{new Date(attempt.created_at).toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" })}</td><td>{result ? `${result.raw_correct} correct · ${result.raw_incorrect} incorrect · ${result.raw_unanswered} unanswered` : "—"}</td><td>{result ? <Link className="text-link" href={`/results/${attempt.id}`}>Open result <ArrowUpRight size={14} aria-hidden="true" /></Link> : ""}</td></tr>; })}</tbody></table></div> : <div className="empty-state"><p>No saved exam attempts yet.</p><Link className="text-link" href="/exams">View the exam library <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}
          <p className="data-footnote">These are raw question counts. They are not official JLPT scaled scores or pass predictions.</p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
