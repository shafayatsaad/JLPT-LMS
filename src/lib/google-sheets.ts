import "server-only";

import { GoogleAuth } from "google-auth-library";

export const PAYMENT_SHEET_HEADERS = [
  "Payment Request ID", "Submitted At (UTC)", "Submitted At (Asia/Dhaka)",
  "Student ID", "Student Name", "Student Email", "Plan Code", "Plan Name",
  "Expected Amount", "Submitted Amount", "Currency", "Payment Method",
  "Sender Name", "Sender Number (Masked)", "Transaction ID", "Reference Number",
  "Payment At", "Status", "Reviewer", "Reviewed At", "Rejection Reason",
  "Entitlement Start", "Entitlement Expiry", "Sheets Sync Status",
] as const;

export type PaymentSheetRow = {
  payment_submission_id: string;
  revision: number;
  lease_token: string;
  submitted_at_utc: string;
  submitted_at_bangladesh: string;
  student_id: string;
  student_name: string | null;
  student_email: string | null;
  plan_code: string;
  plan_name: string;
  expected_amount: number;
  submitted_amount: number;
  currency: string;
  payment_method: string;
  sender_name: string | null;
  sender_number_masked: string | null;
  transaction_id: string | null;
  reference_number: string | null;
  payment_at: string | null;
  payment_status: string;
  reviewer: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  entitlement_start: string | null;
  entitlement_expiry: string | null;
};

export type SheetSyncErrorCode =
  | "configuration_missing" | "google_auth_failed" | "google_access_denied"
  | "google_rate_limited" | "google_unavailable" | "google_request_failed"
  | "sheet_header_mismatch" | "invalid_sheet_response" | "sync_failed";

export class SheetSyncError extends Error {
  constructor(readonly code: SheetSyncErrorCode) {
    super(code);
    this.name = "SheetSyncError";
  }
}

type GoogleValueResponse = { values?: unknown[][] };

function configuration() {
  const enabled = process.env.GOOGLE_SHEETS_SYNC_ENABLED === "true";
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() ?? "";
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim() ?? "";
  const privateKey = (process.env.GOOGLE_SHEETS_PRIVATE_KEY?.trim() ?? "").replace(/\\n/g, "\n");
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME?.trim() || "Payments";

  if (!enabled || !spreadsheetId || !clientEmail || !privateKey
    || !/^[A-Za-z0-9_-]{20,}$/.test(spreadsheetId) || !clientEmail.includes("@")) {
    throw new SheetSyncError("configuration_missing");
  }
  return { spreadsheetId, clientEmail, privateKey, sheetName };
}

async function getAccessToken(config: ReturnType<typeof configuration>) {
  try {
    const auth = new GoogleAuth({
      credentials: { client_email: config.clientEmail, private_key: config.privateKey },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      clientOptions: { transporterOptions: { timeout: 8000 } },
    });
    const token = await auth.getAccessToken();
    if (!token) throw new SheetSyncError("google_auth_failed");
    return token;
  } catch (error) {
    if (error instanceof SheetSyncError) throw error;
    const source = error as { response?: { status?: unknown }; code?: unknown };
    const status = typeof source?.response?.status === "number" ? source.response.status : 0;
    if (status === 403) throw new SheetSyncError("google_access_denied");
    if (status === 429) throw new SheetSyncError("google_rate_limited");
    if (status >= 500 || ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND"].includes(String(source?.code))) {
      throw new SheetSyncError("google_unavailable");
    }
    throw new SheetSyncError("google_auth_failed");
  }
}

function tabRange(sheetName: string, range: string) {
  return "'" + sheetName.replace(/'/g, "''") + "'!" + range;
}

function valuesUrl(spreadsheetId: string, range: string) {
  return "https://sheets.googleapis.com/v4/spreadsheets/"
    + encodeURIComponent(spreadsheetId) + "/values/" + encodeURIComponent(range);
}

async function googleRequest(url: string, token: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        authorization: "Bearer " + token,
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new SheetSyncError("google_unavailable");
  }
  if (!response.ok) {
    if (response.status === 403) throw new SheetSyncError("google_access_denied");
    if (response.status === 429) throw new SheetSyncError("google_rate_limited");
    if (response.status >= 500) throw new SheetSyncError("google_unavailable");
    throw new SheetSyncError("google_request_failed");
  }
  return response;
}

async function getValues(url: string, token: string) {
  const response = await googleRequest(url, token);
  const body = await response.json().catch(() => null) as GoogleValueResponse | null;
  if (!body || (body.values !== undefined && !Array.isArray(body.values))) {
    throw new SheetSyncError("invalid_sheet_response");
  }
  return body.values ?? [];
}

async function writeValues(url: string, token: string, values: unknown[][], append = false) {
  const target = new URL(url);
  if (append) target.pathname += ":append";
  target.searchParams.set("valueInputOption", "RAW");
  if (append) target.searchParams.set("insertDataOption", "INSERT_ROWS");
  await googleRequest(target.toString(), token, {
    method: append ? "POST" : "PUT",
    body: JSON.stringify({ majorDimension: "ROWS", values }),
  });
}

