import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LocalizedText } from "@/components/i18n/localized-text";
import { ExamLibraryCards } from "@/components/learner-records";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Exam library · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function ExamLibraryPage({ searchParams }: { searchParams: Promise<{ level?: string | string[] }> }) {
  const params = await searchParams;
  const requestedLevel = Array.isArray(params.level) ? params.level[0] : params.level;
  const level = ["N1", "N2", "N3", "N4", "N5"].includes(requestedLevel ?? "") ? requestedLevel : "";
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

  let formsQuery = supabase.from("exam_forms").select("id,level,form_code,version,published_at,access_tier").eq("status", "published").order("published_at", { ascending: false });
  if (level) formsQuery = formsQuery.eq("level", level);
  const [{ data: forms, error }, { data: profile }] = await Promise.all([
    formsQuery,
    supabase.from("profiles").select("preferred_timezone").eq("user_id", user.id).maybeSingle(),
  ]);
  const timeZone = profile?.preferred_timezone || "UTC";

  return (
    <ProductPage eyebrow="Learner workspace" title="Exam library" description="Published, reviewed forms available to your account. Access is checked before an attempt starts." eyebrowKey="exams.eyebrow" titleKey="exams.title" descriptionKey="exams.description" className="product-page--dashboard">
      <ProductSection title="Published mock exams" titleKey="exams.section" className="product-section--tint">
        <PaperPanel className="data-panel">
          <form className="admin-export-form exam-library-filter" method="get"><label><LocalizedText messageKey="exams.levelFilter" /><select name="level" defaultValue={level}><option value=""><LocalizedText messageKey="exams.allLevels" /></option>{["N1", "N2", "N3", "N4", "N5"].map((item) => <option value={item} key={item}>{item}</option>)}</select></label><button className="btn btn--secondary" type="submit"><LocalizedText messageKey="exams.applyLevelFilter" /></button></form>
          {error ? <p className="inline-notice"><LocalizedText messageKey="exams.unavailable" /></p> : forms?.length ? <><ExamLibraryCards forms={forms} timeZone={timeZone} /><p className="data-footnote"><LocalizedText messageKey="exams.accessDetails" /></p></> : <div className="empty-state"><p><LocalizedText messageKey="exams.empty" />{level ? ` · ${level}` : ""}</p><p><LocalizedText messageKey="exams.previewDescription" /></p><Link className="text-link" href="/exams/n5/preview"><LocalizedText messageKey="exams.openPreview" /> <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
