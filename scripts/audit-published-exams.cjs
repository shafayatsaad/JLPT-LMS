#!/usr/bin/env node

const { getLocalSupabaseConfig } = require("./local-supabase-config.cjs");

const levels = ["N1", "N2", "N3", "N4", "N5"];
const launchTargetPerLevel = 3;

async function countPublicForms(baseUrl, publishableKey, level) {
  const url = new URL("/rest/v1/exam_forms", baseUrl);
  url.search = new URLSearchParams({
    select: "id",
    level: `eq.${level}`,
    status: "eq.published",
    limit: "1",
  }).toString();

  let response;
  try {
    response = await fetch(url, {
      headers: {
        apikey: publishableKey,
        Prefer: "count=exact",
        Range: "0-0",
        "Range-Unit": "items",
      },
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    return { level, state: "unknown", detail: error instanceof Error ? error.message : "network error" };
  }

  const contentRange = response.headers.get("content-range") ?? "";
  const countMatch = contentRange.match(/(?:\*|\d+-\d+)\/(\d+|\*)$/);
  if ((response.status === 200 || response.status === 206) && countMatch && countMatch[1] !== "*") {
    await response.body?.cancel();
    return { level, state: "counted", count: Number(countMatch[1]) };
  }

  let code = "";
  try {
    const body = await response.json();
    if (typeof body?.code === "string") code = body.code;
  } catch {
    // The status and optional PostgREST code are enough for a safe summary.
  }
  if (code === "PGRST205") return { level, state: "table-missing" };
  if (code === "42501") return { level, state: "restricted", status: response.status };
  return { level, state: "unknown", status: response.status, code: code || undefined };
}

async function main() {
  try {
    const { url, key } = getLocalSupabaseConfig();
    console.log("Published mock inventory (local Docker stack only; read-only; requests at most one public form ID per level)");
    console.log(`Launch target: ${launchTargetPerLevel} reviewed full mocks per level`);

    const results = await Promise.all(levels.map((level) => countPublicForms(new URL(url), key, level)));
    let belowTarget = false;
    let unknown = false;

    for (const result of results) {
      if (result.state === "counted") {
        const complete = result.count >= launchTargetPerLevel;
        belowTarget ||= !complete;
        console.log(`${result.level}: ${result.count} published form${result.count === 1 ? "" : "s"} ${complete ? "(count target met)" : `(target ${launchTargetPerLevel})`}`);
      } else {
        unknown = true;
        console.log(`${result.level}: ${result.state}${result.status ? ` (HTTP ${result.status})` : ""}${result.code ? ` (${result.code})` : ""}`);
      }
    }

    console.log("Counts do not validate item quotas, approved questions/assets, answer keys, audio quality, rights, or review decisions.");
    if (unknown) process.exitCode = 2;
    else if (belowTarget) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Published mock inventory could not be completed.");
    process.exitCode = 2;
  }
}

main().catch(() => {
  console.error("Published mock inventory could not be completed.");
  process.exitCode = 2;
});
