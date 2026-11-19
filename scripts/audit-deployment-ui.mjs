import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
const output = "setup/audit";
await fs.mkdir(output, { recursive: true });
const html = await fs.readFile("downloads/NPI-Three-View-Sample.html", "utf8");
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
await page.route("http://npi-audit.test/**", (r) =>
  r.fulfill({ contentType: "text/html", body: html }),
);
const results = [];
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function capture(step, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() =>
    Promise.all([...document.images].map((i) => i.decode().catch(() => {}))),
  );
  const screenshot = `${step}-${name}.png`;
  await page.screenshot({ path: `${output}/${screenshot}`, fullPage: false });
  const axe = await new AxeBuilder({ page }).analyze();
  results.push({
    step,
    name,
    screenshot,
    axeViolations: axe.violations.map((x) => ({
      id: x.id,
      impact: x.impact,
      description: x.description,
    })),
    pageOverflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  });
}
await page.goto("http://npi-audit.test/");
await page.locator(".bundled-logo").waitFor();
await capture("01", "welcome");
await page.locator("[data-action=role][data-id=worker]").click();
await page.setViewportSize({ width: 390, height: 844 });
await capture("02", "worker-phone");
await page.locator("#preview-role").selectOption("npi");
await page.evaluate(() => (location.hash = "sites"));
await page.locator("[data-action=photo-view][data-id=nesbit]").click();
await capture("03", "site-photo-viewer");
await page.locator("#dialog [data-action=close]").last().click();
await page.evaluate(() => (location.hash = "settings"));
await page.locator("[data-action=new-rate]").click();
await capture("04", "rate-form");
await page.locator("#rate-form button[type=submit]").scrollIntoViewIfNeeded();
await capture("04b", "rate-actions");
await page.locator("#dialog [data-action=close]").first().click();
await page.setViewportSize({ width: 1440, height: 1000 });
await capture("05", "settings");
await fs.writeFile(
  `${output}/runtime-results.json`,
  JSON.stringify(
    {
      method:
        "Chromium via Playwright; exact standalone package served on a local virtual origin",
      steps: results,
      errors,
    },
    null,
    2,
  ) + "\n",
);
await browser.close();
if (
  errors.length ||
  results.some((r) => r.axeViolations.length || r.pageOverflow)
)
  throw Error("Audit runtime findings require review");
console.log(
  "Captured five current audit steps; no axe violations, page overflow or JavaScript errors.",
);
