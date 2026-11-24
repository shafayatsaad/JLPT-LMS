import Link from "next/link";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Attempt monitor · Administration" };

type AttemptMonitorRow = {
  attempt_id: string;
  user_id: string;
  learner_name: string | null;
  exam_form_id: string;
  form_code: string;
  level: string;
  status: string;
  attempt_number: number;
  created_at: string;
  started_at: string | null;
  deadline_at: string | null;
  submitted_at: string | null;
  section_count: number;
  completed_sections: number;
  active_section: string | null;
  answered_count: number;
  form_item_count: number;
};

const statuses = ["created", "in_progress", "submitted", "expired"] as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date);
}

export default async function AdminAttemptMonitorPage({ searchParams }: { searchParams: Promise<{ status?: string | string[]; q?: string | string[] }> }) {
  const params = await searchParams;
  const rawStatus = typeof params.status === "string" ? params.status : "";
  const status = statuses.includes(rawStatus as typeof statuses[number]) ? rawStatus : "";
  const search = typeof params.q === "string" ? params.q.slice(0, 120).trim() : "";
  const { supabase } = await requireStaff(["admin", "reviewer"], "/admin/attempts");
  if (!supabase) {
    return <ProductPage eyebrow="Staff workspace" title="Attempt monitor unavailable" description="Connect Supabase and sign in with a reviewer or administrator account to inspect exam operations."><ProductSection title="Setup required"><PaperPanel><p>Apply the reconciled database migrations before monitoring learner attempts.</p></PaperPanel></ProductSection></ProductPage>;
  }

  const { data, error } = await supabase.rpc("get_admin_attempt_monitor", {
    p_status: status || null,
    p_search: search || null,
    p_limit: 100,
  });
  const rows = Array.isArray(data) ? data as AttemptMonitorRow[] : [];

  return (
    <ProductPage eyebrow="Staff workspace · reviewer/admin" title="Exam attempt monitor" description="Inspect attempt state, section progress and timing. Answers and scoring details are not exposed here; opening this monitor is audited." className="product-page--admin" navigation={<AdminNavigation activePath="/admin/attempts" />}>
      <ProductSection title="Learner attempts" className="product-section--tint">
        <PaperPanel className="data-panel">
          <p><Link className="text-link" href="/admin">← Back to administration</Link></p>
          <form className="admin-export-form" method="get">
            <div className="admin-export-form__fields">
              <label>Attempt status<select name="status" defaultValue={status}><option value="">All statuses</option>{statuses.map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
              <label>Form, learner name or full account ID<input name="q" defaultValue={search} maxLength={120} /></label>
            </div>
            <button className="btn btn--secondary" type="submit">Filter attempts</button>
          </form>
          {error ? <p className="inline-notice">Attempt data is unavailable. Confirm migration 027 and the reviewer/admin role.</p> : !rows.length ? <div className="empty-state"><p>No attempts match this view.</p></div> : <div className="table-scroll"><table><thead><tr><th>Attempt / learner</th><th>Form</th><th>Status</th><th>Section progress</th><th>Timing · UTC</th></tr></thead><tbody>{rows.map((row) => <tr key={row.attempt_id}>
            <td><code>{row.attempt_id.slice(0, 8)}</code><small>{row.learner_name || "Learner"} · {row.user_id.slice(0, 8)}</small></td>
            <td><Link className="text-link" href={`/admin/exam-forms/${row.exam_form_id}`}>{row.form_code}</Link><small>{row.level} · attempt {row.attempt_number}</small></td>
            <td><span className="status-chip">{row.status.replaceAll("_", " ")}</span></td>
            <td>{row.completed_sections}/{row.section_count} sections · {row.answered_count}/{row.form_item_count} answered{row.active_section ? <small>Active: {row.active_section}</small> : null}</td>
            <td>{row.started_at ? `Started ${formatDate(row.started_at)}` : `Created ${formatDate(row.created_at)}`}<small>{row.deadline_at ? `Deadline ${formatDate(row.deadline_at)}` : row.submitted_at ? `Submitted ${formatDate(row.submitted_at)}` : "No active deadline"}</small></td>
          </tr>)}</tbody></table></div>}
          {!error && rows.length === 100 ? <p className="section-note">Showing up to 100 newest attempts. Narrow the status or search filters for more focused monitoring.</p> : null}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
