import assert from "node:assert/strict";
import test from "node:test";
import { canSkipMfaForSharedRemoteDemoAdmin, isLocalDemoEnvironment, isLocalQaExamFormCode } from "../../src/lib/local-demo.ts";

const previous = {
  enabled: process.env.LOCAL_DEMO_ACCOUNTS_ENABLED,
  remoteTunnel: process.env.LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
};

test.after(() => {
  if (previous.enabled === undefined) delete process.env.LOCAL_DEMO_ACCOUNTS_ENABLED;
  else process.env.LOCAL_DEMO_ACCOUNTS_ENABLED = previous.enabled;
  if (previous.remoteTunnel === undefined) delete process.env.LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED;
  else process.env.LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED = previous.remoteTunnel;
  if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
});

test("local demo UI remains labeled when testers use a private LAN IP", () => {
  process.env.LOCAL_DEMO_ACCOUNTS_ENABLED = "true";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://192.168.0.83:54321";
  assert.equal(isLocalDemoEnvironment(), true);
});

test("local demo UI rejects public Supabase URLs", () => {
  process.env.LOCAL_DEMO_ACCOUNTS_ENABLED = "true";
  process.env.LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED = "false";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  assert.equal(isLocalDemoEnvironment(), false);
});

test("explicit protected demo tunnel keeps demo-only behavior enabled", () => {
  process.env.LOCAL_DEMO_ACCOUNTS_ENABLED = "true";
  process.env.LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED = "true";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://warm-origami.trycloudflare.com/supabase";
  assert.equal(isLocalDemoEnvironment(), true);
});

test("demo tunnel switch cannot mark an unrelated public Supabase project local", () => {
  process.env.LOCAL_DEMO_ACCOUNTS_ENABLED = "true";
  process.env.LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED = "true";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  assert.equal(isLocalDemoEnvironment(), false);
});

test("only the shared test admin skips staff MFA in the explicit remote demo", () => {
  process.env.LOCAL_DEMO_ACCOUNTS_ENABLED = "true";
  process.env.LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED = "true";
  assert.equal(canSkipMfaForSharedRemoteDemoAdmin("public-admin@n5.test"), true);
  assert.equal(canSkipMfaForSharedRemoteDemoAdmin("admin@n5.test"), false);
  assert.equal(canSkipMfaForSharedRemoteDemoAdmin("student@n5.test"), false);
  process.env.LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED = "false";
  assert.equal(canSkipMfaForSharedRemoteDemoAdmin("public-admin@n5.test"), false);
});

test("local demo UI still requires its explicit enable switch", () => {
  process.env.LOCAL_DEMO_ACCOUNTS_ENABLED = "false";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://192.168.0.83:54321";
  assert.equal(isLocalDemoEnvironment(), false);
});

test("local E2E exam artifacts stay out of the learner exam library", () => {
  assert.equal(isLocalQaExamFormCode("N5-PHASE2-5D392252"), true);
  assert.equal(isLocalQaExamFormCode("n4-phase3-bbec0ba2"), true);
  assert.equal(isLocalQaExamFormCode("DEMO-N5-001"), false);
  assert.equal(isLocalQaExamFormCode("N5-2026-01"), false);
});
