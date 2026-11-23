import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPaymentSheetReadiness, paymentSheetErrorCode, readPaymentSheetPaymentIds } from "@/lib/google-sheets";
import { processPaymentSheetSyncBatch } from "@/lib/payment-sheet-sync-worker";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return json(403, { error: "Request origin rejected" });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return json(503, { error: "Supabase is unavailable" });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return json(401, { error: "Sign in required" });
  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || assurance?.currentLevel !== "aal2") return json(403, { error: "Administrator MFA is required" });
  const { data: roleRows, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (roleError || !roleRows?.some((row) => row.role === "admin")) return json(403, { error: "Administrator access is required" });

  const readiness = getPaymentSheetReadiness();
  if (!readiness.configured) return json(409, { error: "Integration configuration is incomplete or disabled" });

  let body: { action?: unknown };
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 1024) return json(413, { error: "Invalid request" });
    body = JSON.parse(text) as { action?: unknown };
  } catch {
    return json(400, { error: "Invalid request" });
  }
  if (body.action !== "sync" && body.action !== "retry_failed" && body.action !== "reconcile") return json(400, { error: "Unknown action" });

  if (body.action === "reconcile") {
    const { error: auditError } = await supabase.rpc("record_admin_payment_sheet_reconciliation");
    if (auditError) return json(503, { error: "Could not record the reconciliation request" });
    const service = createSupabaseServiceClient();
    if (!service) return json(503, { error: "The server-side database connection is unavailable" });
    const { data, error } = await service.rpc("get_payment_sheet_reconciliation_ids", { p_limit: 20001 });
    if (error || !data) return json(503, { error: "Could not load approved payment IDs" });
    const approvedIds = (data as { payment_submission_id: string }[]).map((row) => row.payment_submission_id);
    if (approvedIds.length > 20_000) return json(413, { error: "The approved-payment report exceeds 20,000 rows" });
    let sheetIds: string[];
    try {
      sheetIds = await readPaymentSheetPaymentIds();
    } catch (error) {
      return json(502, { error: "Could not read the spreadsheet", code: paymentSheetErrorCode(error) });
    }
    const sheetIdSet = new Set(sheetIds);
    const approvedSet = new Set(approvedIds);
    const missingRequestIds = approvedIds.filter((id) => !sheetIdSet.has(id)).slice(0, 20);
    const duplicateSheetRows = sheetIds.length - sheetIdSet.size;
    return json(200, {
      reconciliation: {
        databaseApprovedCount: approvedSet.size,
        sheetApprovedCount: approvedSet.size - approvedIds.filter((id) => !sheetIdSet.has(id)).length,
        missingInSheetCount: approvedIds.filter((id) => !sheetIdSet.has(id)).length,
        duplicateSheetRows,
        missingRequestIds,
      },
    });
  }

  let retried = 0;
  if (body.action === "retry_failed") {
    const { data, error } = await supabase.rpc("admin_retry_failed_payment_sheet_sync");
    if (error || typeof data !== "number") return json(503, { error: "Could not queue failed records" });
    retried = data;
  } else {
    const { error } = await supabase.rpc("record_admin_payment_sheet_sync_run");
    if (error) return json(503, { error: "Could not record the sync request" });
  }
  const result = await processPaymentSheetSyncBatch();
  const status = result.state === "service_unavailable" ? 503 : 200;
  return json(status, { ...result, retried });
}

