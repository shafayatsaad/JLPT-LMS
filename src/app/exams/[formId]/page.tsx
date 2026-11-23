import { notFound } from "next/navigation";
import Link from "next/link";
import { LocalizedText } from "@/components/i18n/localized-text";
import { ExamPublicationInfo } from "@/components/learner-records";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { StartExamButton } from "@/components/start-exam-button";
import { requireSignedInUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  return { title: `Mock exam ${formId.slice(0, 8)} · JLPT practice` };
}

export default async function ExamDetailsPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  const { supabase, user } = await requireSignedInUser(`/exams/${formId}`);
  if (!supabase || !user) {
    return (
      <ProductPage eyebrow="Learner workspace" title="Exam details unavailable" description="Sign in before opening a published exam form." eyebrowKey="exams.eyebrow" titleKey="examDetails.unavailableTitle" descriptionKey="examDetails.signInDescription">
        <ProductSection title="Account access" titleKey="exams.accountAccess">
          <PaperPanel><Link className="btn btn--primary" href={`/auth/login?next=${encodeURIComponent(`/exams/${formId}`)}`}><LocalizedText messageKey="exams.signIn" /></Link></PaperPanel>
        </ProductSection>
      </ProductPage>
    );
  }

  const [{ data: form, error }, { data: profile }] = await Promise.all([
    supabase.from("exam_forms").select("id,level,form_code,version,published_at,access_tier").eq("id", formId).eq("status", "published").maybeSingle(),
    supabase.from("profiles").select("preferred_timezone").eq("user_id", user.id).maybeSingle(),
  ]);
  if (error || !form) notFound();

  const { data: activeAttempt } = await supabase.from("exam_attempts").select("id").eq("user_id", user.id).eq("exam_form_id", formId).eq("status", "in_progress").maybeSingle();
  const timeZone = profile?.preferred_timezone || "UTC";

  return (
    <ProductPage eyebrow="Published mock form" title={form.form_code} description="This is a reviewed, fixed mock form. Your exam time and saved answers are managed by the server." eyebrowKey="examDetails.eyebrow" descriptionKey="examDetails.description" className="product-page--dashboard">
      <ProductSection title="Before you start" titleKey="examDetails.beforeStart" className="product-section--tint">
        <PaperPanel className="statement-panel">
          <p><LocalizedText messageKey="examDetails.version" values={{ version: form.version }} /></p>
          <p><LocalizedText messageKey="examDetails.behavior" /></p>
          <ExamPublicationInfo accessTier={form.access_tier} publishedAt={form.published_at} timeZone={timeZone} />
          <StartExamButton examFormId={form.id} activeAttemptId={activeAttempt?.id ?? null} />
          <p><Link className="text-link" href="/exams"><LocalizedText messageKey="examDetails.returnLibrary" /></Link></p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
