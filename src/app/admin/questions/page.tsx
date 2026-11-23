import Link from "next/link";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Question bank · Administration" };

const statuses = ["draft", "needs_review", "approved", "eligible_for_exam", "rejected", "retired"] as const;

export default async function AdminQuestionBankPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  const params = await searchParams;
  const rawStatus = typeof params.status === "string" ? params.status : "";
  const status = statuses.includes(rawStatus as typeof statuses[number]) ? rawStatus : "";
  const { supabase } = await requireStaff(["content_editor", "reviewer", "admin"], "/admin/questions");
  if (!supabase) {
    return <ProductPage eyebrow="Staff workspace" title="Question bank unavailable" description="Connect Supabase and sign in with a content editor, reviewer or administrator account."><ProductSection title="Setup required"><PaperPanel><p>Question inventory requires the platform schema and staff role assignment.</p></PaperPanel></ProductSection></ProductPage>;
  }

  let query = supabase.from("questions")
    .select("id,content_key,revision,level,test_section_code,score_category_code,item_type_code,difficulty_estimate,status,authored_by,created_at,source_type")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;

  return (
    <ProductPage eyebrow="Staff workspace · editor/reviewer" title="Question bank" description="Browse immutable question revisions, inspect draft previews, and continue authoring or review work." className="product-page--admin">
      <ProductSection title="Question revisions" className="product-section--tint">
        <PaperPanel className="data-panel">
          <p><Link className="text-link" href="/admin">← Back to administration</Link></p>
          <div className="account-strip__actions"><Link className="btn btn--primary" href="/admin/questions/new">Create or import drafts</Link><Link className="btn btn--secondary" href="/admin/reviews">Open review queue</Link></div>
          <form className="admin-export-form" method="get"><div className="admin-export-form__fields"><label>Review status<select name="status" defaultValue={status}><option value="">All visible statuses</option>{statuses.map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}</select></label></div><button className="btn btn--secondary" type="submit">Filter questions</button></form>
          {error ? <p className="inline-notice">Question records are unavailable. Confirm migration 007 and your editor/reviewer role.</p> : !data?.length ? <div className="empty-state"><p>No question revisions match this view.</p></div> : <div className="table-scroll"><table><thead><tr><th>Question revision</th><th>Level</th><th>Section</th><th>Score category</th><th>Item type</th><th>Status</th><th>Source</th></tr></thead><tbody>{data.map((row) => <tr key={row.id}>
            <td><Link className="text-link" href={`/admin/questions/${row.id}`}>Revision {row.revision}</Link><small><code>{row.id.slice(0, 8)}</code> · family {row.content_key.slice(0, 8)}</small></td>
            <td>{row.level}</td><td>{row.test_section_code}</td><td>{row.score_category_code}</td><td>{row.item_type_code}</td><td><span className="status-chip">{row.status.replaceAll("_", " ")}</span></td><td>{row.source_type.replaceAll("_", " ")}</td>
          </tr>)}</tbody></table></div>}
          {!error && data?.length === 100 ? <p className="section-note">Showing the 100 newest revisions. Filter by status to focus the queue.</p> : null}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
