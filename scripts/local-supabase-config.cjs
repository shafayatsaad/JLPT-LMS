#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const path = require("node:path");

function parseStatusEnv(output) {
  const values = new Map();
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (match) values.set(match[1], match[2].replace(/"$/, ""));
  }
  return values;
}

function isLoopbackUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function getLocalSupabaseConfig({ cwd = process.cwd(), run = execFileSync } = {}) {
  const cli = path.join(cwd, "node_modules", "supabase", "dist", "supabase.js");
  let output;
  try {
    output = run(process.execPath, [cli, "status", "--output", "env"], {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    throw new Error("Could not read local Supabase status. Start the Docker demo with `npm run demo:local:resume` first.");
  }

  const values = parseStatusEnv(output);
  const url = values.get("API_URL");
  const key = values.get("PUBLISHABLE_KEY") || values.get("ANON_KEY");
  if (!url || !key || !isLoopbackUrl(url)) {
    throw new Error("Supabase CLI did not return a valid loopback API URL and publishable key.");
  }

  return { url, key };
}

module.exports = { getLocalSupabaseConfig, isLoopbackUrl, parseStatusEnv };
