import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { requireSignedInUser, requireStaffMfa } from "@/lib/auth";

export const dynamic = "force-dynamic";

type UserDetail = {
  account: {
    user_id: string;
    email: string | null;
    phone: string | null;
    registered_at: string;
    last_sign_in_at: string | null;
    email_confirmed_at: string | null;
    phone_confirmed_at: string | null;
    banned_until: string | null;
    state: string;
  };
  profile: {
    display_name: string | null;
    target_level: string | null;
    explanation_language: string | null;
    ui_language: string | null;
    updated_at: string;
  } | null;
  roles: string[];
  attempt_summary: {
    total: number;
    in_progress: number;
    submitted: number;
    expired: number;
    raw_correct: number;
    raw_incorrect: number;
    raw_unanswered: number;
  };
  recent_attempts: {
    id: string;
    form_code: string;
    level: string;
    status: string;
    attempt_number: number;
    started_at: string | null;
    submitted_at: string | null;
    raw_correct: number | null;
    raw_incorrect: number | null;
    raw_unanswered: number | null;
  }[];
  payments: {
    id: string;
    provider: string;
    payment_method: string;
    amount: number | string;
    currency: string;
    status: string;
    submitted_at: string;
    reviewed_at: string | null;
    plan: { name?: string; code?: string; duration_days?: number } | null;
  }[];
  entitlements: {
    id: string;
    plan_code: string;
    plan_name: string;
    status: string;
    starts_at: string;
    ends_at: string;
    source_payment_submission_id: string | null;
  }[];
  support_tickets: {
    id: string;
    category: string;
    subject: string;
    status: string;
    created_at: string;
    updated_at: string;
  }[];
  audit_history: {
    action: string;
    actor_user_id: string;
    before_state: Record<string, unknown> | null;
    after_state: Record<string, unknown> | null;
    created_at: string;
  }[];
};

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date);
}

function money(value: number | string, currency: string) {
  try { return new Intl.NumberFormat("en", { style: "currency", currency }).format(Number(value)); }
  catch { return `${currency} ${value}`; }
}

function DetailValue({ label, children }: { label: string; children: ReactNode }) {
  return <div className="admin-user-detail__value"><span>{label}</span><strong>{children}</strong></div>;
}

