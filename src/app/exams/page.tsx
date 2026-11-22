import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser } from "@/lib/auth";

export const metadata = { title: "Exam library · JLPT practice" };
export const dynamic = "force-dynamic";

export default async function ExamLibraryPage() {
  const { supabase, user } = await requireSignedInUser("/exams");
  if (!supabase || !user) return <ProductPage eyebrow="Learner workspace" title="Exam library" description="Configure Supabase and sign in to view the published exam library."><ProductSection title="Account access"><PaperPanel><Link className="btn btn--primary" href="/auth/login?next=%2Fexams">Sign in</Link></PaperPanel></ProductSection></ProductPage>;

  const { data: forms, error } = await supabase
    .from("exam_forms")
    .select("id,level,form_code,version,published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (
    <ProductPage eyebrow="Learner workspace" title="Exam library" description="Published, reviewed forms available to your account. Your access is checked by Supabase before an attempt starts." className="product-page--dashboard">
      <ProductSection title="Published mock exams" className="product-section--tint">
        <PaperPanel className="data-panel">
          {error ? <p className="inline-notice">The exam library is unavailable. Apply the Supabase migrations and confirm database permissions.</p> : forms?.length ? (
            <div className="exam-library-grid">{forms.map((form) => <article className="exam-library-card" key={form.id}><span className="product-small-label">JLPT {form.level} · Form {form.version}</span><h3>{form.form_code}</h3><p>{form.published_at ? `Published ${new Date(form.published_at).toLocaleDateString("en", { dateStyle: "medium", timeZone: "UTC" })}` : "Published form"}</p><Link className="text-link" href={`/exams/${form.id}`}>View exam details <ArrowUpRight size={15} aria-hidden="true" /></Link></article>)}</div>
          ) : <div className="empty-state"><p>No mock exams have been published yet.</p><p>The N5 exam interface remains available as a local preview.</p><Link className="text-link" href="/exams/n5/preview">Open N5 preview <ArrowUpRight size={15} aria-hidden="true" /></Link></div>}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
