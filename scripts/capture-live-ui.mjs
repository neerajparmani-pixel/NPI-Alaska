// Local visual evidence only: provider calls and signed-in records are fixtures.
import { chromium } from "playwright";
import { backend, u } from "../tests/helpers/live-fixture.js";
import { mkdir } from "node:fs/promises";
await mkdir("docs/live", { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
for (const [name, width, height, username, empty] of [
  ["desktop-login", 1440, 1000, null, true],
  ["desktop-admin", 1440, 1000, "owner@npi.test", false],
  ["desktop-empty", 1440, 1000, "owner@npi.test", true],
  ["phone-admin", 390, 844, "owner@npi.test", false],
  ["phone-worker", 390, 844, "alex", false],
]) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  const { state } = await backend(page);
  state.people.find((p) => p.id === u.npi).display_name = "NPI Administrator";
  state.people.find((p) => p.id === u.worker).display_name = "Alex Morgan";
  state.companies[0].name = "Example field services";
  state.summary = {
    active: 0,
    company_review: 0,
    npi_review: 0,
    approved: 0,
    work_count: empty ? 0 : 1,
  };
  if (empty) {
    state.work = [];
    state.members = [];
    state.reviews = [];
  }
  await page.goto("http://127.0.0.1:5173/live/");
  if (username) {
    await page.locator("#username").fill(username);
    await page.locator("#password").fill("fictional-pass-123");
    await page.locator("#login-form button[type=submit]").click();
    await page.locator(".live-connection").waitFor();
  }
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `docs/live/${name}.png`, fullPage: true });
  await context.close();
}
await browser.close();