async function batchUpdateValues(spreadsheetId: string, token: string, data: { range: string; values: unknown[][] }[]) {
  const url = "https://sheets.googleapis.com/v4/spreadsheets/" + encodeURIComponent(spreadsheetId) + "/values:batchUpdate";
  await googleRequest(url, token, {
    method: "POST",
    body: JSON.stringify({ valueInputOption: "RAW", data: data.map((item) => ({ ...item, majorDimension: "ROWS" })) }),
  });
}

async function prepareSheet(config: ReturnType<typeof configuration>, token: string) {
  const headerUrl = valuesUrl(config.spreadsheetId, tabRange(config.sheetName, "A1:X1"));
  const rows = await getValues(headerUrl, token);
  if (rows.length === 0 || !Array.isArray(rows[0]) || rows[0].length === 0) {
    await writeValues(headerUrl, token, [[...PAYMENT_SHEET_HEADERS]]);
    return;
  }
  const existing = rows[0].map((value) => String(value ?? ""));
  if (existing.length !== PAYMENT_SHEET_HEADERS.length
    || PAYMENT_SHEET_HEADERS.some((header, index) => existing[index] !== header)) {
    throw new SheetSyncError("sheet_header_mismatch");
  }
}

function cell(value: string | number | null | undefined) {
  return value == null ? "" : String(value);
}

function rowValues(row: PaymentSheetRow): string[] {
  return [
    row.payment_submission_id, row.submitted_at_utc, row.submitted_at_bangladesh,
    row.student_id, cell(row.student_name), cell(row.student_email), row.plan_code,
    row.plan_name, cell(row.expected_amount), cell(row.submitted_amount), row.currency,
    row.payment_method, cell(row.sender_name), cell(row.sender_number_masked),
    cell(row.transaction_id), cell(row.reference_number), cell(row.payment_at),
    row.payment_status, cell(row.reviewer), cell(row.reviewed_at),
    cell(row.rejection_reason), cell(row.entitlement_start), cell(row.entitlement_expiry),
    "synced",
  ];
}

export async function upsertPaymentRows(rows: PaymentSheetRow[]) {
  if (rows.length === 0) return;
  const config = configuration();
  const token = await getAccessToken(config);
  await prepareSheet(config, token);

  const idsUrl = valuesUrl(config.spreadsheetId, tabRange(config.sheetName, "A2:A"));
  const existingRows = await getValues(idsUrl, token);
  const rowByPaymentId = new Map<string, number>();
  existingRows.forEach((values, index) => {
    const id = values?.[0];
    if (typeof id === "string" && id && !rowByPaymentId.has(id)) rowByPaymentId.set(id, index + 2);
  });

  const updates: { range: string; values: unknown[][] }[] = [];
  const appends: unknown[][] = [];
  for (const row of rows) {
    const values = rowValues(row);
    const index = rowByPaymentId.get(row.payment_submission_id);
    if (index) updates.push({ range: tabRange(config.sheetName, "A" + index + ":X" + index), values: [values] });
    else appends.push(values);
  }
  if (updates.length) await batchUpdateValues(config.spreadsheetId, token, updates);
  if (appends.length) {
    await writeValues(valuesUrl(config.spreadsheetId, tabRange(config.sheetName, "A:X")), token, appends, true);
  }
}

export async function readPaymentSheetPaymentIds() {
  const config = configuration();
  const token = await getAccessToken(config);
  const headerRows = await getValues(valuesUrl(config.spreadsheetId, tabRange(config.sheetName, "A1:X1")), token);
  const headers = headerRows[0]?.map((value) => String(value ?? "")) ?? [];
  if (headers.length !== PAYMENT_SHEET_HEADERS.length
    || PAYMENT_SHEET_HEADERS.some((header, index) => headers[index] !== header)) {
    throw new SheetSyncError("sheet_header_mismatch");
  }
  const rows = await getValues(valuesUrl(config.spreadsheetId, tabRange(config.sheetName, "A2:A")), token);
  return rows.flatMap((row) => typeof row?.[0] === "string" && row[0] ? [row[0]] : []);
}

export function getPaymentSheetReadiness() {
  const enabled = process.env.GOOGLE_SHEETS_SYNC_ENABLED === "true";
  const hasSpreadsheetId = Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim());
  const hasClientEmail = Boolean(process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.trim());
  const hasPrivateKey = Boolean(process.env.GOOGLE_SHEETS_PRIVATE_KEY?.trim());
  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
  const hasCronSecret = Boolean(process.env.CRON_SECRET?.trim());
  return {
    enabled, hasSpreadsheetId, hasClientEmail, hasPrivateKey, hasServiceRoleKey, hasCronSecret,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME?.trim() || "Payments",
    configured: enabled && hasSpreadsheetId && hasClientEmail && hasPrivateKey && hasServiceRoleKey,
  };
}

export function paymentSheetErrorCode(error: unknown): SheetSyncErrorCode {
  return error instanceof SheetSyncError ? error.code : "sync_failed";
}

