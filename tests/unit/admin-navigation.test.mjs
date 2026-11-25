import assert from "node:assert/strict";
import test from "node:test";
import { getVisibleAdminNavigationGroups } from "../../src/lib/admin-navigation.ts";

test("admin navigation uses the six requested areas without duplicate destinations", () => {
  const groups = getVisibleAdminNavigationGroups(["admin"]);
  const items = groups.flatMap((group) => group.items);

  assert.deepEqual(groups.map((group) => group.title), ["Overview", "Content", "Exams", "Students", "Payments", "Reports & Settings"]);
  assert.equal(items.length, 26);
  assert.equal(new Set(items.map((item) => item.href)).size, items.length);
});

test("content editor navigation keeps the authoring and exam workflows", () => {
  const groups = getVisibleAdminNavigationGroups(["content_editor"]);
  const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));

  assert.deepEqual(hrefs, [
    "/admin",
    "/admin/content",
    "/admin/questions",
    "/admin/questions/new",
    "/admin/sources",
    "/admin/assets",
    "/admin/exam-forms",
    "/admin/blueprints",
    "/admin/exam-preview",
  ]);
});

test("reviewer navigation contains content review and exam attempts but no user, payment, or settings controls", () => {
  const groups = getVisibleAdminNavigationGroups(["reviewer"]);
  const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));

  assert.deepEqual(hrefs, [
    "/admin",
    "/admin/content",
    "/admin/questions",
    "/admin/sources",
    "/admin/assets",
    "/admin/reviews",
    "/admin/exam-forms",
    "/admin/blueprints",
    "/admin/exam-preview",
    "/admin/attempts",
  ]);
  assert.ok(!hrefs.includes("/admin/users"));
  assert.ok(!hrefs.includes("/admin/payments"));
  assert.ok(!hrefs.includes("/admin/settings"));
});

test("payment reviewer only sees their queues and reports", () => {
  const groups = getVisibleAdminNavigationGroups(["payment_reviewer"]);
  assert.deepEqual(groups.flatMap((group) => group.items.map((item) => item.href)), ["/admin", "/admin/payments", "/admin/reports"]);
});

test("support agent can open support without gaining other staff destinations", () => {
  const groups = getVisibleAdminNavigationGroups(["support_agent"]);
  assert.deepEqual(groups.flatMap((group) => group.items.map((item) => item.href)), ["/admin", "/admin/support"]);
});

test("learner roles receive no staff navigation", () => {
  assert.deepEqual(getVisibleAdminNavigationGroups(["student"]), []);
});