export async function generateMetadata({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return { title: `Account ${userId.slice(0, 8)} · Administration` };
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) notFound();

  const { supabase, user } = await requireSignedInUser(`/admin/users/${userId}`);
  if (!supabase || !user) {
    return <ProductPage eyebrow="Staff workspace" title="Account details" description="Connect Supabase and sign in with an administrator account to view private account information."><ProductSection title="Supabase setup required"><PaperPanel><p>Account details are available only to authenticated administrators.</p></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (roleError || !roleRows?.some((row) => row.role === "admin")) {
    return <ProductPage eyebrow="Staff workspace" title="Administrator access required" description="This private account record is restricted to administrators."><ProductSection title="Access restricted"><PaperPanel><p>Return to the learner dashboard or ask the project owner to assign your staff role.</p></PaperPanel></ProductSection></ProductPage>;
  }
  await requireStaffMfa(supabase, `/admin/users/${userId}`);

  const { data, error } = await supabase.rpc("get_admin_user_detail", { p_user_id: userId });
  if (error || !data || typeof data !== "object") {
    return <ProductPage eyebrow="Staff workspace · administrator only" title="Account details unavailable" description="The account record could not be loaded from the protected admin workflow."><ProductSection title="Database setup required"><PaperPanel><p>Confirm migration 023 is applied and the account still exists.</p><Link className="text-link" href="/admin/users">Return to the account directory</Link></PaperPanel></ProductSection></ProductPage>;
  }

  const detail = data as unknown as UserDetail;
  const account = detail.account;
  return (
    <ProductPage eyebrow="Staff workspace · administrator only" title={detail.profile?.display_name || account.email || account.phone || "Account details"} description="Read-only account, activity and access summaries. Opening this record is written to the admin audit history." className="product-page--admin">
      <ProductSection title="Account profile and verification" className="product-section--tint">
        <PaperPanel className="data-panel">
          <p><Link className="text-link" href="/admin/users">← Back to users and roles</Link></p>
          <div className="admin-user-detail__grid">
            <DetailValue label="Account ID"><code>{account.user_id}</code></DetailValue>
            <DetailValue label="Email">{account.email ?? "No email on record"}</DetailValue>
            <DetailValue label="Email verification">{account.email ? account.email_confirmed_at ? "Verified" : "Not verified" : "Not applicable"}</DetailValue>
            <DetailValue label="Phone">{account.phone ?? "No phone on record"}</DetailValue>
            <DetailValue label="Phone verification">{account.phone ? account.phone_confirmed_at ? "Verified" : "Not verified" : "Not applicable"}</DetailValue>
            <DetailValue label="Account state">{account.state}{account.state === "suspended" ? ` until ${dateTime(account.banned_until)}` : ""}</DetailValue>
            <DetailValue label="Registered">{dateTime(account.registered_at)}</DetailValue>
            <DetailValue label="Last sign-in">{dateTime(account.last_sign_in_at)}</DetailValue>
            <DetailValue label="Target JLPT level">{detail.profile?.target_level ?? "Not set"}</DetailValue>
            <DetailValue label="Interface language">{detail.profile?.ui_language ?? "Not set"}</DetailValue>
            <DetailValue label="Explanation language">{detail.profile?.explanation_language ?? "Not set"}</DetailValue>
            <DetailValue label="Profile updated">{dateTime(detail.profile?.updated_at)}</DetailValue>
          </div>
          <div className="workflow-user__roles admin-user-detail__roles"><strong>Assigned roles</strong><div>{detail.roles.length ? detail.roles.map((role) => <span className="workflow-user__role" key={role}>{role.replaceAll("_", " ")}</span>) : <span className="section-note">No role rows found</span>}</div></div>
          <p className="section-note">This screen does not expose passwords, OTPs, recovery tokens or authentication secrets. Account suspension, recovery and complimentary access changes are not available here.</p>
        </PaperPanel>
      </ProductSection>

      <ProductSection title="Exam attempts and results">
        <PaperPanel className="data-panel">
          <div className="admin-user-detail__grid admin-user-detail__grid--summary">
            <DetailValue label="Attempts">{detail.attempt_summary.total}</DetailValue>
            <DetailValue label="In progress">{detail.attempt_summary.in_progress}</DetailValue>
            <DetailValue label="Submitted">{detail.attempt_summary.submitted}</DetailValue>
            <DetailValue label="Expired">{detail.attempt_summary.expired}</DetailValue>
            <DetailValue label="Raw correct answers">{detail.attempt_summary.raw_correct}</DetailValue>
            <DetailValue label="Raw incorrect answers">{detail.attempt_summary.raw_incorrect}</DetailValue>
            <DetailValue label="Raw unanswered">{detail.attempt_summary.raw_unanswered}</DetailValue>
          </div>
          {!detail.recent_attempts.length ? <div className="empty-state"><p>No exam attempts found.</p></div> : <div className="table-scroll"><table><thead><tr><th>Form</th><th>Level</th><th>Status</th><th>Attempt</th><th>Started</th><th>Submitted</th><th>Raw result</th></tr></thead><tbody>{detail.recent_attempts.map((attempt) => <tr key={attempt.id}><td>{attempt.form_code}<small><code>{attempt.id.slice(0, 8)}</code></small></td><td>{attempt.level}</td><td><span className="status-chip">{attempt.status.replaceAll("_", " ")}</span></td><td>{attempt.attempt_number}</td><td>{dateTime(attempt.started_at)}</td><td>{dateTime(attempt.submitted_at)}</td><td>{attempt.raw_correct == null ? "—" : `${attempt.raw_correct} correct · ${attempt.raw_incorrect ?? 0} incorrect · ${attempt.raw_unanswered ?? 0} unanswered`}</td></tr>)}</tbody></table></div>}
        </PaperPanel>
      </ProductSection>

      <ProductSection title="Payments and entitlements" className="product-section--tint">
        <PaperPanel className="data-panel">
          {!detail.payments.length ? <div className="empty-state"><p>No payment requests found.</p></div> : <div className="table-scroll"><table><thead><tr><th>Request</th><th>Plan</th><th>Amount</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>{detail.payments.map((payment) => <tr key={payment.id}><td><code>{payment.id.slice(0, 8)}</code><small>{payment.provider} · {payment.payment_method.replaceAll("_", " ")}</small></td><td>{payment.plan?.name ?? payment.plan?.code ?? "Plan"}<small>{payment.plan?.duration_days ? `${payment.plan.duration_days} days` : ""}</small></td><td>{money(payment.amount, payment.currency)}</td><td><span className="status-chip">{payment.status.replaceAll("_", " ")}</span></td><td>{dateTime(payment.submitted_at)}</td><td><Link className="text-link" href={`/admin/payments/${payment.id}`}>Open review</Link></td></tr>)}</tbody></table></div>}
          <h3>Access history</h3>
          {!detail.entitlements.length ? <div className="empty-state"><p>No entitlement records found.</p></div> : <div className="table-scroll"><table><thead><tr><th>Plan</th><th>Status</th><th>Access period</th><th>Source payment</th></tr></thead><tbody>{detail.entitlements.map((entitlement) => <tr key={entitlement.id}><td>{entitlement.plan_name}<small>{entitlement.plan_code}</small></td><td><span className="status-chip">{entitlement.status}</span></td><td>{dateTime(entitlement.starts_at)} – {dateTime(entitlement.ends_at)}</td><td>{entitlement.source_payment_submission_id ? <Link className="text-link" href={`/admin/payments/${entitlement.source_payment_submission_id}`}>{entitlement.source_payment_submission_id.slice(0, 8)}</Link> : "Manual or other source"}</td></tr>)}</tbody></table></div>}
        </PaperPanel>
      </ProductSection>

      <ProductSection title="Support history">
        <PaperPanel className="data-panel">
          {!detail.support_tickets.length ? <div className="empty-state"><p>No support tickets found.</p></div> : <div className="table-scroll"><table><thead><tr><th>Subject</th><th>Category</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>{detail.support_tickets.map((ticket) => <tr key={ticket.id}><td>{ticket.subject}<small><code>{ticket.id.slice(0, 8)}</code></small></td><td>{ticket.category.replaceAll("_", " ")}</td><td><span className="status-chip">{ticket.status.replaceAll("_", " ")}</span></td><td>{dateTime(ticket.updated_at)}</td><td><Link className="text-link" href={`/admin/support/${ticket.id}`}>Open ticket</Link></td></tr>)}</tbody></table></div>}
        </PaperPanel>
      </ProductSection>

      <ProductSection title="Admin audit history" className="product-section--tint">
        <PaperPanel className="data-panel">
          {!detail.audit_history.length ? <div className="empty-state"><p>No previous account-level admin events found.</p></div> : <div className="table-scroll"><table><thead><tr><th>Action</th><th>Actor</th><th>Time</th><th>Change</th></tr></thead><tbody>{detail.audit_history.map((entry, index) => <tr key={`${entry.created_at}-${index}`}><td>{entry.action}</td><td><code>{entry.actor_user_id.slice(0, 8)}</code></td><td>{dateTime(entry.created_at)}</td><td><code>{JSON.stringify(entry.after_state ?? entry.before_state ?? {})}</code></td></tr>)}</tbody></table></div>}
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
