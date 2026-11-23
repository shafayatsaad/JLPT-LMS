#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const expectedTables = [
  "profiles",
  "user_roles",
  "question_families",
  "questions",
  "question_answer_keys",
  "tags",
  "question_tags",
  "passage_groups",
  "content_group_items",
  "content_assets",
  "question_assets",
  "question_reviews",
  "exam_blueprints",
  "blueprint_slots",
  "exam_forms",
  "exam_form_items",
  "exam_attempts",
  "attempt_sections",
  "attempt_answers",
  "exam_results",
  "user_question_stats",
  "practice_sessions",
  "practice_session_items",
  "user_question_reviews",
  "plans",
  "manual_payment_settings",
  "payment_submissions",
  "user_entitlements",
  "payment_audit_events",
  "admin_audit_events",
  "announcements",
  "admin_exports",
  "notifications",
  "support_tickets",
  "support_messages",
  "support_audit_events",
  "user_notification_preferences",
  "user_bookmarks",
  "content_asset_reviews",
  "account_deletion_requests",
  "support_attachments",
];

function parseEnvFile(contents) {
  const values = new Map();
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim().replace(/^export\s+/, "");
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values.set(name, value);
  }
  return values;
}

function readLocalEnv() {
  const filename = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(filename)) return new Map();
  return parseEnvFile(fs.readFileSync(filename, "utf8"));
}

async function inspectTable(baseUrl, publishableKey, table) {
  const url = new URL(`/rest/v1/${table}?select=*&limit=0`, baseUrl);
  let response;
  try {
    response = await fetch(url, {
      headers: { apikey: publishableKey },
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    return { table, state: "unknown", detail: error instanceof Error ? error.message : "network error" };
  }

  if (response.status === 200) return { table, state: "present-readable", status: 200 };

  let code = "";
  try {
    const body = await response.json();
    if (typeof body?.code === "string") code = body.code;
  } catch {
    // An empty or non-JSON gateway response remains an unknown state.
  }

  if (code === "42501") return { table, state: "present-restricted", status: response.status };
  if (code === "PGRST205") return { table, state: "missing", status: response.status };
  return { table, state: "unknown", status: response.status, code: code || undefined };
}

async function main() {
  const localEnv = readLocalEnv();
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || localEnv.get("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || localEnv.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || localEnv.get("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!projectUrl || !publishableKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local or the process environment.");
    process.exitCode = 1;
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(projectUrl);
    if (parsedUrl.protocol !== "https:") throw new Error("HTTPS is required");
  } catch {
    console.error("NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL.");
    process.exitCode = 1;
    return;
  }

  console.log("Supabase expected-table audit (read-only; uses the publishable key, fetches no rows)");
  const results = [];
  for (const table of expectedTables) {
    results.push(await inspectTable(parsedUrl, publishableKey, table));
  }

  const present = results.filter((result) => result.state.startsWith("present-"));
  const missing = results.filter((result) => result.state === "missing");
  const unknown = results.filter((result) => result.state === "unknown");
  console.log(`Expected: ${expectedTables.length}; present: ${present.length}; missing: ${missing.length}; unknown: ${unknown.length}`);
  if (present.length) console.log(`Present (readable or restricted): ${present.map((result) => result.table).join(", ")}`);
  if (missing.length) console.log(`Missing from the exposed public schema: ${missing.map((result) => result.table).join(", ")}`);
  if (unknown.length) {
    console.log(`Undetermined: ${unknown.map((result) => `${result.table} (${result.status ?? result.detail}${result.code ? `, ${result.code}` : ""})`).join(", ")}`);
  }
  console.log("This checks table-name visibility only. It does not verify columns, migration history, functions, RLS correctness, or storage policies.");
  if (unknown.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Supabase audit failed.");
  process.exitCode = 1;
});
