import assert from "node:assert/strict";
import test from "node:test";
import { proposedAccessRows, proposedPlans } from "../../src/lib/access-catalog.ts";

test("proposed premium plans are fixed-duration previews without invented prices", () => {
  assert.deepEqual(proposedPlans.map((plan) => plan.durationDays), [30, 90, 365]);
  assert.equal(new Set(proposedPlans.map((plan) => plan.code)).size, proposedPlans.length);
  assert.ok(proposedPlans.every((plan) => !Object.hasOwn(plan, "price") && !Object.hasOwn(plan, "priceBdt")));
});

test("proposed access matrix contains distinct feature rows and both tier labels", () => {
  assert.ok(proposedAccessRows.length >= 8);
  assert.equal(new Set(proposedAccessRows.map((row) => row.featureKey)).size, proposedAccessRows.length);
  assert.ok(proposedAccessRows.every((row) => row.freeKey && row.premiumKey));
});
