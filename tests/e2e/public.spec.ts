import { expect, test } from "@playwright/test";

test("home uses one full-frame Sakura video with a static poster fallback", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "JLPT mock exams for N1–N5" })).toBeVisible();
  const video = page.locator("#top .hero-tree-media video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveAttribute("poster", "/hero/origami-sakura-tree.webp");
  await expect(video.locator("source")).toHaveAttribute("src", "/hero/origami-sakura-tree.mp4");
  expect(await video.evaluate((element: HTMLVideoElement) => element.loop)).toBe(true);
  expect(await video.evaluate((element: HTMLVideoElement) => element.muted)).toBe(true);
  expect(await video.evaluate((element: HTMLVideoElement) => getComputedStyle(element).objectFit)).toBe("contain");
  await expect(page.locator("#top .hero-tree-media button")).toHaveCount(0);
  await expect(page.locator("#top .hero-tree-media img")).toHaveCount(0);

  await page.locator("#top").getByRole("link", { name: "Choose a JLPT level" }).click();
  await expect(page).toHaveURL(/#levels$/);
});

test("home content and JLPT timing table switch between English and Bangla", async ({ page }) => {
  await page.goto("/");
  const languageSelect = page.locator(".language-switch select");

  await languageSelect.selectOption("bn");
  await expect(page.getByRole("heading", { level: 1, name: "N1–N5-এর JLPT মক পরীক্ষা" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "JLPT স্তর অনুযায়ী পরীক্ষার সময়" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "স্কোর প্রতিবেদনের ধরন" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");

  await languageSelect.selectOption("en");
  await expect(page.getByRole("heading", { level: 1, name: "JLPT mock exams for N1–N5" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Score-report category" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("public information and level guides follow the saved Bangla preference", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("jlpt-ui-language", "bn"));

  const pages = [
    { path: "/about", title: "স্বতন্ত্র JLPT প্রস্তুতি" },
    { path: "/faq", title: "শুরু করার আগে জেনে নিন" },
    { path: "/how-it-works", title: "পরীক্ষা থেকে পর্যালোচনা পর্যন্ত স্পষ্ট পথ" },
    { path: "/contact", title: "আপনার অনুশীলন নিয়ে সহায়তা নিন" },
    { path: "/levels", title: "আপনার স্তর খুঁজে নিন" },
    { path: "/levels/n5", title: "N5 কাঠামো দিয়ে শুরু করুন" },
    { path: "/legal/privacy", title: "গোপনীয়তা বিজ্ঞপ্তির খসড়া" },
  ];

  for (const route of pages) {
    await page.goto(route.path);
    await expect(page.getByRole("heading", { level: 1, name: route.title })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "bn");
    if (route.path === "/levels/n5") {
      await expect(page.locator(".product-footer")).toContainText("প্ল্যাটফর্মের অনুশীলন স্কোর JLPT-এর আনুষ্ঠানিক স্কেলড স্কোর নয়।");
      await expect(page.getByRole("navigation", { name: "পাতার অবস্থান" })).toBeVisible();
    }
    if (route.path === "/legal/privacy") {
      await expect(page.getByText("প্রকাশের জন্য অনুমোদিত নয়")).toBeVisible();
    }
  }
});

test("mobile hero keeps the video inside the viewport without cropping", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const media = page.locator("#top .hero-tree-media");
  const video = media.locator("video");
  await expect(video).toBeVisible();
  const bounds = await media.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.width).toBeGreaterThan(300);
  expect(await video.evaluate((element: HTMLVideoElement) => getComputedStyle(element).objectFit)).toBe("contain");
});

test("reduced-motion visitors get the still Sakura fallback instead of autoplay", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const media = page.locator("#top .hero-tree-media");
  await expect(media).toHaveAttribute("data-video-state", "paused");
  await expect(media.locator("video")).toBeHidden();
  const backgroundImage = await media.evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(backgroundImage).toContain("origami-sakura-tree.webp");
  await expect(media.locator("button")).toHaveCount(0);
});

test("level directory links all five guides and the N5 preview", async ({ page }) => {
  await page.goto("/levels");

  for (const level of ["N1", "N2", "N3", "N4", "N5"]) {
    await expect(page.getByRole("link", { name: `Explore ${level} guide` })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /browser-only N5 interface preview/i })).toBeVisible();

  await page.getByRole("link", { name: "Explore N1 guide" }).click();
  await expect(page).toHaveURL(/\/levels\/n1$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("N5 preview remains a demo and the account form offers Google", async ({ page }) => {
  await page.goto("/exams/n5/preview");
  await expect(page.locator(".preview-disclosure")).toBeVisible();
  await expect(page.getByRole("link", { name: /instructions/i })).toBeVisible();

  await page.goto("/auth/login");
  await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  await expect(page.locator('input[autocomplete="one-time-code"]')).toHaveCount(0);
});
