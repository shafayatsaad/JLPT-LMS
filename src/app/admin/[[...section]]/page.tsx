import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { ReviewQueue, type ReviewQueueItem } from "@/components/admin/review-queue";
import { requireSignedInUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const routeItems = [
  { href: "/admin", title: "Overview", roles: ["content_editor", "reviewer", "payment_reviewer", "admin"] },
  { href: "/admin/content", title: "Content dashboard", roles: ["content_editor", "reviewer", "admin"] },
  { href: "/admin/questions/new", title: "Authoring and import", roles: ["content_editor", "admin"] },
  { href: "/admin/reviews", title: "Review queue", roles: ["reviewer", "admin"] },
  { href: "/admin/assets", title: "Listening and image assets", roles: ["content_editor", "reviewer", "admin"] },
  { href: "/admin/blueprints", title: "Blueprints", roles: ["content_editor", "reviewer", "admin"] },
  { href: "/admin/exam-forms", title: "Exam forms", roles: ["content_editor", "reviewer", "admin"] },
  { href: "/admin/payments", title: "Payment review", roles: ["payment_reviewer", "admin"] },
  { href: "/admin/users", title: "Users and roles", roles: ["admin"] },
  { href: "/admin/audit", title: "Audit log", roles: ["admin"] },
];

function displayValue(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "string" && value.includes("T") && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function TableView({ rows, columns }: { rows: Record<string, unknown>[]; columns: [string, string][] }) {
  if (!rows.length) return <div className="empty-state"><p>The database returned no matching records.</p></div>;
  return <div className="table-scroll"><table><thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? row.user_id ?? index)}>{columns.map(([, key]) => <td key={key}>{displayValue(row[key])}</td>)}</tr>)}</tbody></table></div>;
}

export async function generateMetadata({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section = [] } = await params;
  const route = `/admin/${section.join("/")}`.replace(/\/$/, "");
  const item = routeItems.find((entry) => entry.href === route);
  return { title: `${item?.title ?? "Administration"} · JLPT practice` };
}

