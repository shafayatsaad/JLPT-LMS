import assert from "node:assert/strict";
import test from "node:test";
import { messages, translate } from "../../src/lib/i18n.ts";

test("English and Bangla expose the same message keys", () => {
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages.bn).sort());
  assert.ok(Object.values(messages.en).every((message) => typeof message === "string" && message.length > 0));
  assert.ok(Object.values(messages.bn).every((message) => typeof message === "string" && message.length > 0));
});

test("localized interpolation replaces template values", () => {
  assert.equal(translate("en", "dashboard.greeting", { name: "Learner" }), "Welcome, Learner");
  assert.equal(translate("bn", "dashboard.greeting", { name: "শিক্ষার্থী" }), "স্বাগতম, শিক্ষার্থী");
});
