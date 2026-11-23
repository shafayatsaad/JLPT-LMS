import Link from "next/link";
import { QuestionAuthoringForm } from "@/components/admin/question-authoring-form";
import { QuestionBatchImport } from "@/components/admin/question-batch-import";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Question authoring and import · Administration" };

export default async function AdminQuestionAuthoringPage() {
  const { supabase } = await requireStaff(["content_editor", "admin"], "/admin/questions/new");
  if (!supabase) {
    return <ProductPage eyebrow="Staff workspace" title="Question authoring unavailable" description="Connect Supabase and sign in with an editor or administrator account."><ProductSection title="Setup required"><PaperPanel><p>Apply the reconciled authoring migrations before creating question drafts.</p></PaperPanel></ProductSection></ProductPage>;
  }
  return (
    <ProductPage eyebrow="Staff workspace · editor/admin" title="Question authoring and import" description="Create original question drafts, document source rights and send revisions through independent review." className="product-page--admin">
      <ProductSection title="Create a question draft" className="product-section--tint"><PaperPanel className="data-panel"><p><Link className="text-link" href="/admin/questions">← Back to question bank</Link></p><QuestionAuthoringForm /></PaperPanel></ProductSection>
      <ProductSection title="Import a small JSON batch"><PaperPanel className="data-panel"><QuestionBatchImport /></PaperPanel></ProductSection>
    </ProductPage>
  );
}
