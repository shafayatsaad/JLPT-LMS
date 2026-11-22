import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ProductPage, ProductSection, PaperPanel } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Mistake notebook · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function MistakesPage() {
  const { supabase, user } = await requireSignedInUser("/mistakes");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Mistake notebook" title="Review questions you have missed" description="Sign in after connecting Supabase to load private question-review statistics."><ProductSection title="Supabase setup required"><PaperPanel><p>Copy the Supabase values into <code>.env.local</code> and apply the database migrations.</p><Link className="btn btn--primary" href="/auth/login">Sign in</Link></PaperPanel></ProductSection></ProductPage>;
  }
  const { data: stats, error } = await supabase
    .from("user_question_stats")
    .select("question_id,times_seen,correct_count,last_seen_at")
    .eq("user_id", user.id)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(100);

  return (
    <ProductPage eyebrow="Mistake notebook" title="Return to questions that need work" description="The notebook uses saved question statistics. It does not generate explanations or recommendations at runtime." className="product-page--dashboard">
      <ProductSection title="Question history" className="product-section--tint">
        <PaperPanel className="data-panel">
          {error ? <p className="inline-notice">Question history is not available yet. A complete attempt and review workflow must populate these records first.</p> : stats?.length ? (
            <div className="table-scroll"><table><thead><tr><th>Question</th><th>Seen</th><th>Correct</th><th>Last reviewed</th></tr></thead><tbody>{stats.map((item) => <tr key={item.question_id}><td><code>{item.question_id.slice(0, 8)}</code></td><td>{item.times_seen}</td><td>{item.correct_count}</td><td>{item.last_seen_at ? new Date(item.last_seen_at).toLocaleDateString("en", { timeZone: "UTC" }) : "—"}</td></tr>)}</tbody></table></div>
          ) : <div className="empty-state"><p>No saved mistakes yet. Complete a saved mock attempt to build a personal review list.</p><Link className="text-link" href="/exams/n5/preview">Try the N5 interface preview <ArrowUpRight size={15} aria-hidden="true" /></Link><p className="data-footnote">The preview saves answers in this browser only and does not create question history.</p></div>}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
