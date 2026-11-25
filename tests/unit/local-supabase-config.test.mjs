import assert from "node:assert/strict";
import test from "node:test";
import localConfig from "../../scripts/local-supabase-config.cjs";

const { isLoopbackUrl, parseStatusEnv } = localConfig;

test("parses local Supabase CLI env output while ignoring status chatter", () => {
  const values = parseStatusEnv([
    "Stopped services: [supabase_pooler_JLPT_LMS]",
    'API_URL="http://127.0.0.1:54321"',
    'PUBLISHABLE_KEY="local-publishable-key"',
    "A new version of Supabase CLI is available",
  ].join("\n"));

  assert.equal(values.get("API_URL"), "http://127.0.0.1:54321");
  assert.equal(values.get("PUBLISHABLE_KEY"), "local-publishable-key");
  assert.equal(values.has("SUPABASE_POOLER_JLPT_LMS"), false);
});

test("only permits HTTP loopback Supabase endpoints for local audits", () => {
  assert.equal(isLoopbackUrl("http://127.0.0.1:54321"), true);
  assert.equal(isLoopbackUrl("http://localhost:54321"), true);
  assert.equal(isLoopbackUrl("https://example.supabase.co"), false);
  assert.equal(isLoopbackUrl("http://192.168.1.10:54321"), false);
});
