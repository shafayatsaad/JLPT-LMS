import Link from "next/link";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Question bank · Administration" };

const statuses = ["draft", "needs_review", "approved", "eligible_for_exam", "rejected", "retired"] as const;
const levels = ["N1", "N2", "N3", "N4", "N5"] as const;

type QuestionRow = {
  id: string;
  content_key: string;
  revision: number;
  level: string;
  test_section_code: string;
  score_category_code: string;
  item_type_code: string;
  difficulty_estimate: number | null;
  status: string;
  authored_by: string;
  created_at: string;
  source_type: string;
  prompt: unknown;
};

function textContent(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textContent).filter(Boolean).join(" ");
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  if (record.type === "text") return String(record.text ?? record.value ?? "");
  if (record.type === "ruby") return [record.base, record.reading].map(textContent).filter(Boolean).join(" ");
  if (record.type === "line_break") return " ";
  if ("content" in record) return textContent(record.content);
  if ("text" in record) return textContent(record.text);
  return Object.values(record).map(textContent).filter(Boolean).join(" ");
}

function queryValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value ?? "").trim();
}

export default async function AdminQuestionBankPage({ searchParams }: { searchParams: Promise<{ status?: string | string[]; level?: string | string[]; type?: string | string[]; skill?: string | string[]; q?: string | string[] }> }) {
  const params = await searchParams;
  const rawStatus = queryValue(params.status);
  const status = statuses.includes(rawStatus as typeof statuses[number]) ? rawStatus : "";
  const rawLevel = queryValue(params.level);
  const level = levels.includes(rawLevel as typeof levels[number]) ? rawLevel : "";
  const itemType = queryValue(params.type).slice(0, 80);
  const skill = queryValue(params.skill).toLowerCase().slice(0, 80);
  const search = queryValue(params.q).toLowerCase().slice(0, 120);
  const { supabase } = await requireStaff(["content_editor", "reviewer", "admin"], "/admin/questions");
  if (!supabase) {
    return <ProductPage eyebrow="Staff workspace" title="Question bank unavailable" description="Connect Supabase and sign in with a content editor, reviewer or administrator account."><ProductSection title="Setup required"><PaperPanel><p>Question inventory requires the platform schema and staff role assignment.</p></PaperPanel></ProductSection></ProductPage>;
  }

  const countResults = await Promise.all(statuses.map((item) => supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", item)));
  const counts = Object.fromEntries(statuses.map((item, index) => [item, countResults[index].count ?? null]));
  let query = supabase.from("questions")
    .select("id,content_key,revision,level,test_section_code,score_category_code,item_type_code,difficulty_estimate,status,authored_by,created_at,source_type,prompt")
    .order("created_at", { ascending: false })
    .limit(500);
  if (status) query = query.eq("status", status);
  if (level) query = query.eq("level", level);
  if (itemType) query = query.eq("item_type_code", itemType);
  const { data, error } = await query;
  const questionRows = (data ?? []) as QuestionRow[];
  const questionIds = questionRows.map((row) => row.id);
  const tagLinks = questionIds.length
    ? await supabase.from("question_tags").select("question_id,tag_id").in("question_id", questionIds)
    : { data: [], error: null };
  const tagIds = [...new Set((tagLinks.data ?? []).map((row) => row.tag_id))];
  const tagRows = tagIds.length
    ? await supabase.from("tags").select("id,slug").eq("tag_type", "skill").in("id", tagIds)
    : { data: [], error: null };
  const slugById = new Map((tagRows.data ?? []).map((row) => [row.id, row.slug]));
  const tagsByQuestion = new Map<string, string[]>();
  for (const link of tagLinks.data ?? []) {
    const slug = slugById.get(link.tag_id);
    if (slug) tagsByQuestion.set(link.question_id, [...(tagsByQuestion.get(link.question_id) ?? []), slug]);
  }
  const filteredRows = questionRows.filter((row) => {
    const matchesSkill = !skill || (tagsByQuestion.get(row.id) ?? []).some((slug) => slug.includes(skill));
    const matchesSearch = !search || row.id.toLowerCase().includes(search) || row.content_key.toLowerCase().includes(search) || textContent(row.prompt).toLowerCase().includes(search);
    return matchesSkill && matchesSearch;
  });
  const dataError = error?.message ?? tagLinks.error?.message ?? tagRows.error?.message ?? "";
  const countError = countResults.some((result) => result.error);

  return (
    <ProductPage eyebrow="Staff workspace · editor/reviewer" title="Question bank" description="Find and maintain reviewed question revisions. Drafts stay separate from approved content used by exam forms." className="product-page--admin" navigation={<AdminNavigation activePath="/admin/questions" />}>
      <ProductSection title="Question inventory" className="product-section--tint">
        <PaperPanel className="data-panel">
          <div className="question-bank-actions"><div><p>Keep each question revision traceable from draft through independent review.</p></div><div className="account-strip__actions"><Link className="btn btn--primary" href="/admin/questions/new#manual-question">Add question</Link><Link className="btn btn--secondary" href="/admin/questions/new#import-questions">Import package</Link><Link className="text-link" href="/admin/reviews">Review queue</Link></div></div>
          <div className="question-bank-counts" aria-label="Question counts by status">{statuses.map((item) => <div key={item}><span>{item.replaceAll("_", " ")}</span><strong>{counts[item] === null ? "—" : counts[item]}</strong></div>)}</div>
          {countError ? <p className="section-note">One or more status counts could not be loaded for this role.</p> : null}
          <form className="admin-export-form question-bank-filters" method="get">
            <div className="admin-export-form__fields">
              <label>Search by question ID or prompt<input name="q" defaultValue={search} maxLength={120} placeholder="ID, content family, or Japanese text" /></label>
              <label>JLPT level<select name="level" defaultValue={level}><option value="">All levels</option>{levels.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
              <label>Skill tag<input name="skill" defaultValue={skill} maxLength={80} placeholder="e.g. vocabulary" /></label>
              <label>Question type<input name="type" defaultValue={itemType} maxLength={80} placeholder="Type code" /></label>
              <label>Status<select name="status" defaultValue={status}><option value="">All statuses</option>{statuses.map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
            </div>
            <div className="question-bank-filters__actions"><button className="btn btn--secondary" type="submit">Search questions</button><Link className="text-link" href="/admin/questions">Clear filters</Link></div>
          </form>
          {dataError ? <p className="inline-notice">Question records or skill tags could not be loaded. Confirm the question workflow migrations and your staff role.</p> : !filteredRows.length ? <div className="empty-state"><p>No question revisions match these filters.</p><Link className="text-link" href="/admin/questions/new#manual-question">Create an original draft</Link></div> : <div className="table-scroll"><table><thead><tr><th>Question</th><th>Level</th><th>Section · type</th><th>Skill tags</th><th>Difficulty</th><th>Status</th></tr></thead><tbody>{filteredRows.map((row) => <tr key={row.id}>
            <td><Link className="text-link" href={`/admin/questions/${row.id}`}>Revision {row.revision}</Link><small>{textContent(row.prompt).slice(0, 110) || "Prompt has no text preview"}</small><small><code>{row.id.slice(0, 8)}</code> · family {row.content_key.slice(0, 8)}</small></td>
            <td>{row.level}</td><td>{row.test_section_code}<small>{row.item_type_code}</small></td><td>{(tagsByQuestion.get(row.id) ?? []).join(", ") || "—"}</td><td>{row.difficulty_estimate ?? "—"}</td><td><span className="status-chip">{row.status.replaceAll("_", " ")}</span></td>
          </tr>)}</tbody></table></div>}
          {!dataError && questionRows.length === 500 ? <p className="section-note">Search and skill filters apply to the 500 newest revisions matching the database filters.</p> : null}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
