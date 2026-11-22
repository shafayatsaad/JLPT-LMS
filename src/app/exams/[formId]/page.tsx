import { notFound } from "next/navigation";
import Link from "next/link";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";
import { StartExamButton } from "@/components/start-exam-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  return { title: `Mock exam ${formId.slice(0, 8)} · JLPT practice` };
}

export default async function ExamDetailsPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  const { supabase, user } = await requireSignedInUser(`/exams/${formId}`);
  if (!supabase || !user) return <ProductPage eyebrow="Learner workspace" title="Exam details unavailable" description="Configure Supabase before opening a published exam form."><ProductSection title="Setup required"><PaperPanel><p>Connect the app to Supabase, then return to the exam library.</p></PaperPanel></ProductSection></ProductPage>;
  const { data: form, error } = await supabase.from("exam_forms").select("id,level,form_code,version,published_at,access_tier").eq("id", formId).eq("status", "published").maybeSingle();
  if (error || !form) notFound();
  const { data: activeAttempt } = await supabase.from("exam_attempts").select("id").eq("user_id", user.id).eq("exam_form_id", formId).eq("status", "in_progress").maybeSingle();

  return (
    <ProductPage eyebrow={`JLPT ${form.level} · published form`} title={form.form_code} description={`Version ${form.version}. Published forms are fixed so every learner sees the reviewed question set.`} className="product-page--dashboard">
      <ProductSection title="Before you start" className="product-section--tint">
        <PaperPanel className="statement-panel"><p>Published forms use server-timed sections, save answers to your account and reveal explanations only after submission.</p><p>Access: {form.access_tier === "free" ? "Free sample" : "Premium"} · Published {form.published_at ? new Date(form.published_at).toLocaleDateString("en", { dateStyle: "long", timeZone: "UTC" }) : "date unavailable"}</p><StartExamButton examFormId={form.id} activeAttemptId={activeAttempt?.id ?? null} /><p><Link className="text-link" href="/exams">Return to exam library</Link></p></PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
