import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LocalizedText } from "@/components/i18n/localized-text";
import { ExamLibraryCards } from "@/components/learner-records";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Exam library · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function ExamLibraryPage() {
  const { supabase, user } = await requireSignedInUser("/exams");
  if (!supabase || !user) {
    return (
      <ProductPage eyebrow="Learner workspace" title="Exam library" description="Sign in to view the published exam library." eyebrowKey="exams.eyebrow" titleKey="exams.title" descriptionKey="exams.signInDescription">
        <ProductSection title="Account access" titleKey="exams.accountAccess">
          <PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fexams"><LocalizedText messageKey="exams.signIn" /></Link></PaperPanel>
        </ProductSection>
      </ProductPage>
    );
  }

  const [{ data: forms, error }, { data: profile }] = await Promise.all([
    supabase.from("exam_forms").select("id,level,form_code,version,published_at").eq("status", "published").order("published_at", { ascending: false }),
    supabase.from("profiles").select("preferred_timezone").eq("user_id", user.id).maybeSingle(),
  ]);
  const timeZone = profile?.preferred_timezone || "UTC";

  return (
    <ProductPage eyebrow="Learner workspace" title="Exam library" description="Published, reviewed forms available to your account. Access is checked before an attempt starts." eyebrowKey="exams.eyebrow" titleKey="exams.title" descriptionKey="exams.description" className="product-page--dashboard">
      <ProductSection title="Published mock exams" titleKey="exams.section" className="product-section--tint">
        <PaperPanel className="data-panel">
          {error ? <p className="inline-notice"><LocalizedText messageKey="exams.unavailable" /></p> : forms?.length ? <ExamLibraryCards forms={forms} timeZone={timeZone} /> : <div className="empty-state"><p><LocalizedText messageKey="exams.empty" /></p><p><LocalizedText messageKey="exams.previewDescription" /></p><Link className="text-link" href="/exams/n5/preview"><LocalizedText messageKey="exams.openPreview" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
