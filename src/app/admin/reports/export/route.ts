import ExcelJS from "exceljs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasStaffMfaAssurance } from "@/lib/auth";
import { resolveRequestStepUpAccess } from "@/lib/auth-step-up";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExportRow = Record<string, string | number | null>;

const columns: [string, string][] = [
  ["Payment Request ID", "payment_request_id"],
  ["Submitted At (UTC)", "submitted_at_utc"],
  ["Submitted At (Bangladesh time)", "submitted_at_bangladesh"],
  ["Student ID", "student_id"],
  ["Student Name", "student_name"],
  ["Student Email", "student_email"],
  ["Plan Code", "plan_code"],
  ["Plan Name", "plan_name"],
  ["Expected Amount", "expected_amount"],
  ["Submitted Amount", "submitted_amount"],
  ["Currency", "currency"],
  ["Payment Method", "payment_method"],
  ["Sender Name", "sender_name"],
  ["Sender Number", "sender_number"],
  ["Transaction ID", "transaction_id"],
  ["Reference Number", "reference_number"],
  ["Payment Date/Time", "payment_at"],
  ["Status", "status"],
  ["Reviewer", "reviewer"],
  ["Reviewed At", "reviewed_at"],
  ["Rejection Reason", "rejection_reason"],
  ["Entitlement Start", "entitlement_start"],
  ["Entitlement Expiry", "entitlement_expiry"],
  ["Spreadsheet Sync Status", "spreadsheet_sync_status"],
];

function failure(status: number, message: string) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function safeText(value: unknown) {
  const text = value == null ? "" : String(value);
  return /^[\u0000-\u0020]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function csv(rows: ExportRow[]) {
  const values = [columns.map(([label]) => label), ...rows.map((row) => columns.map(([, key]) => safeText(row[key])))];
  const body = values.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  return Buffer.from(`\uFEFF${body}\r\n`, "utf8");
}

async function xlsx(rows: ExportRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "JLPT Platform";
  workbook.subject = "Audited payment report";
  const sheet = workbook.addWorksheet("Payments", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map(([header]) => ({ header, width: Math.min(Math.max(header.length + 3, 16), 32) }));
  sheet.addRows(rows.map((row) => columns.map(([, key]) => safeText(row[key]))));
  sheet.getRow(1).font = { bold: true, color: { argb: "FF603546" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEDF0" } };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");
  const format = url.searchParams.get("format");

  if (!validDate(fromDate) || !validDate(toDate) || toDate < fromDate) {
    return failure(400, "Choose a valid start and end date.");
  }
  if (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`) > 365 * 24 * 60 * 60 * 1000) {
    return failure(400, "Choose a date range of 366 days or less.");
  }
  if (format !== "csv" && format !== "xlsx") {
    return failure(400, "Choose CSV or XLSX format.");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure(503, "Supabase is not configured for this environment.");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.redirect(new URL("/admin/sign-in", request.url), 303);
  }

  const stepUp = await resolveRequestStepUpAccess(supabase);
  if (stepUp === "required") {
    const nextPath = `${url.pathname}${url.search}`;
    return Response.redirect(new URL(`/auth/continue?next=${encodeURIComponent(nextPath)}`, request.url), 303);
  }
  if (stepUp === "unavailable") return failure(503, "Sign-in verification is not available. Confirm the Supabase Auth Hook setup.");

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (roleError) return failure(503, "Staff permissions are unavailable. Confirm the hosted database setup.");
  const roles = roleRows?.map((row) => row.role as string) ?? [];
  if (!roles.some((role) => role === "admin" || role === "payment_reviewer")) {
    return failure(403, "Payment report access is required.");
  }
  if (!(await hasStaffMfaAssurance(supabase))) {
    const nextPath = `${url.pathname}${url.search}`;
    return Response.redirect(new URL(`/admin/mfa?next=${encodeURIComponent(nextPath)}`, request.url), 303);
  }

  const unmask = url.searchParams.get("unmask") === "1" && roles.includes("admin");
  const { data, error } = await supabase.rpc("get_admin_payment_export_rows", {
    p_from_date: fromDate,
    p_to_date: toDate,
    p_format: format,
    p_unmask: unmask,
  });
  if (error) {
    console.error("Payment report export is unavailable:", error.message);
    return failure(503, "Payment reporting is unavailable. Confirm migration 020 has been applied.");
  }

  const rows = (data ?? []) as ExportRow[];
  const filename = `jlpt-payment-report-${fromDate}-to-${toDate}.${format}`;
  const body = format === "csv" ? csv(rows) : await xlsx(rows);
  return new Response(body, {
    headers: {
      "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
