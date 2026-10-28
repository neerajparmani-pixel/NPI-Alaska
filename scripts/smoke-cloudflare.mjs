// Internal verification against a locally running Pages runtime. No live accounts.
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const base = process.env.NPI_TEST_BASE_URL || "http://127.0.0.1:8788";
const browser = await chromium.launch(
  existsSync("/usr/bin/chromium")
    ? { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] }
    : {},
);
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const violations = [];
  page.on("pageerror", (e) => violations.push(e.message));
  page.on("console", (message) => {
    if (
      /violates.*Content Security Policy|Refused to execute/i.test(
        message.text(),
      )
    )
      violations.push(message.text());
  });
  const login = await page.goto(base + "/login");
  assert.equal(login.status(), 200);
  assert.match(login.headers()["content-security-policy"], /script-src 'self'/);
  await page.getByLabel("Username", { exact: true }).fill("test.worker");
  await page.getByLabel("Password", { exact: true }).fill("test-only-not-real");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "not configured" }).waitFor();
  mkdirSync("test-results/release", { recursive: true });
  await page.screenshot({
    path: "test-results/release/login-phone.png",
    fullPage: true,
  });
  await page.goto(base + "/");
  await page.getByRole("heading", { name: "Let’s get to work." }).waitFor();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.getByRole("heading", { name: "Let’s get to work." }).waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "test-results/release/worker-phone.png",
    fullPage: true,
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("heading", { name: "Let’s get to work." }).waitFor();
  assert.equal(
    await page.evaluate(async () => {
      const keys = await caches.keys();
      for (const key of keys) {
        const c = await caches.open(key);
        if (
          (await c.keys()).some((r) =>
            new URL(r.url).pathname.startsWith("/api/"),
          )
        )
          return false;
      }
      return true;
    }),
    true,
  );
  await context.setOffline(false);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/login");
  await page.getByRole("heading", { name: "Welcome back." }).waitFor();
  await page.screenshot({
    path: "test-results/release/login-desktop.png",
    fullPage: true,
  });
  assert.deepEqual(violations, []);
  console.log(
    "PASS: compiled Pages runtime serves app and guarded auth; CSP, phone layout, offline shell and no API caching verified.",
  );
} finally {
  await browser.close();
}
