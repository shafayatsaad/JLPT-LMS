import assert from "node:assert/strict";
import test from "node:test";
import { getVisibleAdminNavigationGroups } from "../../src/lib/admin-navigation.ts";

test("admin navigation uses the six requested areas without duplicate destinations", () => {
  const groups = getVisibleAdminNavigationGroups(["admin"]);
  const items = groups.flatMap((group) => group.items);

  assert.deepEqual(groups.map((group) => group.title), ["Dashboard", "Question Bank", "Exam Manager", "Students", "Payments", "Settings"]);
  assert.equal(groups.map((group) => group.landingHref).length, 6);
  assert.equal(items.length, 29);
  assert.equal(new Set(items.map((item) => item.href)).size, items.length);
  assert.deepEqual(groups.find((group) => group.id === "question-bank").tabs.map((tab) => tab.title), [
    "All questions", "Upload content", "Files & media", "Review",
  ]);
});

test("content editor navigation keeps the authoring and exam workflows", () => {
  const groups = getVisibleAdminNavigationGroups(["content_editor"]);
  const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));

  assert.deepEqual(hrefs, [
    "/admin",
    "/admin/questions",
    "/admin/questions/new",
    "/admin/assets",
    "/admin/sources",
    "/admin/content",
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
    "/admin/questions",
    "/admin/assets",
    "/admin/reviews",
    "/admin/sources",
    "/admin/content",
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
  assert.deepEqual(groups.map((group) => group.title), ["Dashboard", "Payments", "Settings"]);
  assert.deepEqual(groups.flatMap((group) => group.items.map((item) => item.href)), ["/admin", "/admin/payments", "/admin/reports"]);
  assert.deepEqual(groups.find((group) => group.id === "settings").tabs.map((tab) => tab.title), ["Reports"]);
});

test("support agent can open support without gaining other staff destinations", () => {
  const groups = getVisibleAdminNavigationGroups(["support_agent"]);
  assert.deepEqual(groups.flatMap((group) => group.items.map((item) => item.href)), ["/admin", "/admin/support"]);
  assert.equal(groups.find((group) => group.id === "students").landingHref, "/admin/support");
});

test("learner roles receive no staff navigation", () => {
  assert.deepEqual(getVisibleAdminNavigationGroups(["student"]), []);
});
