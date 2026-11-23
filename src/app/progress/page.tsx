import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LocalizedText } from "@/components/i18n/localized-text";
import { ProgressAttemptsTable } from "@/components/learner-records";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Progress · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const { supabase, user } = await requireSignedInUser("/progress");
  if (!supabase || !user) {
    return (
      <ProductPage eyebrow="Learner workspace" title="Your progress" description="Sign in to view your saved attempt history." eyebrowKey="progress.eyebrow" titleKey="progress.title" descriptionKey="progress.signInDescription">
        <ProductSection title="Account access" titleKey="progress.accountAccess">
          <PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fprogress"><LocalizedText messageKey="progress.signIn" /></Link></PaperPanel>
        </ProductSection>
      </ProductPage>
    );
  }

  const [{ data: attempts, error }, { data: profile }] = await Promise.all([
    supabase.from("exam_attempts").select("id,level,status,created_at,submitted_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("profiles").select("preferred_timezone").eq("user_id", user.id).maybeSingle(),
  ]);
  const completed = (attempts ?? []).filter((attempt) => ["submitted", "expired"].includes(attempt.status));
  const resultQuery = completed.length
    ? await supabase.from("exam_results").select("attempt_id,raw_correct,raw_incorrect,raw_unanswered").in("attempt_id", completed.map((attempt) => attempt.id))
    : { data: [], error: null };
  const timeZone = profile?.preferred_timezone || "UTC";

  return (
    <ProductPage eyebrow="Learner workspace" title="Your progress" description="Review saved attempt status and raw result counts. Trends will become more useful as secure mock exams are published." eyebrowKey="progress.eyebrow" titleKey="progress.title" descriptionKey="progress.description" className="product-page--dashboard">
      <ProductSection title="Attempt history" titleKey="progress.section" className="product-section--tint">
        <PaperPanel className="data-panel">
          {error || resultQuery.error ? <p className="inline-notice"><LocalizedText messageKey="progress.unavailable" /></p> : attempts?.length ? <ProgressAttemptsTable attempts={attempts} results={resultQuery.data ?? []} timeZone={timeZone} /> : <div className="empty-state"><p><LocalizedText messageKey="progress.empty" /></p><Link className="text-link" href="/exams"><LocalizedText messageKey="progress.viewLibrary" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}
          <p className="data-footnote"><LocalizedText messageKey="progress.rawCaveat" /></p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
