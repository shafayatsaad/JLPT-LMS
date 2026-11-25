import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { ReviewQueue, type ReviewQueueItem } from "@/components/admin/review-queue";
import { QuestionAuthoringForm } from "@/components/admin/question-authoring-form";
import { AssetReviewQueue, type AssetReviewItem } from "@/components/admin/asset-review-queue";
import { BlueprintAuthoringForm, BlueprintReviewQueue, type BlueprintReviewItem } from "@/components/admin/blueprint-workflow";
import { ExamFormAssembly, ExamFormReviewQueue } from "@/components/admin/exam-form-workflow";
import { UserRoleManager, type AdminUserRow } from "@/components/admin/user-role-manager";
import { QuestionBatchImport } from "@/components/admin/question-batch-import";
import { DemoSourcePacketManager, type DemoSourcePacketRow } from "@/components/admin/demo-source-packet-manager";
import { AnnouncementWorkflow, type AdminAnnouncement } from "@/components/admin/announcement-workflow";
import { AdminDashboardSummary, type AdminDashboardData } from "@/components/admin/admin-dashboard-summary";
import { PaymentSheetSyncPanel, type PaymentSheetSyncStatus } from "@/components/admin/payment-sheet-sync-panel";
import { ManualPaymentSettingsForm, PaymentPlanManager, PaymentReviewQueue, type AdminPaymentPlan, type AdminPaymentQueueRow } from "@/components/admin/payment-admin-workflows";
import { requireSignedInUser, requireStaffMfa } from "@/lib/auth";
import { getPaymentSheetReadiness } from "@/lib/google-sheets";
import { isLocalDemoEnvironment } from "@/lib/local-demo";
import { ExamBookletRenderer } from "@/components/exam-booklet-renderer";
import { SignOutButton } from "@/components/sign-out-button";
import previewStyles from "@/components/exam-preview-admin.module.css";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { ADMIN_NAVIGATION_ITEMS } from "@/lib/admin-navigation";

export const dynamic = "force-dynamic";

const routeItems = ADMIN_NAVIGATION_ITEMS;

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

function isoDateOrEmpty(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : "";
}

