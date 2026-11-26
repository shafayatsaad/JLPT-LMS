import Link from "next/link";
import { ArrowUpRight, ClipboardCheck, ShieldCheck } from "lucide-react";

type AuditItem = { action: string; entity_type: string; created_at: string };
export type AdminDashboardData = {
  new_accounts_7d: number | null;
  active_premium_accounts: number | null;
  premium_expiring_7d: number | null;
  published_forms_by_level: Record<string, number>;
  questions_awaiting_review: number | null;
  question_drafts: number | null;
  exam_form_drafts: number | null;
  exam_forms_ready_to_publish: number | null;
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
  const tasks = [
    { title: "Question drafts, including imports", value: summary.question_drafts, href: "/admin/content", action: "Organize content" },
    { title: "Questions awaiting review", value: summary.questions_awaiting_review, href: "/admin/reviews", action: "Open review queue" },
    { title: "Draft exam forms", value: summary.exam_form_drafts, href: "/admin/exam-forms", action: "Continue building" },
    { title: "Exam forms ready to publish", value: summary.exam_forms_ready_to_publish, href: "/admin/exam-forms", action: "Validate and publish" },
    { title: "Payment verifications pending", value: summary.pending_payment_reviews, href: "/admin/payments", action: "Verify a payment" },
    { title: "Open support requests", value: summary.open_support_tickets, href: "/admin/support", action: "Open support queue" },
    { title: "Active exam attempts", value: summary.active_attempts, href: "/admin/attempts", action: "Monitor attempts" },
  ].filter((task) => task.value !== null && task.value !== undefined);

  return (
    <div className="admin-dashboard-summary">
      <div className="admin-dashboard-summary__welcome">
        <p>Work assigned to your current staff roles appears below. Each link opens the queue where the action is handled.</p>
        <Link className="text-link" href="/dashboard?view=learner" prefetch={false}>Open learner experience <ArrowUpRight size={15} aria-hidden="true" /></Link>
      </div>

      <section className="admin-dashboard-panel admin-dashboard-panel--tasks">
        <h2>Items requiring attention</h2>
        {tasks.length ? <ul>{tasks.map((task) => <li key={task.href}><span><strong>{task.title}</strong><small>{task.value} {task.value === 1 ? "item" : "items"}</small></span><Link className="text-link" href={task.href}>{task.action} <ArrowUpRight size={14} aria-hidden="true" /></Link></li>)}</ul> : <p className="empty-state">No operational queues are available for this role, or their counts could not be loaded.</p>}
        <p className="data-footnote">Question packages are validated and imported immediately. The platform does not track background import jobs.</p>
      </section>

      <div className="admin-dashboard-summary__lower">
        {canSeeAudit ? <section className="admin-dashboard-panel">
          <h2><ClipboardCheck size={17} aria-hidden="true" />Recent activity</h2>
          {summary.recent_audit_events.length ? <ol>{summary.recent_audit_events.map((event, index) => <li key={`${event.created_at}-${index}`}><span><strong>{event.action}</strong><small>{event.entity_type}</small></span><time>{displayDate(event.created_at)}</time></li>)}</ol> : <p className="empty-state">No audited actions recorded yet.</p>}
          <Link className="text-link" href="/admin/audit">Search the audit log <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </section> : null}
        <section className="admin-dashboard-panel admin-dashboard-panel--readiness">
          <h2><ShieldCheck size={17} aria-hidden="true" />Operational readiness</h2>
          <p><strong>Backup and restore:</strong> Provider managed; restore verification is not recorded here.</p>
          <p><strong>Launch check:</strong> confirm monitoring, backup retention and a completed restore drill in the staging runbook before production.</p>
          <Link className="text-link" href="/admin/settings">Review configuration status <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </section>
        <section className="admin-dashboard-panel admin-dashboard-panel--content">
          <h2>Published exam forms</h2>
          {forms.length ? <ul>{forms.map(([level, count]) => <li key={level}><span><strong>{level}</strong><small>{count} {count === 1 ? "form" : "forms"}</small></span><Link className="text-link" href="/admin/exam-forms">Open forms <ArrowUpRight size={14} aria-hidden="true" /></Link></li>)}</ul> : <p>No published exam forms are recorded.</p>}
        </section>
      </div>
    </div>
  );
}
