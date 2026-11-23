import Link from "next/link";
import { notFound } from "next/navigation";
import { QuestionDraftEditor } from "@/components/admin/question-draft-editor";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Question = {
  id: string;
  content_key: string;
  revision: number;
  level: "N1" | "N2" | "N3" | "N4" | "N5";
  test_section_code: string;
  score_category_code: string;
  item_type_code: string;
  difficulty_estimate: number | null;
  prompt: unknown;
  options: unknown;
  status: string;
  authored_by: string;
  created_at: string;
  source_type: string;
  source_reference: string | null;
  rights_notes: string | null;
};

type AnswerKey = { correct_option_id: string; explanation: unknown; distractor_rationales: unknown };

function contentText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(contentText).join("");
  if (!value || typeof value !== "object") return "";
  const block = value as Record<string, unknown>;
  if (block.type === "line_break") return "\n";
  if (block.type === "ruby") return `${contentText(block.base ?? block.text)}（${contentText(block.reading ?? block.rt)}）`;
  if ("content" in block) return contentText(block.content);
  if ("text" in block) return contentText(block.text);
  if ("value" in block) return contentText(block.value);
  return "";
}

function prettyDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export async function generateMetadata({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params;
  return { title: `Question ${questionId.slice(0, 8)} · Administration` };
}

export default async function AdminQuestionDetailPage({ params }: { params: Promise<{ questionId: string }> }) {
  const { questionId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(questionId)) notFound();
  const { supabase, user, role } = await requireStaff(["content_editor", "reviewer", "admin"], `/admin/questions/${questionId}`);
  if (!supabase || !user) {
    return <ProductPage eyebrow="Staff workspace" title="Question revision unavailable" description="Connect Supabase and sign in with an authorized editor or reviewer account."><ProductSection title="Setup required"><PaperPanel><p>Question details require the content workflow to be configured.</p></PaperPanel></ProductSection></ProductPage>;
  }
  const [{ data: questionData, error }, { data: roleRows }] = await Promise.all([
    supabase.from("questions").select("id,content_key,revision,level,test_section_code,score_category_code,item_type_code,difficulty_estimate,prompt,options,status,authored_by,created_at,source_type,source_reference,rights_notes").eq("id", questionId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  if (!questionData && !error) notFound();
  const question = questionData as Question | null;
  const isAdmin = roleRows?.some((row) => row.role === "admin") ?? false;
  const canEdit = question?.status === "draft" && (isAdmin || (role === "content_editor" && question.authored_by === user.id));
  let editData: { question: Question; answer_key: AnswerKey } | null = null;
  let editError = false;
  if (canEdit) {
    const result = await supabase.rpc("get_question_draft_for_edit", { p_question_id: questionId });
    if (result.error || !result.data || typeof result.data !== "object") editError = true;
    else editData = result.data as unknown as { question: Question; answer_key: AnswerKey };
  }

  return (
    <ProductPage eyebrow="Staff workspace · question bank" title={`Question revision ${question?.revision ?? ""}`} description="Review the authored prompt and choices, provenance, status and permitted draft actions." className="product-page--admin">
      <ProductSection title="Question preview" className="product-section--tint">
        <PaperPanel className="data-panel">
          <p><Link className="text-link" href="/admin/questions">← Back to question bank</Link></p>
          {error || !question ? <p className="inline-notice">This revision is unavailable to your account, or the database migration is missing.</p> : <>
            <div className="integration-checks">
              <div><span>Level and revision</span><strong>{question.level} · {question.revision}</strong></div>
              <div><span>Status</span><strong>{question.status.replaceAll("_", " ")}</strong></div>
              <div><span>Section and category</span><strong>{question.test_section_code} · {question.score_category_code}</strong></div>
              <div><span>Item type</span><strong>{question.item_type_code}</strong></div>
              <div><span>Content family</span><strong><code>{question.content_key}</code></strong></div>
              <div><span>Created</span><strong>{prettyDate(question.created_at)}</strong></div>
            </div>
            <div className="review-queue__content" lang="ja"><strong>Prompt</strong><p className="question-draft-preview">{contentText(question.prompt)}</p><strong>Options</strong><ol type="A">{(Array.isArray(question.options) ? question.options : []).map((option, index) => { const item = option as Record<string, unknown>; return <li key={`${question.id}-option-${index}`}><span>{contentText(item.content ?? item.text)}</span><code>{String(item.id ?? "")}</code></li>; })}</ol></div>
            <div className="review-queue__provenance"><strong>Source: {question.source_type.replaceAll("_", " ")}</strong><p>Reference: {question.source_reference || "Original content"}</p><p>Rights notes: {question.rights_notes || "Authored as original platform content"}</p><p>Author account: <code>{question.authored_by}</code></p></div>
            {question.status === "needs_review" && (role === "reviewer" || isAdmin) ? <p><Link className="btn btn--primary" href="/admin/reviews">Open reviewer queue</Link></p> : null}
            {question.status !== "draft" ? <p className="section-note">This revision is no longer editable. Create a new revision if its published content needs a correction.</p> : null}
            {canEdit ? editError || !editData ? <p className="inline-notice">Draft editing is unavailable. Confirm migration 028 and the author/admin permission.</p> : <><h2>Edit draft</h2><QuestionDraftEditor question={editData.question} answerKey={editData.answer_key} /></> : null}
          </>}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
