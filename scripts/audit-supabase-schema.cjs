#!/usr/bin/env node

const { getLocalSupabaseConfig } = require("./local-supabase-config.cjs");

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
  "attempt_media_playbacks",
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
  "demo_source_packets",
];

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
  try {
    const { url, key } = getLocalSupabaseConfig();
    console.log("Supabase expected-table audit (local Docker stack only; read-only; fetches no rows)");
    const results = [];
    for (const table of expectedTables) {
      results.push(await inspectTable(new URL(url), key, table));
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
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Supabase audit failed.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Supabase audit failed.");
  process.exitCode = 1;
});
