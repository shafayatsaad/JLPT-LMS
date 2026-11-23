import Link from "next/link";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser, requireStaffMfa } from "@/lib/auth";

export const dynamic = "force-dynamic";

type EntitlementRow = {
  entitlement_id: string;
  user_id: string;
  learner_email: string | null;
  learner_name: string | null;
  plan_id: string;
  plan_code: string;
  plan_name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  source_payment_submission_id: string | null;
  created_at: string;
};

const statuses = ["active", "scheduled", "expired", "cancelled", "revoked"] as const;

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date);
}

export async function generateMetadata() {
  return { title: "Entitlement inventory · Administration" };
}

export default async function AdminEntitlementsPage({ searchParams }: { searchParams: Promise<{ status?: string | string[]; q?: string | string[] }> }) {
  const query = await searchParams;
  const rawStatus = typeof query.status === "string" ? query.status : "";
  const status = statuses.includes(rawStatus as typeof statuses[number]) ? rawStatus : "";
  const search = typeof query.q === "string" ? query.q.slice(0, 120).trim() : "";

  const { supabase, user } = await requireSignedInUser("/admin/entitlements");
  if (!supabase || !user) {
    return <ProductPage eyebrow="Staff workspace" title="Entitlement inventory" description="Connect Supabase and sign in with an administrator account to review access records."><ProductSection title="Supabase setup required"><PaperPanel><p>This view is restricted to administrators.</p></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (roleError || !roleRows?.some((row) => row.role === "admin")) {
    return <ProductPage eyebrow="Staff workspace" title="Administrator access required" description="The entitlement inventory is restricted to administrators."><ProductSection title="Access restricted"><PaperPanel><p>Return to the learner dashboard or ask the project owner to assign your staff role.</p></PaperPanel></ProductSection></ProductPage>;
  }
  await requireStaffMfa(supabase, "/admin/entitlements");

  const { data, error } = await supabase.rpc("get_admin_entitlement_directory", {
    p_status: status || null,
    p_search: search || null,
  });
  const rows = (data ?? []) as EntitlementRow[];

  return (
    <ProductPage eyebrow="Staff workspace · administrator only" title="Entitlement inventory" description="Review account access periods and their recorded source. Viewing this directory is audited; grant/revoke controls are not enabled." className="product-page--admin">
      <ProductSection title="Access records" className="product-section--tint">
        <PaperPanel className="data-panel">
          <p><Link className="text-link" href="/admin">← Back to administration</Link></p>
          <p className="workflow-note"><strong>Read-only review.</strong> Complimentary access grants and revocations need an approved reason policy and staff permission model before these controls can change access.</p>
          <form className="admin-export-form entitlement-admin-filters" method="get">
            <div className="admin-export-form__fields">
              <label>Access status<select name="status" defaultValue={status}><option value="">All statuses</option>{statuses.map((value) => <option value={value} key={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
              <label>Learner, email or plan<input name="q" maxLength={120} defaultValue={search} /></label>
            </div>
            <button className="btn btn--secondary" type="submit">Filter access records</button>
          </form>
          {error ? <p className="inline-notice">Entitlement records are unavailable. Confirm migration 024 and the administrator role.</p> : !rows.length ? <div className="empty-state"><p>No entitlement records match this view.</p></div> : <div className="table-scroll"><table><thead><tr><th>Learner</th><th>Plan</th><th>Status</th><th>Access period · UTC</th><th>Source</th></tr></thead><tbody>{rows.map((row) => <tr key={row.entitlement_id}>
            <td><Link className="text-link" href={`/admin/users/${row.user_id}`}>{row.learner_name || row.learner_email || row.user_id}</Link><small>{row.learner_email ?? "No email on record"} · <code>{row.user_id.slice(0, 8)}</code></small></td>
            <td>{row.plan_name}<small>{row.plan_code}</small></td>
            <td><span className="status-chip">{row.status.replaceAll("_", " ")}</span></td>
            <td>{dateTime(row.starts_at)}<small>through {dateTime(row.ends_at)}</small></td>
            <td>{row.source_payment_submission_id ? row.user_id === user.id ? <span>Own request · reviewer self-check blocked</span> : <Link className="text-link" href={`/admin/payments/${row.source_payment_submission_id}`}>Payment {row.source_payment_submission_id.slice(0, 8)}</Link> : <span>Manual or other source</span>}</td>
          </tr>)}</tbody></table></div>}
          {!error && rows.length === 1000 ? <p className="section-note">Showing the latest 1,000 matching records. Narrow the search to inspect an account.</p> : null}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
