import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { PaperPanel, ProductPage, ProductSection } from "@/components/product-page";
import { ReviewQueue, type ReviewQueueItem } from "@/components/admin/review-queue";
import { QuestionAuthoringForm } from "@/components/admin/question-authoring-form";
import { AssetReviewQueue, type AssetReviewItem } from "@/components/admin/asset-review-queue";
import { AssetLibrary, type AssetLibraryDraftQuestion, type AssetLibraryRow } from "@/components/admin/asset-library";
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
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { ADMIN_NAVIGATION_ITEMS } from "@/lib/admin-navigation";
import { SelectedExamPreview, type SelectedPreviewQuestion, type SelectedPreviewSection } from "@/components/admin/selected-exam-preview";

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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section = [] } = await params;
  const query = await searchParams;
  const route = `/admin/${section.join("/")}`.replace(/\/$/, "");
  if (route === "/admin/content") redirect("/admin/questions");
  if (route === "/admin/sources") redirect("/admin/assets?view=sources");
  const item = routeItems.find((entry) => entry.href === route) ?? routeItems[0];
  const auditSearch = typeof query.q === "string" ? query.q.trim().slice(0, 120) : "";
  const auditEntity = typeof query.entity === "string" ? query.entity.trim().slice(0, 80) : "";
  const auditActor = typeof query.actor === "string" && /^[0-9a-f-]{36}$/i.test(query.actor) ? query.actor : "";
  const auditFrom = isoDateOrEmpty(query.from);
  const auditTo = isoDateOrEmpty(query.to);
  const { supabase, user } = await requireSignedInUser(route, { context: "staff" });

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

  if (route === "/admin/assets") {
    const pageValue = Array.isArray(query.page) ? query.page[0] : query.page ?? "1";
    const page = Math.max(1, Math.min(Number.parseInt(pageValue, 10) || 1, 100_000));
    const requestedStatus = Array.isArray(query.asset_status) ? query.asset_status[0] : query.asset_status ?? "";
    const assetStatus = ["draft", "needs_review", "approved", "eligible_for_exam", "rejected", "retired"].includes(requestedStatus) ? requestedStatus : "";
    const requestedType = Array.isArray(query.asset_type) ? query.asset_type[0] : query.asset_type ?? "";
    const assetType = ["image", "audio"].includes(requestedType) ? requestedType : "";
    let assetQuery = supabase.from("content_assets")
      .select("id,storage_path,media_type,duration_seconds,status,uploaded_by,created_at,file_name,file_size_bytes,processing_status", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * 50, page * 50 - 1);
    if (assetStatus) assetQuery = assetQuery.eq("status", assetStatus);
    if (assetType === "image") assetQuery = assetQuery.like("media_type", "image/%");
    if (assetType === "audio") assetQuery = assetQuery.like("media_type", "audio/%");
    const assetResult = await assetQuery;
    const rawAssets = assetResult.data ?? [];
    const assetIds = rawAssets.map((row) => row.id);
    const questionLinks = assetIds.length
      ? await supabase.from("question_assets").select("asset_id,question_id,purpose").in("asset_id", assetIds)
      : { data: [], error: null };
    const questionIds = [...new Set((questionLinks.data ?? []).map((row) => row.question_id))];
    const [questionResult, formItemsResult] = questionIds.length ? await Promise.all([
      supabase.from("questions").select("id,level,test_section_code,status,authored_by").in("id", questionIds),
      supabase.from("exam_form_items").select("question_id,exam_form_id").in("question_id", questionIds),
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    const formIds = [...new Set((formItemsResult.data ?? []).map((row) => row.exam_form_id))];
    const formsResult = formIds.length ? await supabase.from("exam_forms").select("id,form_code,status").in("id", formIds) : { data: [], error: null };
    const questionsById = new Map((questionResult.data ?? []).map((row) => [row.id, row]));
    const formsById = new Map((formsResult.data ?? []).map((row) => [row.id, row]));
    const questionFormMap = new Map<string, Set<string>>();
    for (const link of formItemsResult.data ?? []) questionFormMap.set(link.question_id, new Set([...(questionFormMap.get(link.question_id) ?? []), link.exam_form_id]));
    const assetRows: AssetLibraryRow[] = await Promise.all(rawAssets.map(async (row) => {
      const [{ data: preview }] = await Promise.all([supabase.storage.from("jlpt-question-assets").createSignedUrl(row.storage_path, 1800)]);
      const linkedQuestions = (questionLinks.data ?? []).filter((link) => link.asset_id === row.id);
      const linkedFormIds = new Set(linkedQuestions.flatMap((link) => [...(questionFormMap.get(link.question_id) ?? [])]));
      return {
        ...row,
        file_size_bytes: row.file_size_bytes === null ? null : Number(row.file_size_bytes),
        duration_seconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
        preview_url: preview?.signedUrl ?? null,
        questions: linkedQuestions.flatMap((link) => {
          const question = questionsById.get(link.question_id);
          return question ? [{ id: question.id, level: question.level, section: question.test_section_code, status: question.status, authored_by: question.authored_by, purpose: link.purpose }] : [];
        }),
        exams: [...linkedFormIds].flatMap((id) => { const form = formsById.get(id); return form ? [{ form_code: form.form_code, status: form.status }] : []; }),
      };
    }));
    const sourceResult = await supabase.from("demo_source_packets")
      .select("id,title,level,release_label,source_kind,pdf_path,pdf_file_name,pdf_bytes,audio_path,audio_file_name,audio_bytes,rights_status,rights_notes,uploaded_by,created_at")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    const sourcePackets: DemoSourcePacketRow[] = await Promise.all((sourceResult.data ?? []).map(async (row) => {
      const [{ data: pdfData }, audioResult] = await Promise.all([
        supabase.storage.from("jlpt-demo-source-materials").createSignedUrl(row.pdf_path, 3600),
        row.audio_path ? supabase.storage.from("jlpt-demo-source-materials").createSignedUrl(row.audio_path, 3600) : Promise.resolve({ data: null }),
      ]);
      return { ...row, pdf_bytes: Number(row.pdf_bytes), audio_bytes: row.audio_bytes === null ? null : Number(row.audio_bytes), pdf_url: pdfData?.signedUrl ?? null, audio_url: audioResult.data?.signedUrl ?? null };
    }));
    let draftQuestionQuery = supabase.from("questions").select("id,level,test_section_code").eq("status", "draft").order("created_at", { ascending: false }).limit(200);
    if (!isAdmin) draftQuestionQuery = draftQuestionQuery.eq("authored_by", user.id);
    const draftQuestionResult = roles.includes("content_editor") || isAdmin ? await draftQuestionQuery : { data: [], error: null };
    const draftQuestions = (draftQuestionResult.data ?? []).map((question) => ({ id: question.id, level: question.level, section: question.test_section_code })) as AssetLibraryDraftQuestion[];
    const reviewResult = roles.includes("reviewer") || isAdmin ? await supabase.rpc("get_content_asset_review_queue") : { data: [], error: null };
    const errorMessage = assetResult.error?.message ?? questionLinks.error?.message ?? questionResult.error?.message ?? formItemsResult.error?.message ?? formsResult.error?.message ?? sourceResult.error?.message ?? draftQuestionResult.error?.message ?? reviewResult.error?.message ?? "";
    const assetPageQuery = new URLSearchParams({ asset_status: assetStatus, asset_type: assetType });
    const assetPageCount = Math.max(1, Math.ceil((assetResult.count ?? 0) / 50));
    return <ProductPage eyebrow={`Staff workspace · ${roles.join(" / ")}`} title="Files & media" description="Browse private question images/audio and supplied source papers together. Preview links are short-lived and files remain private." className="product-page--admin" navigation={<AdminNavigation activePath={route} roles={roles} />}>
      <ProductSection title="Question media" className="product-section--tint"><PaperPanel className="data-panel">
        {errorMessage ? <p className="inline-notice">Some files or links could not be loaded. Check the latest media library migration and your staff role. {errorMessage}</p> : null}
        <form className="admin-export-form question-bank-filters" method="get"><div className="admin-export-form__fields"><label>Review status<select name="asset_status" defaultValue={assetStatus}><option value="">All statuses</option>{["draft", "needs_review", "approved", "eligible_for_exam", "rejected", "retired"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><label>File type<select name="asset_type" defaultValue={assetType}><option value="">All media</option><option value="image">Images</option><option value="audio">Audio</option></select></label><input type="hidden" name="page" value="1" /></div><div className="question-bank-filters__actions"><button className="btn btn--secondary" type="submit">Filter files</button><Link className="text-link" href="/admin/assets">Clear filters</Link><span className="section-note">{assetResult.count ?? "—"} registered media files</span></div></form>
        <AssetLibrary rows={assetRows} userId={user.id} isAdmin={isAdmin} canManage={roles.includes("content_editor") || isAdmin} draftQuestions={draftQuestions} />
        {assetPageCount > 1 ? <nav className="question-bank-pagination" aria-label="Media pages"><span>Page {page} of {assetPageCount}</span><div>{page > 1 ? <Link className="btn btn--secondary" href={`/admin/assets?${assetPageQuery}&page=${page - 1}`}>Previous</Link> : null}{page < assetPageCount ? <Link className="btn btn--secondary" href={`/admin/assets?${assetPageQuery}&page=${page + 1}`}>Next</Link> : null}</div></nav> : null}
      </PaperPanel></ProductSection>
      <ProductSection title="Original papers and source audio"><PaperPanel className="data-panel">
        {sourceResult.error ? <p className="inline-notice">Source files could not be loaded: {sourceResult.error.message}</p> : <DemoSourcePacketManager packets={sourcePackets} canUpload={roles.includes("content_editor") || isAdmin} canArchive={isAdmin} userId={user.id} />}
        <p className="section-note">Source originals remain private references. PDFs are not converted into question content automatically and must be reviewed by a person.</p>
      </PaperPanel></ProductSection>
      {roles.includes("reviewer") || isAdmin ? <ProductSection title="Assets awaiting review"><PaperPanel className="data-panel"><AssetReviewQueue rows={(reviewResult.data ?? []) as unknown as AssetReviewItem[]} /></PaperPanel></ProductSection> : null}
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
    const requestedFormId = Array.isArray(query.form) ? query.form[0] : query.form ?? "";
    const formListResult = await supabase.from("exam_forms").select("id,form_code,level,version,status,manifest,blueprint_id,is_frozen").order("created_at", { ascending: false }).limit(100);
    const availableForms = formListResult.data ?? [];
    const selectedForm = availableForms.find((form) => form.id === requestedFormId) ?? null;
    let previewQuestions: SelectedPreviewQuestion[] = [];
    let previewSections: SelectedPreviewSection[] = [];
    let previewError = formListResult.error?.message ?? "";
    if (selectedForm) {
      const itemResult = await supabase.from("exam_form_items").select("id,question_id,position").eq("exam_form_id", selectedForm.id).order("position");
      const itemRows = itemResult.data ?? [];
      const selectedQuestionIds = itemRows.map((item) => item.question_id);
      const questionResult = selectedQuestionIds.length ? await supabase.from("questions")
        .select("id,level,test_section_code,score_category_code,item_type_code,stimulus_group_id,prompt,options")
        .in("id", selectedQuestionIds) : { data: [], error: null };
      const questionRows = questionResult.data ?? [];
      const groupIds = [...new Set(questionRows.flatMap((question) => question.stimulus_group_id ? [question.stimulus_group_id] : []))];
      const groupResult = groupIds.length ? await supabase.from("passage_groups").select("id,content").in("id", groupIds) : { data: [], error: null };
      const questionAssetRows = selectedQuestionIds.length ? await supabase.from("question_assets").select("question_id,asset_id,purpose").in("question_id", selectedQuestionIds) : { data: [], error: null };
      const assetIdsForPreview = [...new Set((questionAssetRows.data ?? []).map((asset) => asset.asset_id))];
      const assetResult = assetIdsForPreview.length ? await supabase.from("content_assets").select("id,storage_path,media_type,file_name,status").in("id", assetIdsForPreview) : { data: [], error: null };
      const slotResult = await supabase.from("blueprint_slots").select("slot_order,test_section_code,section_duration_seconds").eq("blueprint_id", selectedForm.blueprint_id).order("slot_order");
      previewError ||= itemResult.error?.message ?? questionResult.error?.message ?? groupResult.error?.message ?? questionAssetRows.error?.message ?? assetResult.error?.message ?? slotResult.error?.message ?? "";
      const questionsById = new Map(questionRows.map((question) => [question.id, question]));
      const groupsById = new Map((groupResult.data ?? []).map((group) => [group.id, group.content]));
      const assetsById = new Map((assetResult.data ?? []).map((asset) => [asset.id, asset]));
      const mediaUrls = await Promise.all((assetResult.data ?? []).map(async (asset) => {
        const { data: signed } = await supabase.storage.from("jlpt-question-assets").createSignedUrl(asset.storage_path, 1800);
        return [asset.id, signed?.signedUrl ?? null] as const;
      }));
      const mediaUrlById = new Map(mediaUrls);
      previewQuestions = itemRows.flatMap((item) => {
        const question = questionsById.get(item.question_id);
        if (!question) return [];
        return [{
          id: question.id,
          position: item.position,
          section_code: question.test_section_code,
          item_type_code: question.item_type_code,
          score_category_code: question.score_category_code,
          stimulus: question.stimulus_group_id ? groupsById.get(question.stimulus_group_id) ?? null : null,
          prompt: question.prompt,
          options: Array.isArray(question.options) ? question.options as SelectedPreviewQuestion["options"] : [],
          assets: (questionAssetRows.data ?? []).filter((asset) => asset.question_id === question.id).flatMap((asset) => {
            const linkedAsset = assetsById.get(asset.asset_id);
            return linkedAsset ? [{ media_type: linkedAsset.media_type, purpose: asset.purpose, file_name: linkedAsset.file_name, url: mediaUrlById.get(linkedAsset.id) ?? null, status: linkedAsset.status }] : [];
          }),
        } as SelectedPreviewQuestion];
      });
      const durationBySection = new Map<string, { order: number; duration: number }>();
      for (const slot of slotResult.data ?? []) {
        const current = durationBySection.get(slot.test_section_code);
        durationBySection.set(slot.test_section_code, { order: Math.min(current?.order ?? slot.slot_order, slot.slot_order), duration: Math.max(current?.duration ?? 0, slot.section_duration_seconds) });
      }
      previewSections = [...durationBySection].sort((a, b) => a[1].order - b[1].order).map(([code, details]) => ({
        code,
        duration_seconds: details.duration,
        question_count: previewQuestions.filter((question) => question.section_code === code).length,
      }));
    }
    const manifest = selectedForm?.manifest && typeof selectedForm.manifest === "object" ? selectedForm.manifest as Record<string, unknown> : {};
    const rawDirections = manifest.candidate_instructions ?? manifest.instructions;
    const directions = Array.isArray(rawDirections) ? rawDirections.filter((value): value is string => typeof value === "string") : typeof rawDirections === "string" ? rawDirections.split(/\r?\n/).filter(Boolean) : [];
    return <ProductPage eyebrow="Staff workspace · exam manager" title="Student exam preview" description="Select any saved form to inspect its actual candidate page, paper sections, approved media and separate answer sheet." className="product-page--admin" navigation={<AdminNavigation activePath={route} roles={roles} />}>
      <ProductSection title="Choose an exam form"><PaperPanel className="data-panel">
        <form className="admin-export-form question-bank-filters" method="get" action="/admin/exam-preview"><div className="admin-export-form__fields"><label>Saved exam form<select name="form" defaultValue={selectedForm?.id ?? ""}><option value="">Choose a form</option>{availableForms.map((form) => <option value={form.id} key={form.id}>{form.form_code} · {form.level} v{form.version} · {form.status}{form.is_frozen ? " · frozen" : ""}</option>)}</select></label></div><button className="btn btn--primary" type="submit" disabled={!availableForms.length}>Preview selected form</button></form>
        {formListResult.error ? <p className="inline-notice">Exam forms could not be loaded: {formListResult.error.message}</p> : !availableForms.length ? <div className="empty-state"><p>No saved exam forms are available to preview yet.</p><Link className="text-link" href="/admin/exam-forms">Create or assemble a form</Link></div> : !selectedForm ? <p className="section-note">Choose a form to see the exact question revisions connected to it.</p> : previewError ? <p className="inline-notice">The selected form preview is incomplete: {previewError}</p> : <SelectedExamPreview formCode={selectedForm.form_code} level={selectedForm.level} version={selectedForm.version} status={selectedForm.status} title={`${selectedForm.level} Mock Examination`} directions={directions} sections={previewSections} questions={previewQuestions} />}
      </PaperPanel></ProductSection>
    </ProductPage>;
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
          <p className="section-note">{dataError ? "The data service rejected this request. Check the local schema and staff permissions." : sectionDescription}</p>
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
