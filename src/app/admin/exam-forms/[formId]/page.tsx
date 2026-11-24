import Link from "next/link";
import { notFound } from "next/navigation";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

type FormRow = {
  id: string;
  blueprint_id: string;
  level: string;
  form_code: string;
  version: number;
  status: string;
  assembly_seed: string | null;
  manifest: unknown;
  is_frozen: boolean;
  published_at: string | null;
  created_by: string;
  created_at: string;
};

type FormItem = { id: string; exam_form_id: string; question_id: string; position: number; group_position: number | null };
type Question = { id: string; level: string; test_section_code: string; score_category_code: string; item_type_code: string; status: string };

function dateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date);
}

export async function generateMetadata({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  return { title: `Exam form ${formId.slice(0, 8)} · Administration` };
}

export default async function AdminExamFormDetailPage({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(formId)) notFound();
  const { supabase } = await requireStaff(["content_editor", "reviewer", "admin"], `/admin/exam-forms/${formId}`);
  if (!supabase) {
    return <ProductPage eyebrow="Staff workspace" title="Exam form details unavailable" description="Connect Supabase and sign in with an authorized editor or reviewer account."><ProductSection title="Setup required"><PaperPanel><p>Apply the platform migrations before opening an exam form manifest.</p></PaperPanel></ProductSection></ProductPage>;
  }

  const { data, error } = await supabase.from("exam_forms")
    .select("id,blueprint_id,level,form_code,version,status,assembly_seed,manifest,is_frozen,published_at,created_by,created_at")
    .eq("id", formId)
    .maybeSingle();
  if (!data && !error) notFound();
  const form = data as FormRow | null;
  const { data: itemData, error: itemError } = form
    ? await supabase.from("exam_form_items").select("id,exam_form_id,question_id,position,group_position").eq("exam_form_id", form.id).order("position")
    : { data: null, error: null };
  const items = (itemData ?? []) as FormItem[];
  const { data: questionData, error: questionError } = items.length
    ? await supabase.from("questions").select("id,level,test_section_code,score_category_code,item_type_code,status").in("id", items.map((item) => item.question_id))
    : { data: [], error: null };
  const questions = new Map(((questionData ?? []) as Question[]).map((question) => [question.id, question]));
  const { data: slotData } = form
    ? await supabase.from("blueprint_slots").select("slot_order,test_section_code,score_category_code,item_type_code,question_quota,required_asset_types").eq("blueprint_id", form.blueprint_id).order("slot_order")
    : { data: null };

  return (
    <ProductPage eyebrow="Staff workspace · editor/reviewer" title={form?.form_code ?? "Exam form"} description="Inspect a form manifest and its selected question revisions. Published forms are frozen; changes require a new version and independent review." className="product-page--admin" navigation={<AdminNavigation activePath={`/admin/exam-forms/${formId}`} currentTitle="Exam form details" />}>
      <ProductSection title="Form manifest" className="product-section--tint">
        <PaperPanel className="data-panel">
          <p><Link className="text-link" href="/admin/exam-forms">← Back to exam forms</Link></p>
          {error || itemError || questionError || !form ? <p className="inline-notice">The form details could not be loaded. Confirm the hosted schema and your assigned role.</p> : <>
            <div className="integration-checks">
              <div><span>Level and version</span><strong>{form.level} · v{form.version}</strong></div>
              <div><span>Status</span><strong>{form.status.replaceAll("_", " ")}</strong></div>
              <div><span>Frozen</span><strong>{form.is_frozen ? "Yes" : "No"}</strong></div>
              <div><span>Published</span><strong>{dateTime(form.published_at)}</strong></div>
              <div><span>Blueprint</span><strong><code>{form.blueprint_id}</code></strong></div>
              <div><span>Created</span><strong>{dateTime(form.created_at)}</strong></div>
            </div>
            <h2>Selected questions · {items.length}</h2>
            {!items.length ? <p>No question revisions are attached.</p> : <div className="table-scroll"><table><thead><tr><th>Position</th><th>Section</th><th>Score category</th><th>Item type</th><th>Review state</th><th>Question revision</th></tr></thead><tbody>{items.map((item) => {
              const question = questions.get(item.question_id);
              return <tr key={item.id}><td>{item.position}{item.group_position ? <small>Group position {item.group_position}</small> : null}</td><td>{question?.test_section_code ?? "Unavailable"}</td><td>{question?.score_category_code ?? "—"}</td><td>{question?.item_type_code ?? "—"}</td><td>{question?.status.replaceAll("_", " ") ?? "Unavailable"}</td><td><Link className="text-link" href={`/admin/questions/${item.question_id}`}>Question {item.question_id.slice(0, 8)}</Link></td></tr>;
            })}</tbody></table></div>}
            <h2>Blueprint quotas</h2>
            {slotData?.length ? <div className="table-scroll"><table><thead><tr><th>Slot</th><th>Section</th><th>Score category</th><th>Item type</th><th>Quota</th><th>Required media</th></tr></thead><tbody>{slotData.map((slot) => <tr key={slot.slot_order}><td>{slot.slot_order}</td><td>{slot.test_section_code}</td><td>{slot.score_category_code}</td><td>{slot.item_type_code}</td><td>{slot.question_quota}</td><td>{slot.required_asset_types?.join(", ") || "None"}</td></tr>)}</tbody></table></div> : <p>Blueprint slots are unavailable or no approved blueprint is attached.</p>}
            <h2>Stored manifest</h2>
            <pre className="admin-manifest-preview">{JSON.stringify(form.manifest ?? {}, null, 2)}</pre>
            <p className="section-note">This inspection page never exposes answer keys or student responses and cannot unpublish or modify a frozen form. Validate and publish through the reviewed form workflow.</p>
          </>}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