export default async function AdminPage({ params }: { params: Promise<{ section?: string[] }> }) {
  const { section = [] } = await params;
  const route = `/admin/${section.join("/")}`.replace(/\/$/, "");
  const item = routeItems.find((entry) => entry.href === route) ?? routeItems[0];
  const { supabase, user } = await requireSignedInUser(route);

  if (!supabase || !user) {
    return <ProductPage eyebrow="Staff workspace" title="Content and operations" description="Connect Supabase and sign in with a staff account to load this workspace."><ProductSection title="Supabase setup required"><PaperPanel><p>Staff access is assigned through the protected <code>user_roles</code> table after the migrations are applied.</p><Link className="btn btn--primary" href="/auth/login">Sign in</Link></PaperPanel></ProductSection></ProductPage>;
  }

  const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roles = roleRows?.map((row) => row.role as string) ?? [];
  const isAdmin = roles.includes("admin");
  const allowed = isAdmin || item.roles.some((role) => roles.includes(role));
  const sectionTitle = item.title;

  if (roleError || !roles.length) {
    return <ProductPage eyebrow="Staff workspace" title="Staff access is not assigned" description="This account does not have an administrator, editor, reviewer, or payment reviewer role."><ProductSection title="Ask an administrator"><PaperPanel><p>New accounts receive the student role only. A project owner must assign the first staff role from the Supabase SQL Editor.</p><Link className="text-link" href="/dashboard">Return to learner dashboard <ArrowUpRight size={15} aria-hidden="true" /></Link></PaperPanel></ProductSection></ProductPage>;
  }
  if (!allowed) {
    return <ProductPage eyebrow="Staff workspace" title="This page needs a different staff role" description={`Current roles: ${roles.join(", " )}.`}><ProductSection title="Choose an available area"><PaperPanel><div className="admin-link-list">{routeItems.filter((entry) => isAdmin || entry.roles.some((role) => roles.includes(role))).map((entry) => <Link key={entry.href} href={entry.href}>{entry.title}<ArrowUpRight size={15} aria-hidden="true" /></Link>)}</div></PaperPanel></ProductSection></ProductPage>;
  }

  let rows: Record<string, unknown>[] = [];
  let columns: [string, string][] = [];
  let dataError = "";
  let sectionDescription = "Records shown here are limited by the signed-in staff role and PostgreSQL row-level security.";

  if (route === "/admin/content" || route === "/admin/questions/new") {
    const result = await supabase.from("questions").select("id,level,test_section_code,item_type_code,status,created_at").order("created_at", { ascending: false }).limit(30);
    rows = (result.data ?? []) as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["Level", "level"], ["Section", "test_section_code"], ["Type", "item_type_code"], ["Status", "status"], ["Created", "created_at"]];
    sectionDescription = route.endsWith("/new")
      ? "Manual authoring workspace. Original questions use immutable revisions and require review before publication."
      : "Question records across the current authoring and review stages.";
  } else if (route === "/admin/reviews") {
    const result = await supabase.from("questions").select("id,level,test_section_code,item_type_code,created_at").eq("status", "needs_review").order("created_at", { ascending: true }).limit(50);
    rows = (result.data ?? []) as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["Level", "level"], ["Section", "test_section_code"], ["Type", "item_type_code"], ["Submitted", "created_at"], ["Question ID", "id"]];
    sectionDescription = "Review candidates are shown without any answer-key fields. Decisions are append-only in the review log.";
  } else if (route === "/admin/assets") {
    const result = await supabase.from("content_assets").select("id,media_type,status,duration_seconds,created_at").order("created_at", { ascending: false }).limit(50);
    rows = (result.data ?? []) as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["Media", "media_type"], ["Status", "status"], ["Duration", "duration_seconds"], ["Created", "created_at"]];
    sectionDescription = "Asset metadata is private. Upload access is restricted to content staff; published audio delivery still needs signed-URL server operations.";
  } else if (route === "/admin/blueprints") {
    const result = await supabase.from("exam_blueprints").select("id,level,version,status,created_at").order("created_at", { ascending: false }).limit(50);
    rows = (result.data ?? []) as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["Level", "level"], ["Version", "version"], ["Status", "status"], ["Created", "created_at"]];
    sectionDescription = "Each approved blueprint revision is immutable. Create a new version when its exam structure changes.";
  } else if (route === "/admin/exam-forms") {
    const result = await supabase.from("exam_forms").select("id,level,form_code,version,status,is_frozen,published_at").order("created_at", { ascending: false }).limit(50);
    rows = (result.data ?? []) as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["Form", "form_code"], ["Level", "level"], ["Version", "version"], ["Status", "status"], ["Frozen", "is_frozen"], ["Published", "published_at"]];
    sectionDescription = "Forms move through draft, validation, and publication. Publishing is not enabled until the validation and audit actions are installed.";
  } else if (route === "/admin/payments") {
    const result = await supabase.from("payment_submissions").select("id,user_id,plan_id,amount,currency,status,submitted_at").order("submitted_at", { ascending: true }).limit(50);
    rows = (result.data ?? []) as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["Account", "user_id"], ["Plan", "plan_id"], ["Amount", "amount"], ["Currency", "currency"], ["Status", "status"], ["Submitted", "submitted_at"]];
    sectionDescription = "Payment review is read-only here. No payment provider or verification rules have been approved, so this page cannot grant access.";
  } else if (route === "/admin/users") {
    const result = await supabase.from("user_roles").select("user_id,role,assigned_at,assigned_by").order("assigned_at", { ascending: false }).limit(100);
    rows = (result.data ?? []) as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["Account ID", "user_id"], ["Role", "role"], ["Assigned", "assigned_at"], ["Assigned by", "assigned_by"]];
    sectionDescription = "Role assignments are read-only in the browser. Changes require audited server-side operations.";
  } else if (route === "/admin/audit") {
    const result = await supabase.from("admin_audit_events").select("id,actor_user_id,action,entity_type,entity_id,created_at").order("created_at", { ascending: false }).limit(100);
    rows = (result.data ?? []) as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["Action", "action"], ["Entity", "entity_type"], ["Record", "entity_id"], ["Actor", "actor_user_id"], ["Time", "created_at"]];
    sectionDescription = "The audit table is append-only. It records sensitive changes as trusted server operations are added.";
  } else {
    const [questions, forms, assets] = await Promise.all([
      supabase.from("questions").select("id", { count: "exact", head: true }),
      supabase.from("exam_forms").select("id", { count: "exact", head: true }),
      supabase.from("content_assets").select("id", { count: "exact", head: true }),
    ]);
    rows = [
      { label: "Questions visible to your role", value: questions.count ?? 0 },
      { label: "Exam forms", value: forms.count ?? 0 },
      { label: "Content assets", value: assets.count ?? 0 },
    ];
    dataError = [questions.error, forms.error, assets.error].find(Boolean)?.message ?? "";
    columns = [["Workspace", "label"], ["Records", "value"]];
    sectionDescription = `Signed in as ${user.email ?? "staff"}. Access: ${roles.join(", ")}.`;
  }

  return (
    <ProductPage eyebrow={`Staff workspace · ${roles.join(" / ")}`} title={sectionTitle} description={sectionDescription} className="product-page--admin">
      <ProductSection title="Administration areas" className="product-section--tint">
        <PaperPanel className="admin-nav-panel"><nav className="admin-link-list" aria-label="Administration pages">{routeItems.filter((entry) => isAdmin || entry.roles.some((role) => roles.includes(role))).map((entry) => <Link className={entry.href === route ? "is-current" : ""} key={entry.href} href={entry.href}>{entry.title}<ArrowUpRight size={15} aria-hidden="true" /></Link>)}</nav></PaperPanel>
      </ProductSection>
      <ProductSection title={route === "/admin" ? "Workspace summary" : sectionTitle}>
        <PaperPanel className="data-panel">
          <p className="section-note">{dataError ? "Supabase returned an error. Confirm the database migration and the role permissions." : sectionDescription}</p>
          {dataError ? <p className="inline-notice">{dataError}</p> : route === "/admin/reviews" ? <ReviewQueue rows={rows as unknown as ReviewQueueItem[]} /> : <TableView rows={rows} columns={columns} />}
          <p className="data-footnote">These screens use the user session and database RLS. Privileged exam, asset, and payment changes must be implemented as audited server operations.</p>
        </PaperPanel>
      </ProductSection>
    </ProductPage>
  );
}
