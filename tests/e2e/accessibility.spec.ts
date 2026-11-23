import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = [
  { path: "/", name: "home page" },
  { path: "/levels/n5", name: "N5 guide" },
  { path: "/exams/n5/preview", name: "N5 interface preview" },
  { path: "/legal/privacy", name: "privacy draft" },
  { path: "/auth/login", name: "sign-in page" },
];
const viewports = [
  { name: "desktop", size: { width: 1280, height: 720 } },
  { name: "mobile", size: { width: 390, height: 844 } },
];

for (const route of routes) {
  for (const viewport of viewports) test(`${route.name} at ${viewport.name} has no automated WCAG A/AA violations`, async ({ page }) => {
    await page.setViewportSize(viewport.size);
    await page.goto(route.path);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      affectedElements: violation.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    }))).toEqual([]);
  });
}

for (const viewport of viewports) test(`home page in Bangla at ${viewport.name} has no automated WCAG A/AA violations`, async ({ page }) => {
  await page.setViewportSize(viewport.size);
  await page.goto("/");
  await page.locator(".language-switch select").selectOption("bn");
  await expect(page.getByRole("heading", { level: 1, name: "N1–N5-এর JLPT মক পরীক্ষা" })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    affectedElements: violation.nodes.map((node) => ({
      target: node.target,
      summary: node.failureSummary,
    })),
  }))).toEqual([]);
});
