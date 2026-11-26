import { expect, test } from "@playwright/test";
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";

function localTotpFromSecret(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = secret.replace(/=+$/, "").toUpperCase();
  let bits = "";
  for (const character of normalized) {
    const value = alphabet.indexOf(character);
    if (value < 0) throw new Error("The local demo TOTP secret is not valid base32.");
    bits += value.toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/g)?.map((byte) => parseInt(byte, 2)) ?? []);
  const counter = Math.floor(Date.now() / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return value.toString().padStart(6, "0");
}

function currentLocalTotp(email = "admin@n5.test") {
  if (!new Set(["admin@n5.test", "reviewer@n5.test"]).has(email)) throw new Error("Only seeded staff profiles can be used for the local TOTP test.");
  const sql = `select secret from auth.mfa_factors where user_id = (select id from auth.users where email = '${email}') and factor_type = 'totp' and status = 'verified' order by created_at desc limit 1`;
  const secret = execFileSync("docker", ["exec", "supabase_db_JLPT_LMS", "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql], { encoding: "utf8" }).trim();
  if (!secret) throw new Error(`The local demo profile ${email} needs a verified TOTP factor.`);
  return localTotpFromSecret(secret);
}

function localQuestionStatus(contentKey: string) {
  const sql = `select status::text from public.questions where content_key = '${contentKey}' order by revision desc limit 1`;
  return execFileSync("docker", ["exec", "supabase_db_JLPT_LMS", "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql], { encoding: "utf8" }).trim();
}

function localQuestionId(contentKey: string) {
  if (!/^[0-9a-f-]{36}$/i.test(contentKey)) throw new Error("Invalid local content key.");
  const sql = `select id from public.questions where content_key = '${contentKey}' order by revision desc limit 1`;
  return execFileSync("docker", ["exec", "supabase_db_JLPT_LMS", "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql], { encoding: "utf8" }).trim();
}

function localAssetStatuses(contentKey: string) {
  const sql = `select string_agg(a.status::text, ',' order by a.id) from public.questions q join public.question_assets qa on qa.question_id = q.id join public.content_assets a on a.id = qa.asset_id where q.content_key = '${contentKey}'`;
  return execFileSync("docker", ["exec", "supabase_db_JLPT_LMS", "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql], { encoding: "utf8" }).trim();
}

function localExamFormStatus(formId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(formId)) throw new Error("Invalid local exam form ID.");
  const sql = `select status::text || '|' || is_frozen::text from public.exam_forms where id = '${formId}'`;
  return execFileSync("docker", ["exec", "supabase_db_JLPT_LMS", "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql], { encoding: "utf8" }).trim();
}

function localInProgressDemoAttemptId() {
  const sql = "select a.id from public.exam_attempts a join auth.users u on u.id = a.user_id where u.email = 'free-student@n5.test' and a.status = 'in_progress' order by a.created_at desc limit 1";
  return execFileSync("docker", ["exec", "supabase_db_JLPT_LMS", "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql], { encoding: "utf8" }).trim();
}

function localPaymentRequestByTransaction(transactionId: string) {
  if (!/^DEMO-\d+$/.test(transactionId)) throw new Error("Invalid local demo transaction ID.");
  const sql = `select id::text || '|' || status::text from public.payment_submissions where transaction_reference = '${transactionId}' order by created_at desc limit 1`;
  return execFileSync("docker", ["exec", "supabase_db_JLPT_LMS", "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql], { encoding: "utf8" }).trim();
}

function localPaymentStatus(paymentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) throw new Error("Invalid local payment ID.");
  const sql = `select status::text from public.payment_submissions where id = '${paymentId}'`;
  return execFileSync("docker", ["exec", "supabase_db_JLPT_LMS", "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql], { encoding: "utf8" }).trim();
}

function localPaymentEntitlementStatus(paymentId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) throw new Error("Invalid local payment ID.");
  const sql = `select status::text from public.user_entitlements where source_payment_submission_id = '${paymentId}' order by created_at desc limit 1`;
  return execFileSync("docker", ["exec", "supabase_db_JLPT_LMS", "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql], { encoding: "utf8" }).trim();
}

function expireLocalExamPreparation(attemptId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) throw new Error("Invalid local exam attempt ID.");
  const sql = `with changed as (update public.exam_attempts set preparation_deadline_at = now() - interval '1 second' where id = '${attemptId}' and preparation_required and preparation_started_at is not null returning id) select id from changed`;
  return execFileSync("docker", ["exec", "supabase_db_JLPT_LMS", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-tAc", sql], { encoding: "utf8" }).trim();
}

function publishedExamFormRejectsMutation(formId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(formId)) throw new Error("Invalid local exam form ID.");
  const sql = `begin; update public.exam_forms set form_code = form_code || '-MUTATION-TEST' where id = '${formId}'; rollback;`;
  try {
    execFileSync("docker", ["exec", "supabase_db_JLPT_LMS", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-c", sql], { encoding: "utf8" });
    return false;
  } catch (error) {
    const result = error as { stdout?: Buffer | string; stderr?: Buffer | string };
    return `${result.stdout?.toString() ?? ""}\n${result.stderr?.toString() ?? ""}`.includes("Published or frozen exam forms are immutable");
  }
}

function demoWaveFile() {
  const samples = 800;
  const sampleRate = 8_000;
  const buffer = Buffer.alloc(44 + samples);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + samples, 4); buffer.write("WAVE", 8);
  buffer.write("fmt ", 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate, 28);
  buffer.writeUInt16LE(1, 32); buffer.writeUInt16LE(8, 34); buffer.write("data", 36); buffer.writeUInt32LE(samples, 40);
  buffer.fill(128, 44);
  return buffer;
}

function nextLocalExamFormVersion() {
  const sql = "select coalesce(max(version), 0) + 1 from public.exam_forms where blueprint_id = '43000000-0000-4000-8000-000000000001'";
  return execFileSync("docker", ["exec", "supabase_db_JLPT_LMS", "psql", "-U", "postgres", "-d", "postgres", "-tAc", sql], { encoding: "utf8" }).trim();
}

async function prepareFullPageScreenshot(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const height = document.documentElement.scrollHeight;
    const step = Math.max(360, Math.round(window.innerHeight * 0.78));
    for (let top = 0; top < height; top += step) {
      window.scrollTo(0, top);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1000);
}

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

test("home links directly to the free N5 section and preserves a full-mock path to plans", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /try the free n5 section/i })).toHaveAttribute("href", "/exams/n5/preview/session");
  await expect(page.getByRole("link", { name: /unlock full mock exams/i })).toHaveAttribute("href", "/pricing?next=%2Fexams");
});

test("signed-out premium checkout returns to the requested exam after sign-in", async ({ page }) => {
  test.skip(process.env.LOCAL_DEMO_ACCOUNTS_ENABLED !== "true", "Requires the local payment sandbox.");
  await page.goto("/pricing?next=%2Fexams");
  await page.getByRole("link", { name: "Test this plan" }).first().click();
  await expect(page).toHaveURL(/\/auth\/login\?/);
  const signInUrl = new URL(page.url());
  const checkoutUrl = new URL(signInUrl.searchParams.get("next") ?? "", "http://local.invalid");
  expect(checkoutUrl.pathname).toBe("/upgrade/bkash");
  expect(checkoutUrl.searchParams.get("next")).toBe("/exams");
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

test("Google and email account creation do not require a phone number", async ({ page }) => {
  await page.goto("/auth/register");
  const phoneInput = page.locator('input[type="tel"][autocomplete="tel"]');
  if (await phoneInput.count()) await expect(phoneInput).not.toHaveAttribute("required", "");
  await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  await expect(page.getByText(/email and Google do not require a phone number/i)).toBeVisible();
  await expect(page.getByText(/required for every account, including Google/i)).toHaveCount(0);
});

test("local learner can sign in, reach the dashboard, and sign out", async ({ page }) => {
  test.skip(process.env.LOCAL_DEMO_ACCOUNTS_ENABLED !== "true", "Requires the seeded local Supabase learner.");
  await page.goto("/auth/login");
  await page.locator('input[autocomplete="username"]').fill("student@n5.test");
  await page.locator('input[type="password"]').fill("N5learn26");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".local-demo-banner")).toContainText("Payments are simulated; no money is sent.");
  await expect(page.getByRole("heading", { level: 1, name: "Welcome, Demo Student" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Continue", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start a mock exam" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Practice" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent results" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review mistakes", exact: true })).toBeVisible();
  await prepareFullPageScreenshot(page);
  await page.screenshot({ path: "test-results/phase2-student-dashboard-desktop.png", fullPage: true });
  const learnerNav = page.getByRole("navigation", { name: "Account navigation" });
  for (const label of ["Dashboard", "Mock exams", "Practice", "Results", "Profile"]) await expect(learnerNav.getByRole("link", { name: label })).toBeVisible();
  await expect(learnerNav.getByRole("link", { name: "Leaderboard" })).toBeVisible();
  await learnerNav.getByRole("link", { name: "Leaderboard" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Leaderboard" })).toBeVisible();
  await expect(page.locator(".leaderboard-notes")).toBeVisible();
  await expect(page.getByLabel("JLPT level")).toHaveValue("N5");
  await page.goto("/dashboard");
  await learnerNav.getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Your profile" })).toBeVisible();
  await prepareFullPageScreenshot(page);
  await page.screenshot({ path: "test-results/phase2-student-account-desktop.png", fullPage: true });
  await expect(page.getByRole("link", { name: /Plans & Payments/ })).toBeVisible();
  await expect(page.getByText("Subscription and payment status")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await prepareFullPageScreenshot(page);
  await page.screenshot({ path: "test-results/phase2-student-account-mobile.png", fullPage: true });
  await page.goto("/dashboard");
  await page.evaluate(() => window.scrollTo(0, 0));
  const demoBanner = page.locator(".local-demo-banner");
  const [headerBounds, bannerBounds] = await Promise.all([page.locator("header.nav").boundingBox(), demoBanner.boundingBox()]);
  expect(headerBounds).not.toBeNull();
  expect(bannerBounds).not.toBeNull();
  if (headerBounds && bannerBounds) expect(bannerBounds.y).toBeGreaterThanOrEqual(headerBounds.y + headerBounds.height);
  await expect(demoBanner).toContainText("Test accounts and sample data only. Payments are simulated; no money is sent.");
  const mobileSectionHeights = await page.locator(".product-page > .product-section").evaluateAll((sections) => sections.map((section) => section.getBoundingClientRect().height));
  expect(Math.max(...mobileSectionHeights)).toBeLessThan(844);
  await prepareFullPageScreenshot(page);
  await page.screenshot({ path: "test-results/phase2-student-dashboard-mobile.png", fullPage: true });
  await page.getByRole("link", { name: /Browse mock exams/ }).first().click();
  await expect(page.getByRole("heading", { name: "Exam library" })).toBeVisible();
  await prepareFullPageScreenshot(page);
  await page.screenshot({ path: "test-results/phase2-exam-library-mobile.png", fullPage: true });
  await page.goto("/payments");
  await expect(page).toHaveURL(/\/subscription$/);
  await expect(page.getByRole("heading", { name: "Plans & Payments" })).toBeVisible();
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "This page needs a different staff role" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Administration sections" })).toHaveCount(0);
  await page.goto("/subscription");
  await expect(page.locator("html")).toHaveAttribute("data-ready", "1");
  const mobileMenu = page.getByRole("button", { name: "Open navigation menu" });
  await mobileMenu.click();
  const closeMenu = page.getByRole("button", { name: "Close navigation menu" });
  await expect(closeMenu).toHaveAttribute("aria-expanded", "true");
  const dashboardSignOut = page.getByRole("button", { name: /sign out/i });
  await expect(dashboardSignOut).toBeVisible();
  await dashboardSignOut.click();
  await expect(page).toHaveURL("/");
});

test("learner exam library and practice load from Docker and keep the compact footer at the viewport edge", async ({ page }) => {
  test.skip(process.env.LOCAL_DEMO_ACCOUNTS_ENABLED !== "true", "Requires the seeded local Supabase learner.");
  await page.goto("/auth/login");
  await page.locator('input[autocomplete="username"]').fill("student@n5.test");
  await page.locator('input[type="password"]').fill("N5learn26");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".local-demo-banner")).toContainText("Payments are simulated; no money is sent.");

  for (const [path, heading] of [["/exams", "Exam library"], ["/practice", "Practice a skill"]]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByText(/could not load|migration 015|unavailable/i)).toHaveCount(0);
    if (path === "/exams") {
      await expect(page.locator(".exam-library-grid")).toContainText("DEMO-N5-001");
      await expect(page.locator(".exam-library-grid")).not.toContainText(/N[1-5]-PHASE\d+-/i);
    }
    const layout = await page.locator("footer.footer--compact").evaluate((footer) => ({
      bottom: footer.getBoundingClientRect().bottom,
      pageHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    if (layout.pageHeight <= layout.viewportHeight + 1) {
      expect(layout.bottom).toBeGreaterThanOrEqual(layout.viewportHeight - 1);
    }
    await page.screenshot({ path: `test-results/local-demo-${path.slice(1)}-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    const mobileWidth = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(mobileWidth.document).toBeLessThanOrEqual(mobileWidth.viewport);
    await page.screenshot({ path: `test-results/local-demo-${path.slice(1)}-mobile.png`, fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
  }
});

test("local simulated payment is submitted, approved by staff, and activates its entitlement", async ({ page }) => {
  test.skip(process.env.LOCAL_DEMO_ACCOUNTS_ENABLED !== "true", "Requires the seeded local learner and administrator.");
  await page.goto("/auth/login");
  await page.locator('input[autocomplete="username"]').fill("student@n5.test");
  await page.locator('input[type="password"]').fill("N5learn26");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/upgrade/bkash");
  await expect(page.getByRole("button", { name: "Fill sample details" })).toBeVisible();
  await page.getByRole("button", { name: "Fill sample details" }).click();
  const transactionId = await page.getByLabel("Transaction ID (TrxID)").inputValue();
  expect(transactionId).toMatch(/^DEMO-\d+$/);
  await page.getByRole("button", { name: "Submit payment details" }).click();
  await expect(page.getByRole("heading", { name: "Payment request submitted" })).toBeVisible();
  const [paymentId, paymentStatus] = localPaymentRequestByTransaction(transactionId).split("|");
  expect(paymentId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(paymentStatus).toBe("pending");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/admin/sign-in");
  await page.locator('input[autocomplete="username"]').fill("admin@n5.test");
  await page.locator('input[type="password"]').fill("admin123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\/mfa\?next=/, { timeout: 15_000 });
  await page.locator('input[autocomplete="one-time-code"]').fill(currentLocalTotp());
  await page.getByRole("button", { name: "Verify and continue", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await page.goto(`/admin/payments/${paymentId}`);
  await expect(page.getByRole("heading", { name: "Demo Student" })).toBeVisible();
  await expect(page.locator(".payment-detail")).toContainText(transactionId);
  await page.getByLabel("Internal verification note").fill("Local QA verified this synthetic test transaction; no funds were sent.");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Approve payment" }).click();
  await expect(page.getByRole("status")).toContainText("Payment request updated: approve.");
  expect(localPaymentStatus(paymentId)).toBe("verified");
  expect(localPaymentEntitlementStatus(paymentId)).toBe("active");
});

test("local admin sign-in reaches the mandatory authenticator challenge", async ({ page }) => {
  test.skip(process.env.LOCAL_DEMO_ACCOUNTS_ENABLED !== "true", "Requires the seeded local Supabase administrator.");
  await page.goto("/admin/sign-in");
  await page.locator('input[autocomplete="username"]').fill("admin@n5.test");
  await page.locator('input[type="password"]').fill("admin123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\/mfa\?next=/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Verify staff access" })).toBeVisible();
});

test("shared remote demo administrator opens the staff workspace with the simple test login", async ({ page }) => {
  test.skip(process.env.LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED !== "true", "Requires the explicit remote demo sandbox.");
  await page.goto("/dev/test-accounts");
  await expect(page.getByText("public-admin@n5.test", { exact: true })).toBeVisible();
  await page.goto("/admin/sign-in");
  await page.locator('input[autocomplete="username"]').fill("public-admin@n5.test");
  await page.locator('input[type="password"]').fill("admin123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Operational overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Verify staff access" })).toHaveCount(0);
  await expect(page.getByText(/data service rejected|staff access is required/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Items requiring attention" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
  await page.screenshot({ path: "test-results/remote-admin-summary-desktop.png", fullPage: true });
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("local administrator opens staff workspace and learner view remains separate", async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(process.env.LOCAL_DEMO_ACCOUNTS_ENABLED !== "true", "Requires the seeded local Supabase administrator and Docker.");
  await page.goto("/admin/sign-in");
  await page.locator('input[autocomplete="username"]').fill("admin@n5.test");
  await page.locator('input[type="password"]').fill("admin123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin\/mfa\?next=/, { timeout: 15_000 });
  await expect(page.locator('input[autocomplete="one-time-code"]')).toBeVisible();
  await page.locator('input[autocomplete="one-time-code"]').fill(currentLocalTotp());
  await page.getByRole("button", { name: "Verify and continue", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Operational overview" })).toBeVisible();
  const sections = page.getByRole("navigation", { name: "Staff areas" });
  await expect(sections.getByRole("link")).toHaveText(["Overview", "Content", "Exams", "Students", "Payments", "Reports & Settings"]);
  await expect(page.getByRole("navigation", { name: "Content tools" })).toHaveCount(0);
  await prepareFullPageScreenshot(page);
  await page.screenshot({ path: "test-results/phase2-admin-dashboard-desktop.png", fullPage: true });
  for (const [path, fileName] of [
    ["/admin/content", "phase2-admin-content-desktop.png"],
    ["/admin/questions?status=eligible_for_exam", "phase2-admin-question-bank-desktop.png"],
    ["/admin/questions/new", "phase2-admin-question-import-desktop.png"],
    ["/admin/reviews", "phase2-admin-review-queue-desktop.png"],
    ["/admin/assets", "phase2-admin-media-review-desktop.png"],
    ["/admin/blueprints", "phase2-admin-blueprints-desktop.png"],
    ["/admin/exam-forms", "phase2-admin-exam-builder-desktop.png"],
    ["/admin/exam-preview", "phase2-admin-exam-preview-desktop.png"],
    ["/admin/users", "phase2-admin-users-desktop.png"],
    ["/admin/support", "phase2-admin-support-desktop.png"],
    ["/admin/payments", "phase2-admin-payments-desktop.png"],
    ["/admin/plans", "phase2-admin-plans-desktop.png"],
    ["/admin/entitlements", "phase2-admin-entitlements-desktop.png"],
    ["/admin/reports", "phase2-admin-reports-desktop.png"],
    ["/admin/attempts", "phase2-admin-attempts-desktop.png"],
    ["/admin/announcements", "phase2-admin-announcements-desktop.png"],
    ["/admin/privacy", "phase2-admin-privacy-desktop.png"],
    ["/admin/audit", "phase2-admin-audit-desktop.png"],
    ["/admin/settings/integrations", "phase2-admin-integrations-desktop.png"],
    ["/admin/settings", "phase2-admin-settings-desktop.png"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.getByText(/Supabase returned an error|Confirm migration \d+|Confirm the database migration/i)).toHaveCount(0);
    if (path === "/admin/exam-preview") {
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 2, name: "N5 practice booklet · sample" })).toBeVisible();
    }
    if (path === "/admin/exam-forms") {
      const blueprintSelect = page.getByLabel("Approved blueprint");
      await expect(blueprintSelect).toContainText("N5 · version 1");
      await blueprintSelect.selectOption({ label: "N5 · version 1" });
      await expect.poll(() => page.locator(".workflow-question input[type=checkbox]").count()).toBeGreaterThanOrEqual(6);
    }
    await prepareFullPageScreenshot(page);
    await page.screenshot({ path: `test-results/${fileName}`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/settings/security");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  const adminShortPageLayout = await page.locator("footer.footer--compact").evaluate((footer) => ({
    bottom: footer.getBoundingClientRect().bottom,
    pageHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  if (adminShortPageLayout.pageHeight <= adminShortPageLayout.viewportHeight + 1) {
    expect(adminShortPageLayout.bottom).toBeGreaterThanOrEqual(adminShortPageLayout.viewportHeight - 1);
  }
  await page.goto("/admin/exam-forms");
  const blueprintSelect = page.getByLabel("Approved blueprint");
  await expect(blueprintSelect).toContainText("N5 · version 1");
  await blueprintSelect.selectOption({ label: "N5 · version 1" });
  const eligibleQuestionInputs = page.locator(".workflow-question input[type=checkbox]");
  await expect.poll(() => eligibleQuestionInputs.count()).toBeGreaterThanOrEqual(6);
  const expectedFormVersion = nextLocalExamFormVersion();
  await expect(page.getByRole("spinbutton", { name: "Version" })).toHaveValue(expectedFormVersion);
  for (let index = 0; index < 6; index++) await eligibleQuestionInputs.nth(index).check();
  const testFormCode = `N5-PHASE2-${randomUUID().slice(0, 8)}`.toUpperCase();
  let audioFormCode = "";
  let audioFormId = "";
  await page.getByLabel("Form code").fill(testFormCode);
  const createFormButton = page.getByRole("button", { name: "Create draft form · 6 questions" });
  await expect(createFormButton).toBeEnabled();
  await createFormButton.click();
  await expect(page.getByRole("status")).toContainText(`Draft form ${testFormCode} created`);
  await page.reload();
  const createdForm = page.locator(".workflow-form-card").filter({ hasText: testFormCode });
  await expect(createdForm).toContainText("draft");
  await expect(createdForm.getByRole("button", { name: "Validate form" })).toBeDisabled();
  const formDetailsHref = await createdForm.getByRole("link", { name: "Inspect form manifest" }).getAttribute("href");
  const createdFormId = formDetailsHref?.split("/").at(-1) ?? "";
  expect(createdFormId).toMatch(/^[0-9a-f-]{36}$/i);
  await page.goto("/admin/questions");
  const firstQuestionRevision = page.getByRole("link", { name: /Revision \d+/ }).first();
  if (await firstQuestionRevision.count()) {
    await firstQuestionRevision.click();
    await expect(page.getByRole("heading", { level: 1, name: /Question revision/ })).toBeVisible();
    if (await page.locator(".question-draft-editor").count()) {
      await prepareFullPageScreenshot(page);
      await page.screenshot({ path: "test-results/phase2-admin-question-editor-desktop.png", fullPage: true });
    }
  }

  await page.goto("/admin/questions/new#manual-question");
  await page.getByLabel("Question prompt").fill("【PHASE 2 QA】「春」の読み方を選んでください。");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved");
  const questionId = (await page.locator(".question-authoring-form__id code").innerText()).trim();
  await page.goto(`/admin/questions/${questionId}`);
  await expect(page.locator(".question-draft-editor")).toBeVisible();
  await expect(page.getByLabel("Question type code")).toHaveValue("kanji_reading");
  const editableText = page.locator(".question-draft-editor .question-content-editor__block textarea").first();
  const choiceIds = page.locator(".question-choice-editor__heading input");
  await choiceIds.nth(1).fill("A");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.locator(".form-message--error")).toContainText("unique ID");
  await choiceIds.nth(1).fill("B");
  const savedPrompt = "【PHASE 2 QA】編集後の問題文を保存して確認します。";
  await editableText.fill(savedPrompt);
  await page.getByLabel("Skill tags").fill("vocabulary, phase2-demo");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft saved");
  await page.reload();
  const persistedText = page.locator(".question-draft-editor .question-content-editor__block textarea").first();
  await expect(persistedText).toHaveValue(savedPrompt);
  await expect(page.getByLabel("Skill tags")).toHaveValue("vocabulary, phase2-demo");
  await prepareFullPageScreenshot(page);
  await page.screenshot({ path: "test-results/phase2-admin-question-editor-desktop.png", fullPage: true });
  await persistedText.fill(`${savedPrompt} unsaved`);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Discard edits" }).click();
  await expect(page.locator(".question-draft-editor .question-content-editor__block textarea").first()).toHaveValue(savedPrompt);

  await page.goto("/admin/questions/new#import-questions");
  const packageInput = page.locator(".question-batch-import input[webkitdirectory]");
  const dataFileInput = page.locator(".question-batch-import input[type=file]:not([webkitdirectory])");
  await expect(packageInput).toHaveAttribute("webkitdirectory", "");
  const invalidImportDirectory = mkdtempSync(join(tmpdir(), "jlpt-phase2-invalid-import-"));
  writeFileSync(join(invalidImportDirectory, "manifest.json"), JSON.stringify({ questions: [{}] }));
  await packageInput.setInputFiles(invalidImportDirectory);
  await expect(page.locator(".form-message--error")).toContainText("Item 1 needs question.prompt, question.options and answer_key");
  rmSync(invalidImportDirectory, { recursive: true, force: true });
  const imageBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const importPrompt = `【PHASE 2 IMPORT ${randomUUID().slice(0, 6)}】画像と音声のあるデモ問題。`;
  const importContentKey = randomUUID();
  const packageJson = {
    source_type: "original",
    assets: [{ file: "tree.png", purpose: "question_image" }, { file: "prompt.wav", purpose: "question_audio" }],
    question: {
      content_key: importContentKey, revision: 1, level: "N5", test_section_code: "listening",
      score_category_code: "listening", item_type_code: "quick-response", tags: ["listening", "phase3-demo"],
      difficulty_estimate: 1, prompt: [{ type: "text", text: importPrompt }],
      options: ["はる", "なつ", "あき", "ふゆ"].map((text, index) => ({ id: String.fromCharCode(65 + index), content: [{ type: "text", text }] })),
    },
    answer_key: { correct_option_id: "A", explanation: { en: "春 is read はる." }, distractor_rationales: {} },
  };
  const question = packageJson.question;
  const csvHeaders = ["source_type", "source_reference", "rights_notes", "content_key", "revision", "level", "test_section_code", "score_category_code", "item_type_code", "difficulty_estimate", "prompt_json", "options_json", "tags_json", "correct_option_id", "explanation_json", "distractor_rationales_json", "assets_json"];
  const csvValues = ["original", "", "Original local QA content", question.content_key, "1", question.level, question.test_section_code, question.score_category_code, question.item_type_code, "1", JSON.stringify(question.prompt), JSON.stringify(question.options), JSON.stringify(question.tags), "A", JSON.stringify({ en: "Demo explanation." }), "{}", "[]"];
  const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = `${csvHeaders.join(",")}\r\n${csvValues.map(csvCell).join(",")}`;
  await dataFileInput.setInputFiles({ name: "questions.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(page.locator(".question-batch-import__preview")).toContainText("1 question drafts · 0 referenced media files");

  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Questions");
  worksheet.addRow(csvHeaders);
  worksheet.addRow(csvValues);
  const xlsx = await workbook.xlsx.writeBuffer();
  await dataFileInput.setInputFiles({ name: "questions.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(xlsx) });
  await expect(page.locator(".question-batch-import__preview")).toContainText("1 question drafts · 0 referenced media files");

  const archive = new JSZip();
  archive.file("bundle/manifest.json", JSON.stringify([packageJson]));
  archive.file("bundle/tree.png", imageBytes);
  archive.file("bundle/prompt.wav", demoWaveFile());
  const zip = await archive.generateAsync({ type: "nodebuffer" });
  await dataFileInput.setInputFiles({ name: "question-package.zip", mimeType: "application/zip", buffer: zip });
  await expect(page.locator(".question-batch-import__preview")).toContainText("1 question drafts · 2 referenced media files");

  const importDirectory = mkdtempSync(join(tmpdir(), "jlpt-phase2-import-"));
  writeFileSync(join(importDirectory, "manifest.json"), JSON.stringify([packageJson]));
  writeFileSync(join(importDirectory, "tree.png"), imageBytes);
  writeFileSync(join(importDirectory, "prompt.wav"), demoWaveFile());
  await packageInput.setInputFiles(importDirectory);
  await expect(page.getByText(/1 question drafts · 2 referenced media files/)).toBeVisible();
  await expect(page.locator(".question-batch-import__preview")).toContainText("quick_response");
  await prepareFullPageScreenshot(page);
  await page.screenshot({ path: "test-results/phase2-admin-import-preview-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Import 1 question with media" }).click();
  await expect(page.getByRole("status")).toContainText("1 question and 2 media assets uploaded and submitted");
  rmSync(importDirectory, { recursive: true, force: true });

  await page.goto("/admin/assets");
  const importedAssets = page.locator(".asset-review-queue__item").filter({ hasText: importPrompt });
  await expect(importedAssets).toHaveCount(2);
  await expect(importedAssets.locator(".asset-review-queue__preview img")).toBeVisible();
  await expect(importedAssets.locator(".asset-review-queue__preview audio")).toBeVisible();
  await prepareFullPageScreenshot(page);
  await page.screenshot({ path: "test-results/phase2-admin-media-review-with-samples-desktop.png", fullPage: true });
  await importedAssets.getByRole("button", { name: "Approve asset" }).first().click();
  await expect(page.locator(".form-message--error")).toContainText("Authors cannot review their own assets");

  await page.goto("/admin/reviews");
  const importedQuestion = page.locator(".review-queue__item").filter({ hasText: importPrompt });
  await expect(importedQuestion).toBeVisible();
  await importedQuestion.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(page.locator(".form-message--error")).toContainText("Authors cannot review their own questions");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/", { timeout: 10_000 });
  await page.goto("/admin/sign-in");
  await page.locator('input[autocomplete="username"]').fill("reviewer@n5.test");
  await page.locator('input[type="password"]').fill("N5review26");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(?:admin(?:\/mfa)?(?:\?.*)?|auth\/mfa\?next=.*)$/, { timeout: 15_000 });
  if (page.url().includes("/admin/mfa")) {
    await page.locator('input[autocomplete="one-time-code"]').fill(currentLocalTotp("reviewer@n5.test"));
    await page.getByRole("button", { name: "Verify and continue", exact: true }).click();
    await expect(page).toHaveURL(/\/admin(?:\?.*)?$/, { timeout: 15_000 });
  } else if (page.url().includes("/auth/mfa")) {
    await page.locator('input[autocomplete="one-time-code"]').fill(currentLocalTotp("reviewer@n5.test"));
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page).toHaveURL(/\/admin(?:\?.*)?$/, { timeout: 15_000 });
  }
  await page.goto("/admin/mfa?next=%2Fadmin%2Freviews");
  if (!page.url().includes("/admin/reviews")) {
    await expect(page.getByText("Checking authenticator setup…")).toHaveCount(0);
    const reviewerSetup = page.getByRole("button", { name: "Set up authenticator" });
    let reviewerCode: string;
    if (await reviewerSetup.count()) {
      await reviewerSetup.click();
      const secret = (await page.locator(".admin-mfa-challenge__secret").innerText()).trim();
      reviewerCode = localTotpFromSecret(secret);
    } else {
      reviewerCode = currentLocalTotp("reviewer@n5.test");
    }
    await page.locator("#admin-mfa-code").fill(reviewerCode);
    await page.getByRole("button", { name: "Verify and continue" }).click();
  }
  await expect(page).toHaveURL(/\/admin\/reviews$/, { timeout: 15_000 });

  const reviewerQuestion = page.locator(".review-queue__item").filter({ hasText: importPrompt });
  await expect(reviewerQuestion).toBeVisible();
  await reviewerQuestion.locator("textarea").fill("Independent QA confirmed the original prompt, answer key, and provenance.");
  await reviewerQuestion.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(reviewerQuestion).toHaveCount(0);
  expect(localQuestionStatus(importContentKey)).toBe("approved");

  await page.goto("/admin/assets");
  const reviewerAssets = page.locator(".asset-review-queue__item").filter({ hasText: importPrompt });
  await expect(reviewerAssets).toHaveCount(2);
  await reviewerAssets.first().locator("textarea").fill("Independent QA confirmed the private image/audio preview and attachment.");
  await reviewerAssets.first().getByRole("button", { name: "Approve asset" }).click();
  await expect(reviewerAssets).toHaveCount(1);
  await reviewerAssets.first().getByRole("button", { name: "Approve asset" }).click();
  await expect(reviewerAssets).toHaveCount(0);
  expect(localAssetStatuses(importContentKey)).toBe("approved,approved");

  const browser = page.context().browser();
  if (!browser) throw new Error("The local staff workflow needs a Chromium browser context.");
  const authorContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const authorPage = await authorContext.newPage();
    await authorPage.goto("/admin/sign-in");
    await authorPage.locator('input[autocomplete="username"]').fill("admin@n5.test");
    await authorPage.locator('input[type="password"]').fill("admin123");
    await authorPage.getByRole("button", { name: /sign in/i }).click();
    await expect(authorPage).toHaveURL(/\/admin\/mfa\?next=/, { timeout: 15_000 });
    await authorPage.locator('input[autocomplete="one-time-code"]').fill(currentLocalTotp());
    await authorPage.getByRole("button", { name: "Verify and continue", exact: true }).click();
    await expect(authorPage).toHaveURL(/\/admin$/, { timeout: 15_000 });
    await authorPage.goto("/admin/exam-forms");
    await authorPage.getByLabel("Approved blueprint").selectOption({ label: "N5 · version 1" });
    const requiredQuestionSlots = [
      "vocabulary · kanji_reading",
      "vocabulary · orthography",
      "grammar-reading · sentential_grammar_form",
      "grammar-reading · sentence_composition",
      "grammar-reading · text_grammar",
    ];
    for (const slotLabel of requiredQuestionSlots) {
      const slotQuestion = authorPage.locator(".workflow-question").filter({ hasText: slotLabel }).first();
      await expect(slotQuestion).toBeVisible();
      await slotQuestion.locator('input[type="checkbox"]').check();
    }
    await authorPage.getByLabel("Access tier").selectOption("free");
    const uploadedListeningQuestionId = localQuestionId(importContentKey);
    expect(uploadedListeningQuestionId).toMatch(/^[0-9a-f-]{36}$/i);
    const uploadedListeningQuestion = authorPage.locator(".workflow-question").filter({ hasText: uploadedListeningQuestionId.slice(0, 12) });
    await expect(uploadedListeningQuestion).toBeVisible();
    await uploadedListeningQuestion.locator('input[type="checkbox"]').check();
    audioFormCode = `N5-PHASE3-${randomUUID().slice(0, 8)}`.toUpperCase();
    await authorPage.getByLabel("Form code").fill(audioFormCode);
    await authorPage.getByRole("button", { name: "Create draft form · 6 questions" }).click();
    await expect(authorPage.getByRole("status")).toContainText(`Draft form ${audioFormCode} created`);
    await authorPage.reload();
    const audioForm = authorPage.locator(".workflow-form-card").filter({ hasText: audioFormCode });
    await expect(audioForm).toContainText("draft");
    const audioFormHref = await audioForm.getByRole("link", { name: "Inspect form manifest" }).getAttribute("href");
    audioFormId = audioFormHref?.split("/").at(-1) ?? "";
    expect(audioFormId).toMatch(/^[0-9a-f-]{36}$/i);
  } finally {
    await authorContext.close();
  }

  await page.goto("/admin/exam-forms");
  const reviewerForm = page.locator(".workflow-form-card").filter({ hasText: testFormCode });
  await expect(reviewerForm).toContainText("draft");
  await reviewerForm.locator("textarea").fill("Independent QA validated the approved blueprint, exact question quota, and frozen manifest.");
  await reviewerForm.getByRole("button", { name: "Validate form" }).click();
  await expect(reviewerForm).toContainText("validated");
  expect(localExamFormStatus(createdFormId)).toBe("validated|false");
  await reviewerForm.getByRole("button", { name: "Publish frozen form" }).click();
  await expect(reviewerForm).toContainText("published · frozen");
  await page.reload();
  await expect(page.locator(".workflow-form-card").filter({ hasText: testFormCode })).toContainText("published · frozen");
  expect(localExamFormStatus(createdFormId)).toBe("published|true");
  expect(publishedExamFormRejectsMutation(createdFormId)).toBe(true);
  await prepareFullPageScreenshot(page);
  await page.screenshot({ path: "test-results/phase2-admin-exam-builder-published-desktop.png", fullPage: true });
  const reviewerAudioForm = page.locator(".workflow-form-card").filter({ hasText: audioFormCode });
  await expect(reviewerAudioForm).toContainText("draft");
  await reviewerAudioForm.locator("textarea").fill("QA form with an independently reviewed audio asset attached to the listening item.");
  await reviewerAudioForm.getByRole("button", { name: "Validate form" }).click();
  await expect(reviewerAudioForm).toContainText("validated");
  await reviewerAudioForm.getByRole("button", { name: "Publish frozen form" }).click();
  await expect(reviewerAudioForm).toContainText("published · frozen");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/questions");
  await prepareFullPageScreenshot(page);
  await page.screenshot({ path: "test-results/phase2-admin-question-bank-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });
  await page.getByRole("link", { name: "Learner view" }).click();
  await expect(page).toHaveURL(/\/dashboard\?view=learner$/);
  await expect(page.getByRole("heading", { level: 1, name: "Welcome, Demo Reviewer" })).toBeVisible();

  await page.getByRole("button", { name: /sign out/i }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/auth/login");
  await page.locator('input[autocomplete="username"]').fill("free-student@n5.test");
  await page.locator('input[type="password"]').fill("N5free26");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const existingDemoAttemptId = localInProgressDemoAttemptId();
  if (existingDemoAttemptId) {
    await page.goto(`/attempts/${existingDemoAttemptId}`);
    const candidateCover = page.getByRole("heading", { level: 1, name: "Candidate information" });
    if (await candidateCover.count()) {
      await page.getByRole("button", { name: "Start five-minute preparation" }).click();
      await expect(page.getByRole("heading", { level: 1, name: "Preparation period" })).toBeVisible();
    }
    const preparation = page.getByRole("heading", { level: 1, name: "Preparation period" });
    if (await preparation.count()) {
      expect(expireLocalExamPreparation(existingDemoAttemptId)).toBe(existingDemoAttemptId);
      await page.reload();
    }
    await expect.poll(() => page.locator(".exam-paper__question").count()).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Submit the full attempt early" }).click();
    await page.getByRole("button", { name: "Confirm submission" }).click();
    await expect(page).toHaveURL(new RegExp(`/results/${existingDemoAttemptId}$`), { timeout: 15_000 });
  }
  await page.goto(`/exams/${createdFormId}`);
  await page.getByRole("button", { name: "Start mock exam" }).click();
  await expect(page.locator(".start-exam-action .form-message--error")).toContainText("active Premium entitlement");
  await expect(page.getByRole("link", { name: /Choose a plan and unlock this mock/ })).toHaveAttribute("href", `/pricing?next=${encodeURIComponent(`/exams/${createdFormId}`)}`);
  await page.goto(`/exams/${audioFormId}`);
  await expect(page.getByRole("heading", { level: 1, name: audioFormCode })).toBeVisible();
  await page.getByRole("button", { name: "Start mock exam" }).click();
  await expect(page).toHaveURL(/\/attempts\/[0-9a-f-]{36}$/i);
  const attemptId = page.url().split("/").at(-1) ?? "";
  await expect(page.getByRole("heading", { level: 1, name: "Candidate information" })).toBeVisible();
  await expect(page.locator(".exam-paper__question")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Answer sheet" })).toHaveCount(0);
  await expect(page.getByLabel("Candidate name")).toHaveValue("Demo Free Student");
  const pageCloseWasBlocked = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(pageCloseWasBlocked).toBe(true);
  await page.evaluate(() => window.history.back());
  await expect(page.getByRole("heading", { name: "Leave this attempt?" })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/attempts/${attemptId}$`));
  await page.getByRole("button", { name: "Stay in exam" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign out during this attempt?" })).toBeVisible();
  await page.getByRole("button", { name: "Stay in exam" }).click();
  await page.screenshot({ path: "test-results/phase3-exam-candidate-cover-desktop.png", fullPage: true });
  await page.getByRole("link", { name: "Exit to dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Leave this attempt?" })).toBeVisible();
  await page.getByRole("button", { name: "Stay in exam" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Candidate information" })).toBeVisible();
  await page.getByLabel("Candidate name").fill("QA Candidate");
  await page.getByLabel("Candidate number").fill("QA-001");
  await page.getByRole("button", { name: "Start five-minute preparation" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Preparation period" })).toBeVisible();
  await expect(page.locator(".exam-paper__question")).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Answer sheet" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Preparation period" })).toBeVisible();
  expect(expireLocalExamPreparation(attemptId)).toBe(attemptId);
  await page.reload();
  await expect.poll(() => page.locator(".exam-paper__question").count()).toBeGreaterThan(0);
  const activeQuestionCount = await page.locator(".exam-paper__question").count();
  expect(activeQuestionCount).toBeGreaterThan(0);
  await expect(page.getByRole("complementary", { name: "Answer sheet" })).toBeVisible();
  await expect(page.locator(".exam-answer-sheet__row")).toHaveCount(activeQuestionCount);
  await page.screenshot({ path: "test-results/phase3-exam-paper-desktop.png", fullPage: true });
  await page.route("**/rest/v1/rpc/save_exam_answer", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ code: "QA_OFFLINE", message: "Simulated temporary write failure" }) }));
  await page.locator(".exam-answer-option input[type=radio]").first().check();
  await expect(page.locator(".exam-save-state")).toContainText("Not saved");
  await page.reload();
  await expect(page.locator(".exam-answer-option input[type=radio]:checked")).toHaveCount(1);
  await expect(page.locator(".exam-save-state")).toContainText("Not saved");
  await page.unroute("**/rest/v1/rpc/save_exam_answer");
  await page.getByRole("button", { name: "Retry saving unsaved answers" }).click();
  await expect(page.locator(".exam-save-state")).toContainText("Saved");
  await page.reload();
  await expect(page.locator(".exam-answer-option input[type=radio]:checked")).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileDocumentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(mobileDocumentWidth).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/phase3-exam-paper-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Finish section" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Grammar.*Reading/ })).toBeVisible();
  await expect(page.locator(".exam-paper__question")).toHaveCount(3);
  await page.getByRole("button", { name: "Finish section" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Listening" })).toBeVisible();
  const listeningAudio = page.locator(".exam-audio-engine");
  await expect(listeningAudio).toHaveCount(1);
  await expect(listeningAudio).toHaveAttribute("preload", "auto");
  expect(await listeningAudio.evaluate((element) => (element as HTMLAudioElement).controls)).toBe(false);
  const playAudioButton = page.locator(".exam-audio-start");
  await expect(playAudioButton).toBeVisible();
  await playAudioButton.click();
  await expect.poll(() => playAudioButton.innerText()).toMatch(/Audio is playing|Audio completed/);
  await page.getByRole("button", { name: "Submit the full attempt early" }).click();
  await page.getByRole("button", { name: "Confirm submission" }).click();
  await expect(page).toHaveURL(new RegExp(`/results/${attemptId}$`), { timeout: 15_000 });
});

test("N5 sample separates the printed question booklet from its mapped bubble sheet", async ({ page }) => {
  await page.goto("/exams/n5/preview/session");

  await expect(page.getByRole("heading", { name: "N5 practice booklet · sample" })).toBeVisible();
  await expect(page.locator("#answers-panel")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Question 1, A" })).toHaveAttribute("aria-checked", "false");

  await page.getByRole("navigation", { name: "Booklet pages" }).getByRole("button", { name: /02 Language Knowledge \(Vocabulary\)/ }).click();
  await expect(page.getByRole("heading", { name: "「水」の読み方はどれですか。" })).toBeVisible();
  await expect(page.locator("#booklet-panel")).toContainText("みず");

  const firstBubble = page.getByRole("radio", { name: "Question 1, A" });
  await firstBubble.click();
  await expect(firstBubble).toHaveAttribute("aria-checked", "true");
  await firstBubble.click();
  await expect(firstBubble).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.getByRole("radio", { name: "Question 1, A" })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: "Erase answer for question 1" }).click();
  await expect(page.getByRole("radio", { name: "Question 1, A" })).toHaveAttribute("aria-checked", "false");
});

test("free N5 vocabulary booklet keeps all sample questions in one scrollable paper section", async ({ page }) => {
  await page.goto("/exams/n5/preview/session");
  await page.getByRole("navigation", { name: "Booklet pages" }).getByRole("button", { name: /02 Language Knowledge \(Vocabulary\)/ }).click();
  const paper = page.locator("#booklet-panel article");
  await expect(paper.locator("h2[id^='question-title-']")).toHaveCount(5);
  expect(await paper.evaluate((element) => getComputedStyle(element).overflow)).toBe("visible");
  await expect(paper.getByText("としょかんで ほんを（　）。")).toBeVisible();
});

test("mobile booklet switches to the answer sheet and honors reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/exams/n5/preview/session");

  await page.getByRole("button", { name: /Answer sheet/ }).click();
  const answerB = page.getByRole("radio", { name: "Question 1, B" });
  await answerB.click();
  await expect(answerB).toHaveAttribute("aria-checked", "true");
  expect(await answerB.locator("span").evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
  await page.reload();
  await page.getByRole("button", { name: /Answer sheet/ }).click();
  await expect(page.getByRole("radio", { name: "Question 1, B" })).toHaveAttribute("aria-checked", "true");
});

test("test profile details are exposed only in explicit local demo mode", async ({ page }) => {
  const response = await page.goto("/dev/test-accounts");
  if (process.env.LOCAL_DEMO_ACCOUNTS_ENABLED === "true") {
    await expect(page.getByRole("heading", { name: "Test learner and staff profiles" })).toBeVisible();
    await expect(page.getByText("student@n5.test", { exact: true })).toBeVisible();
    await expect(page.getByText("N5learn26")).toBeVisible();
    if (process.env.LOCAL_DEMO_PUBLIC_TUNNEL_ENABLED === "true") {
      await expect(page.getByText("public-admin@n5.test", { exact: true })).toBeVisible();
      await expect(page.getByText("admin@n5.test", { exact: true })).toHaveCount(0);
    } else {
      await expect(page.getByText("admin@n5.test", { exact: true })).toBeVisible();
      await expect(page.getByText("public-admin@n5.test", { exact: true })).toBeVisible();
    }
    await expect(page.getByText("admin123")).toBeVisible();
    await expect(page.getByText("reviewer@n5.test")).toBeVisible();
    await expect(page.getByText("N5review26")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open staff sign in" })).toHaveAttribute("href", "/admin/sign-in");
  } else {
    expect(response?.status()).toBe(404);
  }
});
