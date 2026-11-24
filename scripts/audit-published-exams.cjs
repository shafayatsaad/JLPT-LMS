#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const levels = ["N1", "N2", "N3", "N4", "N5"];
const launchTargetPerLevel = 3;

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
  const localEnv = readLocalEnv();
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || localEnv.get("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || localEnv.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || localEnv.get("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!projectUrl || !publishableKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local or the process environment.");
    process.exitCode = 2;
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(projectUrl);
    const localHttp = parsedUrl.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname);
    if (parsedUrl.protocol !== "https:" && !localHttp) throw new Error("HTTPS is required outside localhost");
  } catch {
    console.error("NEXT_PUBLIC_SUPABASE_URL must be HTTPS, except for HTTP on localhost.");
    process.exitCode = 2;
    return;
  }

  console.log("Published mock inventory (read-only; requests at most one public form ID per level)");
  console.log(`Launch target: ${launchTargetPerLevel} reviewed full mocks per level`);

  const results = await Promise.all(levels.map((level) => countPublicForms(parsedUrl, publishableKey, level)));
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
}

main().catch(() => {
  console.error("Published mock inventory could not be completed.");
  process.exitCode = 2;
});
