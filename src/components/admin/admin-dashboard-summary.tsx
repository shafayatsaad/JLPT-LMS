import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, FileSearch, ShieldCheck } from "lucide-react";

type AuditItem = { action: string; entity_type: string; created_at: string };
export type AdminDashboardData = {
  new_accounts_7d: number | null;
  active_premium_accounts: number | null;
  premium_expiring_7d: number | null;
  published_forms_by_level: Record<string, number>;
  questions_awaiting_review: number | null;
  active_attempts: number | null;
  open_support_tickets: number | null;
  pending_payment_reviews: number | null;
  recent_audit_events: AuditItem[];
  backup_status: "not_verified";
};

function displayDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date);
}

export function AdminDashboardSummary({ summary, canSeeAudit }: { summary: AdminDashboardData; canSeeAudit: boolean }) {
  const forms = Object.entries(summary.published_forms_by_level ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const cards = [
    { title: "New accounts · 7 days", value: summary.new_accounts_7d, href: "/admin/users" },
    { title: "Active premium accounts", value: summary.active_premium_accounts, href: "/admin/entitlements" },
    { title: "Premium expiring · 7 days", value: summary.premium_expiring_7d, href: "/admin/entitlements?status=active" },
    { title: "Questions awaiting review", value: summary.questions_awaiting_review, href: "/admin/reviews" },
    { title: "Active exam attempts", value: summary.active_attempts, href: "/admin/attempts?status=in_progress" },
    { title: "Open support tickets", value: summary.open_support_tickets, href: "/admin/support" },
    { title: "Payment reviews pending", value: summary.pending_payment_reviews, href: "/admin/payments?status=pending" },
  ].filter((card) => card.value !== null && card.value !== undefined);

  return (
    <div className="admin-dashboard-summary">
      <div className="admin-dashboard-summary__cards">
        {cards.map((card) => <Link className="admin-dashboard-stat" href={card.href} key={card.title}>
          <span>{card.title}</span><strong>{card.value}</strong><ArrowUpRight size={15} aria-hidden="true" />
        </Link>)}
        <Link className="admin-dashboard-stat admin-dashboard-stat--forms" href="/admin/exam-forms">
          <span>Published exam forms</span><strong>{forms.reduce((total, [, count]) => total + Number(count || 0), 0)}</strong>
          <small>{forms.length ? forms.map(([level, count]) => `${level} ${count}`).join(" · ") : "No published forms"}</small>
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>

      <div className="admin-dashboard-summary__lower">
        {canSeeAudit ? <section className="admin-dashboard-panel">
          <h2><ClipboardCheck size={17} aria-hidden="true" />Recent audit activity</h2>
          {summary.recent_audit_events.length ? <ol>{summary.recent_audit_events.map((event, index) => <li key={`${event.created_at}-${index}`}><span><strong>{event.action}</strong><small>{event.entity_type}</small></span><time>{displayDate(event.created_at)}</time></li>)}</ol> : <p className="empty-state">No audited actions recorded yet.</p>}
          <Link className="text-link" href="/admin/audit">Search the audit log <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </section> : null}
        <section className="admin-dashboard-panel admin-dashboard-panel--readiness">
          <h2><ShieldCheck size={17} aria-hidden="true" />Operational readiness</h2>
          <p><strong>Backup and restore:</strong> {summary.backup_status === "not_verified" ? "Provider managed; restore verification is not recorded here." : "Status unavailable."}</p>
          <p><strong>Launch check:</strong> confirm monitoring, backup retention and a completed restore drill in the staging runbook before production.</p>
          <Link className="text-link" href="/admin/settings">Review configuration status <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </section>
        <section className="admin-dashboard-panel admin-dashboard-panel--content">
          <h2><FileSearch size={17} aria-hidden="true" />Content inventory</h2>
          <p>Published-form counts are separated by level. Only reviewed, rights-cleared questions belong in a frozen exam.</p>
          <Link className="text-link" href="/admin/content">Open content dashboard <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </section>
      </div>
    </div>
  );
}
