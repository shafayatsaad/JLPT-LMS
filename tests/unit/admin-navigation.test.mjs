import assert from "node:assert/strict";
import test from "node:test";
import { getVisibleAdminNavigationGroups } from "../../src/lib/admin-navigation.ts";

test("admin navigation exposes six groups and every existing navigation destination", () => {
  const groups = getVisibleAdminNavigationGroups(["admin"]);

  assert.deepEqual(groups.map((group) => group.title), [
    "Overview",
    "Content",
    "Exams",
    "Review",
    "Users & Payments",
    "Reports & Settings",
  ]);
  assert.equal(groups.flatMap((group) => group.items).length, 28);
  assert.equal(new Set(groups.flatMap((group) => group.items.map((item) => item.href))).size, 28);
});

test("content editor navigation keeps the existing content and exam workflows", () => {
  const groups = getVisibleAdminNavigationGroups(["content_editor"]);
  const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));

  assert.deepEqual(hrefs, [
    "/admin",
    "/admin/content",
    "/admin/questions",
    "/admin/questions/new",
    "/admin/sources",
    "/admin/assets",
    "/admin/blueprints",
    "/admin/exam-forms",
    "/admin/exam-preview",
  ]);
});

test("reviewer navigation only includes destinations authorized to reviewers", () => {
  const groups = getVisibleAdminNavigationGroups(["reviewer"]);
  const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));

  assert.deepEqual(hrefs, [
    "/admin",
    "/admin/content",
    "/admin/questions",
    "/admin/sources",
    "/admin/assets",
    "/admin/blueprints",
    "/admin/exam-forms",
    "/admin/exam-preview",
    "/admin/reviews",
    "/admin/attempts",
  ]);
  assert.ok(!hrefs.includes("/admin/users"));
  assert.ok(!hrefs.includes("/admin/payments"));
  assert.ok(!hrefs.includes("/admin/settings"));
});

test("payment reviewer only sees dashboard, payment review, and reporting tools", () => {
  const groups = getVisibleAdminNavigationGroups(["payment_reviewer"]);
  const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));

  assert.deepEqual(hrefs, ["/admin", "/admin/payments", "/admin/reports"]);
});

test("support agent cannot see content, user management, or settings destinations", () => {
  const groups = getVisibleAdminNavigationGroups(["support_agent"]);
  const hrefs = groups.flatMap((group) => group.items.map((item) => item.href));

  assert.deepEqual(hrefs, ["/admin", "/admin/support"]);
});

test("learner roles receive no staff navigation", () => {
  assert.deepEqual(getVisibleAdminNavigationGroups(["student"]), []);
});
