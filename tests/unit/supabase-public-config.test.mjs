import assert from "node:assert/strict";
import test from "node:test";
import { getSupabasePublicConfig } from "../../src/lib/supabase/config.ts";

const previous = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  lanEnabled: process.env.NEXT_PUBLIC_DEMO_LAN_ENABLED,
};

test.after(() => {
  if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
  if (previous.publishableKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previous.publishableKey;
  if (previous.lanEnabled === undefined) delete process.env.NEXT_PUBLIC_DEMO_LAN_ENABLED;
  else process.env.NEXT_PUBLIC_DEMO_LAN_ENABLED = previous.lanEnabled;
});

test("private HTTP Supabase URLs require the explicit LAN demo build switch", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://192.168.0.83:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test-key";
  process.env.NEXT_PUBLIC_DEMO_LAN_ENABLED = "false";
  assert.equal(getSupabasePublicConfig(), null);

  process.env.NEXT_PUBLIC_DEMO_LAN_ENABLED = "true";
  assert.deepEqual(getSupabasePublicConfig(), {
    url: "http://192.168.0.83:54321",
    publishableKey: "sb_publishable_test-key",
  });
});

test("LAN demo switch does not permit public HTTP Supabase URLs", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://203.0.113.12:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test-key";
  process.env.NEXT_PUBLIC_DEMO_LAN_ENABLED = "true";
  assert.equal(getSupabasePublicConfig(), null);
});

test("HTTPS Supabase configuration remains available without LAN demo mode", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test-key";
  process.env.NEXT_PUBLIC_DEMO_LAN_ENABLED = "false";
  assert.deepEqual(getSupabasePublicConfig(), {
    url: "https://project.supabase.co",
    publishableKey: "sb_publishable_test-key",
  });
});

test("same-origin tunneled Supabase API keeps its path prefix", () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://warm-origami.trycloudflare.com/supabase";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test-key";
  process.env.NEXT_PUBLIC_DEMO_LAN_ENABLED = "false";
  assert.deepEqual(getSupabasePublicConfig(), {
    url: "https://warm-origami.trycloudflare.com/supabase",
    publishableKey: "sb_publishable_test-key",
  });
});
