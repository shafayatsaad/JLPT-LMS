import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ActiveExamSession, type ExamAttemptPayload } from "@/components/active-exam-session";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return { title: `Exam attempt ${attemptId.slice(0, 8)} · JLPT practice` };
}

export default async function ActiveExamPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const { supabase, user } = await requireSignedInUser(`/attempts/${attemptId}`);
  if (!supabase || !user) {
    return <ProductPage eyebrow="Exam workspace" title="Open your exam attempt" description="Connect Supabase and sign in to resume an exam attempt."><ProductSection title="Account access"><PaperPanel><Link className="btn btn--primary" href={`/auth/login?next=${encodeURIComponent(`/attempts/${attemptId}`)}`}>Sign in</Link></PaperPanel></ProductSection></ProductPage>;
  }

  const { data, error } = await supabase.rpc("get_exam_attempt_payload", { p_attempt_id: attemptId });
  if (error || !data) {
    return <ProductPage eyebrow="Exam workspace" title="Attempt unavailable" description="This attempt could not be loaded. It may not belong to your account, or the exam lifecycle migration may not be applied yet."><ProductSection title="Return to your workspace"><PaperPanel><p>The active exam route uses database permissions and does not expose another learner’s attempt.</p><Link className="btn btn--secondary" href="/exams">Return to the exam library</Link></PaperPanel></ProductSection></ProductPage>;
  }

  const payload = data as ExamAttemptPayload;
  if (["submitted", "expired"].includes(payload.attempt.status)) redirect(`/results/${attemptId}`);
  return <ActiveExamSession initialPayload={payload} />;
}