export default async function AdminPage({ params, searchParams }: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<{ q?: string | string[]; entity?: string | string[]; actor?: string | string[]; from?: string | string[]; to?: string | string[] }>;
}) {
  const { section = [] } = await params;
  const query = await searchParams;
  const route = `/admin/${section.join("/")}`.replace(/\/$/, "");
  const item = routeItems.find((entry) => entry.href === route) ?? routeItems[0];
  const auditSearch = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const auditEntity = typeof query.entity === "string" ? query.entity.trim().slice(0, 80) : "";
  const auditActor = typeof query.actor === "string" && /^[0-9a-f-]{36}$/i.test(query.actor) ? query.actor : "";
  const auditFrom = isoDateOrEmpty(query.from);
  const auditTo = isoDateOrEmpty(query.to);
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
    return <ProductPage eyebrow="Staff workspace" title="This page needs a different staff role" description={`Current roles: ${roles.join(", " )}.`} navigation={<AdminNavigation activePath={route} roles={roles} />}><ProductSection title="Choose an available area"><PaperPanel><p>Open a section above to see the staff areas available to your role.</p></PaperPanel></ProductSection></ProductPage>;
  }
  await requireStaffMfa(supabase, route);

  if (route === "/admin/sources") {
    const result = await supabase.from("demo_source_packets")
      .select("id,title,level,release_label,source_kind,pdf_path,pdf_file_name,pdf_bytes,audio_path,audio_file_name,audio_bytes,rights_status,rights_notes,created_at")
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    const packets: DemoSourcePacketRow[] = await Promise.all((result.data ?? []).map(async (row) => {
      const [{ data: pdfData }, audioResult] = await Promise.all([
        supabase.storage.from("jlpt-demo-source-materials").createSignedUrl(row.pdf_path, 3600),
        row.audio_path ? supabase.storage.from("jlpt-demo-source-materials").createSignedUrl(row.audio_path, 3600) : Promise.resolve({ data: null }),
      ]);
      return { ...row, pdf_url: pdfData?.signedUrl ?? null, audio_url: audioResult.data?.signedUrl ?? null };
    }));
    return <ProductPage eyebrow={`Staff workspace · ${roles.join(" / ")}`} title="Source Library" description="Keep owner-provided PDF and audio references private and separate from publishable question content." className="product-page--admin" navigation={<AdminNavigation activePath={route} roles={roles} />}>
      <ProductSection title="Upload and inspect private demo material"><PaperPanel className="data-panel">{result.error ? <p className="inline-notice">The source library migration is not available yet: {result.error.message}</p> : null}<DemoSourcePacketManager packets={packets} canUpload={roles.includes("content_editor") || isAdmin} canArchive={isAdmin} /></PaperPanel></ProductSection>
    </ProductPage>;
  }

  if (route === "/admin/content") {
    const questionStatuses = ["draft", "needs_review", "approved", "eligible_for_exam", "rejected", "retired"] as const;
    const [questionCounts, assetCounts] = await Promise.all([
      Promise.all(questionStatuses.map(async (status) => {
        const result = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", status);
        return { status, count: result.count, error: result.error };
      })),
      Promise.all(["draft", "needs_review", "approved"].map(async (status) => {
        const result = await supabase.from("content_assets").select("id", { count: "exact", head: true }).eq("status", status);
        return { status, count: result.count, error: result.error };
      })),
    ]);
    const contentError = [...questionCounts, ...assetCounts].find((item) => item.error)?.error?.message;
    const canEditContent = roles.includes("content_editor") || isAdmin;
    const canReviewContent = roles.includes("reviewer") || isAdmin;
    return <ProductPage eyebrow={`Staff workspace · ${roles.join(" / ")}`} title="Content workspace" description="Track original question revisions from draft through review and exam eligibility. Imports create drafts; they never publish content." className="product-page--admin" navigation={<AdminNavigation activePath={route} roles={roles} />}>
      <ProductSection title="Question pipeline" className="product-section--tint">
        <PaperPanel className="data-panel">
          {contentError ? <p className="inline-notice">Question or asset counts could not be loaded. Check the content workflow migrations and current staff role.</p> : null}
          <div className="table-scroll"><table><thead><tr><th>Question status</th><th>Count</th><th>Open</th></tr></thead><tbody>{questionCounts.map(({ status, count }) => <tr key={status}><th scope="row">{status.replaceAll("_", " ")}</th><td>{count ?? "—"}</td><td><Link className="text-link" href={`/admin/questions?status=${status}`}>View questions <ArrowUpRight size={14} aria-hidden="true" /></Link></td></tr>)}</tbody></table></div>
          <div className="product-cta-row"><Link className="btn btn--primary" href="/admin/questions">Open Question Bank</Link>{canEditContent ? <Link className="btn btn--secondary" href="/admin/questions/new#manual-question">Add a question</Link> : null}{canReviewContent ? <Link className="btn btn--secondary" href="/admin/reviews">Review pending questions</Link> : null}</div>
          <p className="data-footnote">Question revisions and audit events preserve the review trail. There is no separate content-history page. Folder imports validate before confirmation and write drafts immediately; no background import-job queue is configured.</p>
        </PaperPanel>
      </ProductSection>
      <ProductSection title="Media and source rights">
        <div className="account-destination-list">
          <PaperPanel className="data-panel"><h3>Media library</h3><p>Inspect image and audio assets submitted for independent review.</p>{assetCounts.some((item) => item.error) ? <p className="inline-notice">Media counts are unavailable.</p> : <ul className="record-list">{assetCounts.map(({ status, count }) => <li key={status}><span>{status.replaceAll("_", " ")}</span><strong>{count ?? "—"}</strong></li>)}</ul>}<Link className="text-link" href="/admin/assets">Open media review <ArrowUpRight size={14} aria-hidden="true" /></Link></PaperPanel>
          <PaperPanel className="data-panel"><h3>Source library</h3><p>Keep supplied papers and audio separate from original or licensed question content.</p><Link className="text-link" href="/admin/sources">Open source library <ArrowUpRight size={14} aria-hidden="true" /></Link></PaperPanel>
        </div>
      </ProductSection>
    </ProductPage>;
  }

  if (route === "/admin/exam-preview") {
    return (
      <main className={previewStyles.page}>
        <AdminNavigation activePath={route} roles={roles} />
        <Link className={previewStyles.back} href="/admin">← Return to staff workspace</Link>
        <header className={previewStyles.heading}><div><p>Staff preview · N5-DEMO-01</p><h1>Exam Preview</h1></div><span>Review the same monochrome question booklet and separate answer sheet shown in the learner sample.</span><SignOutButton className={previewStyles.signOut} /></header>
        <div className={previewStyles.frame}><ExamBookletRenderer adminPreview /></div>
      </main>
    );
  }

  if (route === "/admin/settings/integrations") {
    const readiness = getPaymentSheetReadiness();
    const demoMode = isLocalDemoEnvironment();
    const { data: syncRows, error: syncError } = await supabase.rpc("get_admin_payment_sheet_sync_status");
    const privateImageStorageConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
    const safeSyncRows = (syncRows ?? []) as PaymentSheetSyncStatus[];

    return (
      <ProductPage eyebrow="Staff workspace · admin only" title="Integrations" description="Review the payment reporting connection, sync queue, and remaining owner setup. Secret values are never displayed." className="product-page--admin" navigation={<AdminNavigation activePath={route} roles={roles} />}>
        <ProductSection title="Google Sheets status" className="product-section--tint">
          <PaperPanel className="data-panel integration-panel">
            <p className="integration-state"><span className={`status-chip${readiness.configured || demoMode ? "" : " status-chip--muted"}`}>{demoMode ? "Local simulation · Google not contacted" : readiness.configured ? "Enabled · required values present, connection unverified" : readiness.enabled ? "Enabled with incomplete configuration" : "Disabled by default"}</span></p>
            <PaymentSheetSyncPanel readiness={readiness} rows={safeSyncRows} migrationAvailable={!syncError} demoMode={demoMode} />
            <h3>Private image uploads</h3>
            <div className="integration-checks">
              <div><span>Server storage credential present</span><strong>{privateImageStorageConfigured ? "Yes" : "No"}</strong></div>
              <div><span>Storage bucket and credential verified</span><strong>Not checked</strong></div>
            </div>
            <p className="section-note">Receipt and support-image uploads also require the private Supabase buckets and migration policies to be applied; the credential value is never displayed.</p>
            <p><Link className="text-link" href="/admin">Return to staff overview <ArrowUpRight size={15} aria-hidden="true" /></Link></p>
          </PaperPanel>
        </ProductSection>
        <ProductSection title="Access boundary">
          <PaperPanel className="statement-panel"><p>This page is restricted to staff with the admin role. Google Drive sharing must also be limited to the named administrator accounts you authorize; the app’s admin role does not automatically grant access inside Google Sheets.</p></PaperPanel>
        </ProductSection>
      </ProductPage>
    );
  }

  let rows: Record<string, unknown>[] = [];
  let columns: [string, string][] = [];
  let dataError = "";
  let blueprintReviewRows: BlueprintReviewItem[] = [];
  let examFormRows: { id: string; form_code: string; level: string; version: number; status: string; access_tier: string; is_frozen: boolean; published_at: string | null; created_by: string; item_count: number }[] = [];
  let adminUserRows: AdminUserRow[] = [];
  let announcementRows: AdminAnnouncement[] = [];
  let paymentQueueRows: AdminPaymentQueueRow[] = [];
  let paymentPlanRows: AdminPaymentPlan[] = [];
  let paymentSettings = null as {
    is_enabled: boolean;
    recipient_display_name: string | null;
    recipient_number: string | null;
    recipient_account_type: string | null;
    instructions_en: string | null;
    instructions_bn: string | null;
    reference_required: boolean;
    support_contact: string | null;
  } | null;
  let dashboardSummary: AdminDashboardData | null = null;
  let sectionDescription = "Records shown here are limited by the signed-in staff role and PostgreSQL row-level security.";

  if (route === "/admin") {
    const result = await supabase.rpc("get_admin_dashboard_summary");
    dataError = result.error?.message ?? "";
    if (result.data && !result.error) {
      const canEditContent = roles.includes("content_editor") || isAdmin;
      const canReviewExams = roles.includes("reviewer") || isAdmin;
      const [questionDrafts, examFormDrafts, examFormsReady] = await Promise.all([
        canEditContent ? supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", "draft") : Promise.resolve({ count: null, error: null }),
        canEditContent ? supabase.from("exam_forms").select("id", { count: "exact", head: true }).eq("status", "draft") : Promise.resolve({ count: null, error: null }),
        canReviewExams ? supabase.from("exam_forms").select("id", { count: "exact", head: true }).eq("status", "validated") : Promise.resolve({ count: null, error: null }),
      ]);
      dataError ||= [questionDrafts.error, examFormDrafts.error, examFormsReady.error].find(Boolean)?.message ?? "";
      dashboardSummary = {
        ...(result.data as AdminDashboardData),
        question_drafts: questionDrafts.count ?? null,
        exam_form_drafts: examFormDrafts.count ?? null,
        exam_forms_ready_to_publish: examFormsReady.count ?? null,
      };
    }
    sectionDescription = `Operational counts and quick links for your staff roles: ${roles.join(", ")}. Restricted account, payment, review and support totals are returned only to their authorized roles.`;
  } else if (route === "/admin/content" || route === "/admin/questions/new") {
    const result = await supabase.from("questions").select("id,level,test_section_code,item_type_code,status,created_at").order("created_at", { ascending: false }).limit(30);
    rows = (result.data ?? []) as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["Level", "level"], ["Section", "test_section_code"], ["Type", "item_type_code"], ["Status", "status"], ["Created", "created_at"]];
    sectionDescription = route.endsWith("/new")
      ? "Manual authoring workspace. Original questions use immutable revisions and require review before publication."
      : "Question records across the current authoring and review stages.";
  } else if (route === "/admin/reviews") {
    const result = await supabase.rpc("get_question_review_queue");
    rows = (result.data ?? []) as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["Level", "level"], ["Section", "test_section_code"], ["Type", "item_type_code"], ["Submitted", "created_at"], ["Question ID", "id"]];
    sectionDescription = "Review candidates include prompt, options, answer key and provenance. Decisions require a reviewer role, cannot be self-approved, and are recorded in the review log.";
  } else if (route === "/admin/assets") {
    const result = await supabase.rpc("get_content_asset_review_queue");
    rows = (result.data ?? []) as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["Media", "media_type"], ["Status", "status"], ["Duration", "duration_seconds"], ["Created", "created_at"]];
    sectionDescription = "Private audio and image assets can be uploaded from an authored draft. Reviewers can inspect and approve the queued file before a frozen form may use it.";
  } else if (route === "/admin/blueprints") {
    const result = await supabase.from("exam_blueprints").select("id,level,version,status,created_at").order("created_at", { ascending: false }).limit(50);
    rows = (result.data ?? []) as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["Level", "level"], ["Version", "version"], ["Status", "status"], ["Created", "created_at"]];
    if (roles.includes("reviewer") || isAdmin) {
      const reviewResult = await supabase.rpc("get_exam_blueprint_review_queue");
      blueprintReviewRows = (reviewResult.data ?? []) as unknown as BlueprintReviewItem[];
      dataError ||= reviewResult.error?.message ?? "";
    }
    sectionDescription = "Build editable structural drafts, submit them for independent review, and keep each approved revision immutable.";
  } else if (route === "/admin/exam-forms") {
    const result = await supabase.from("exam_forms").select("id,level,form_code,version,status,is_frozen,access_tier,published_at,created_by").order("created_at", { ascending: false }).limit(50);
    rows = (result.data ?? []) as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    if (result.data?.length) {
      const itemResult = await supabase.from("exam_form_items").select("exam_form_id").in("exam_form_id", result.data.map((form) => form.id));
      dataError ||= itemResult.error?.message ?? "";
      const itemCounts = new Map<string, number>();
      for (const formItem of itemResult.data ?? []) itemCounts.set(formItem.exam_form_id, (itemCounts.get(formItem.exam_form_id) ?? 0) + 1);
      examFormRows = result.data.map((form) => ({ ...form, item_count: itemCounts.get(form.id) ?? 0 }));
    }
    columns = [["Form", "form_code"], ["Level", "level"], ["Version", "version"], ["Access", "access_tier"], ["Status", "status"], ["Frozen", "is_frozen"], ["Published", "published_at"]];
    sectionDescription = "Assemble a form against an approved blueprint, select approved questions to the exact quota, then use independent validation and frozen publication.";
  } else if (route === "/admin/payments") {
    const result = await supabase.rpc("get_admin_payment_review_queue", { p_status: null, p_from_date: null, p_to_date: null, p_search: null });
    paymentQueueRows = (result.data ?? []) as AdminPaymentQueueRow[];
    rows = paymentQueueRows as unknown as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    sectionDescription = "Review bKash Send Money requests against the trusted account record. Approval is a guarded database transaction; submitted data and screenshots never grant access on their own.";
  } else if (route === "/admin/plans") {
    const result = await supabase.rpc("get_admin_payment_plans");
    paymentPlanRows = (result.data ?? []) as AdminPaymentPlan[];
    rows = paymentPlanRows as unknown as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    sectionDescription = "Configure fixed-duration BDT plans for new purchases. Historical requests retain the plan, price and entitlement snapshot they were submitted with.";
  } else if (route === "/admin/settings/payments") {
    const result = await supabase.rpc("get_admin_payment_settings");
    paymentSettings = result.data && typeof result.data === "object" ? result.data as typeof paymentSettings : null;
    dataError = result.error?.message ?? "";
    sectionDescription = "Payment checkout remains closed until the owner supplies verified bKash account details and approves both language versions of the instructions.";
  } else if (route === "/admin/reports") {
    sectionDescription = "Export the payment ledger for a UTC submission-date range. Sender numbers are masked by default, and each generated file is recorded in the audit history.";
  } else if (route === "/admin" && roles.includes("support_agent") && !roles.some((role) => ["content_editor", "reviewer", "payment_reviewer", "admin"].includes(role))) {
    const result = await supabase.from("support_tickets").select("id", { count: "exact", head: true });
    dataError = result.error?.message ?? "";
    rows = [{ label: "Support requests visible to your role", value: result.error ? "Unavailable" : result.count ?? 0 }];
    columns = [["Queue", "label"], ["Count", "value"]];
    sectionDescription = "This account has support-only staff access. Open the support queue to review requests and reply to learners.";
  } else if (route === "/admin/users") {
    const result = await supabase.rpc("get_admin_user_directory");
    adminUserRows = (result.data ?? []) as AdminUserRow[];
    rows = adminUserRows as unknown as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["Account", "email"], ["Name", "display_name"], ["Roles", "roles"], ["Registered", "registered_at"], ["Account ID", "user_id"]];
    sectionDescription = "The private account directory and audited role controls are restricted to administrators. Assign staff access only to known, verified accounts.";
  } else if (route === "/admin/announcements") {
    const result = await supabase.rpc("list_admin_announcements");
    announcementRows = (result.data ?? []) as AdminAnnouncement[];
    rows = announcementRows as unknown as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["English title", "title_en"], ["বাংলা শিরোনাম", "title_bn"], ["Status", "status"], ["Recipients", "recipient_count"], ["Published", "published_at"]];
    sectionDescription = "Create reviewed English and Bangla in-app notices. Publishing is an audited, idempotent admin action that respects each learner's optional service-notice preference.";
  } else if (route === "/admin/audit") {
    let auditQuery = supabase.from("admin_audit_events").select("id,actor_user_id,action,entity_type,entity_id,after_state,created_at").order("created_at", { ascending: false }).limit(100);
    if (auditSearch) auditQuery = auditQuery.ilike("action", `%${auditSearch}%`);
    if (auditEntity) auditQuery = auditQuery.eq("entity_type", auditEntity);
    if (auditActor) auditQuery = auditQuery.eq("actor_user_id", auditActor);
    if (auditFrom) auditQuery = auditQuery.gte("created_at", `${auditFrom}T00:00:00.000Z`);
    if (auditTo) auditQuery = auditQuery.lte("created_at", `${auditTo}T23:59:59.999Z`);
    const result = await auditQuery;
    rows = (result.data ?? []) as Record<string, unknown>[];
    dataError = result.error?.message ?? "";
    columns = [["Action", "action"], ["Entity", "entity_type"], ["Record", "entity_id"], ["Details", "after_state"], ["Actor", "actor_user_id"], ["Time", "created_at"]];
    sectionDescription = "Search the append-only privileged activity log. Each view is restricted to administrators with AAL2 and shows up to 100 matching events.";
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

  const reportToDateValue = new Date();
  const reportFromDateValue = new Date(reportToDateValue);
  reportFromDateValue.setDate(reportFromDateValue.getDate() - 29);
  const reportToDate = reportToDateValue.toISOString().slice(0, 10);
  const reportFromDate = reportFromDateValue.toISOString().slice(0, 10);

  return (
    <ProductPage eyebrow={`Staff workspace · ${roles.join(" / ")}`} title={sectionTitle} description={sectionDescription} className="product-page--admin" navigation={<AdminNavigation activePath={route} roles={roles} />}>
      {route === "/admin/questions/new" ? <ProductSection title="Draft authoring reference" className="product-section--tint"><PaperPanel className="statement-panel"><p>Manual authoring and folder-based JSON import both create drafts with separate answer keys and provenance records. The downloadable original N5 example is a reference item, not approved exam content.</p><div className="product-cta-row"><a className="btn btn--secondary" href="/templates/jlpt-question-authoring-demo.json" download="manifest.json">Download manifest example</a><Link className="text-link" href="/admin/content">View question inventory <ArrowUpRight size={15} aria-hidden="true" /></Link></div><p className="section-note">Place the downloaded <code>manifest.json</code> beside the referenced media files, then select its containing folder in the importer below.</p></PaperPanel></ProductSection> : null}
      {route === "/admin/questions/new" ? <ProductSection title="Import question drafts"><PaperPanel className="data-panel"><QuestionBatchImport /></PaperPanel></ProductSection> : null}
      {route === "/admin/questions/new" ? <ProductSection title="Create a question draft"><PaperPanel className="data-panel"><QuestionAuthoringForm /></PaperPanel></ProductSection> : null}
      {!(["/admin/payments", "/admin/plans", "/admin/settings/payments"].includes(route)) ? <ProductSection title={route === "/admin" ? "Workspace summary" : sectionTitle}>
        <PaperPanel className="data-panel">
          <p className="section-note">{dataError ? "Supabase returned an error. Confirm the database migration and the role permissions." : sectionDescription}</p>
          {dataError ? <p className="inline-notice">{dataError}</p> : route === "/admin" ? dashboardSummary ? <AdminDashboardSummary summary={dashboardSummary} canSeeAudit={isAdmin} /> : <p className="empty-state">The summary is unavailable. Confirm migration 030 and the current staff role.</p> : route === "/admin/audit" ? <><form className="admin-export-form" method="get">
            <div className="admin-export-form__fields">
              <label>Action contains<input name="q" maxLength={120} defaultValue={auditSearch} /></label>
              <label>Entity type<input name="entity" maxLength={80} defaultValue={auditEntity} /></label>
              <label>Actor account ID<input name="actor" maxLength={36} inputMode="text" defaultValue={auditActor} /></label>
              <label>From (UTC)<input type="date" name="from" defaultValue={auditFrom} /></label>
              <label>Through (UTC)<input type="date" name="to" defaultValue={auditTo} /></label>
            </div>
            <button className="btn btn--secondary" type="submit">Search audit log</button>
            <p className="section-note">Date and identifier filters are applied on the server. Narrow the range if more than 100 records match.</p>
          </form><TableView rows={rows} columns={columns} /></> : route === "/admin/reports" ? <form className="admin-export-form" action="/admin/reports/export" method="get">
            <div className="admin-export-form__fields">
              <label>From (UTC)<input type="date" name="from" required defaultValue={reportFromDate} /></label>
              <label>Through (UTC)<input type="date" name="to" required defaultValue={reportToDate} /></label>
              <label>File format<select name="format" defaultValue="xlsx"><option value="xlsx">Excel workbook (.xlsx)</option><option value="csv">CSV (.csv)</option></select></label>
            </div>
            {isAdmin ? <label className="admin-export-form__sensitive"><input type="checkbox" name="unmask" value="1" /> Include unmasked sender numbers (admin only)</label> : null}
            <p className="section-note">Reports include contact and payment details. Sender numbers stay masked unless an administrator explicitly selects the option above. Google Sheets sync is not configured.</p>
            <button className="btn btn--primary" type="submit">Download report</button>
          </form> : route === "/admin/reviews" ? <ReviewQueue rows={rows as unknown as ReviewQueueItem[]} /> : route === "/admin/assets" && (roles.includes("reviewer") || isAdmin) ? <AssetReviewQueue rows={rows as unknown as AssetReviewItem[]} /> : route === "/admin/users" || route === "/admin/announcements" || route === "/admin/blueprints" || route === "/admin/exam-forms" || route === "/admin/payments" || route === "/admin/plans" || route === "/admin/settings/payments" ? null : <TableView rows={rows} columns={columns} />}
          <p className="data-footnote">These screens use the signed-in user session. Staff, content and exam changes are checked by database roles and recorded in the audit log.</p>
        </PaperPanel>
      </ProductSection> : null}
      {route === "/admin/blueprints" ? <>
        {roles.includes("content_editor") || isAdmin ? <ProductSection title="Create a blueprint draft"><PaperPanel className="data-panel"><div id="create-blueprint"><BlueprintAuthoringForm /></div></PaperPanel></ProductSection> : null}
        {roles.includes("reviewer") || isAdmin ? <ProductSection title="Blueprint review queue"><PaperPanel className="data-panel"><BlueprintReviewQueue rows={blueprintReviewRows} /></PaperPanel></ProductSection> : null}
        <ProductSection title="Blueprint inventory"><PaperPanel className="data-panel"><TableView rows={rows} columns={columns} /></PaperPanel></ProductSection>
      </> : null}
      {route === "/admin/exam-forms" ? <>
        <ProductSection title="Assemble a form"><PaperPanel className="data-panel"><ExamFormAssembly enabled={roles.includes("content_editor") || isAdmin} allowFree={isAdmin} /></PaperPanel></ProductSection>
        <ProductSection title="Validation and publication queue"><PaperPanel className="data-panel"><ExamFormReviewQueue rows={examFormRows} currentUserId={user.id} /></PaperPanel></ProductSection>
      </> : null}
      {route === "/admin/users" ? <ProductSection title="Account and staff roles"><PaperPanel className="data-panel"><UserRoleManager rows={adminUserRows} /></PaperPanel></ProductSection> : null}
      {route === "/admin/announcements" ? <ProductSection title="Announcement drafts and publishing"><PaperPanel className="data-panel">{dataError ? <p className="inline-notice">Announcement tools are unavailable. Confirm migration 019 and the admin role are active.</p> : <AnnouncementWorkflow announcements={announcementRows} />}</PaperPanel></ProductSection> : null}
      {route === "/admin/payments" ? <ProductSection title="Payment request queue"><PaperPanel className="data-panel">{dataError ? <p className="inline-notice">Payment review is unavailable. Confirm migration 022 and the payment reviewer role.</p> : <PaymentReviewQueue initialRows={paymentQueueRows} />}</PaperPanel></ProductSection> : null}
      {route === "/admin/plans" ? <ProductSection title="Plan catalog"><PaperPanel className="data-panel">{dataError ? <p className="inline-notice">Plan management is unavailable. Confirm migration 022 and the admin role.</p> : <PaymentPlanManager plans={paymentPlanRows} />}</PaperPanel></ProductSection> : null}
      {route === "/admin/settings/payments" ? <ProductSection title="bKash Send Money settings"><PaperPanel className="data-panel">{dataError || !paymentSettings ? <p className="inline-notice">Payment settings are unavailable. Confirm migration 022 and the admin role.</p> : <ManualPaymentSettingsForm settings={paymentSettings} />}</PaperPanel></ProductSection> : null}
    </ProductPage>
  );
}
