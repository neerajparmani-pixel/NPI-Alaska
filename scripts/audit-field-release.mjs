// Third-party automated checks of the current local app with explicit intercepted training responses.
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import puppeteer from "/tmp/npi-audit-tools/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";
import { startFlow } from "/tmp/npi-audit-tools/node_modules/lighthouse/core/index.js";
import { backend } from "../tests/helpers/live-fixture.js";
import fs from "node:fs/promises";
const root = "docs/operations-v2/audit";
await fs.mkdir(root, { recursive: true });
const fixture = JSON.parse(
  await fs.readFile("docs/operations-v2/training/fixture.json", "utf8"),
);
const files = new Map(
  fixture.files.map((f) => [
    f.path,
    { type: f.type, bytes: Buffer.from(f.base64, "base64") },
  ]),
);
const chrome = await puppeteer.launch({
  executablePath: "/usr/bin/chromium",
  headless: true,
  args: [
    "--no-sandbox",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const browser = await chromium.connectOverCDP(chrome.wsEndpoint());
const context = browser.contexts()[0],
  page = context.pages()[0],
  pp = (await chrome.pages())[0];
await context.grantPermissions(["camera", "geolocation"]);
await context.setGeolocation({ latitude: 61.2181, longitude: -149.8923 });
await page.setViewportSize({ width: 1440, height: 1000 });
const { state } = await backend(page, {
  sharedState: fixture.state,
  sharedFiles: files,
});
state.work[0].status = "npi-review";
const flow = await startFlow(pp, {
  name: "NPI Operations 2.0: evidence, issues and three-role audit",
  flags: {
    screenEmulation: { disabled: true },
    formFactor: "desktop",
    onlyCategories: ["accessibility", "best-practices"],
  },
});
const results = [];
async function capture(name) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.screenshot({ path: root + "/" + name + ".png" });
  const a = await new AxeBuilder({ page }).analyze();
  results.push({
    name,
    violations: a.violations,
    incomplete: a.incomplete.map((x) => ({ id: x.id, impact: x.impact })),
  });
  await flow.snapshot({ name });
  console.log(name, a.violations.length, "axe violations");
}
async function act(a) {
  await page.locator(`[data-action="${a}"]:visible`).first().click();
  await page.waitForTimeout(400);
}
async function go(hash) {
  await page.goto("http://127.0.0.1:5175/live/#" + hash);
  await page.waitForTimeout(450);
}
async function login(user) {
  await page.locator("#username").fill(user);
  await page.locator("#password").fill("fictional-pass-123");
  await page.locator("#login-form button[type=submit]").click();
  await page.locator(".live-connection").waitFor();
  await page.waitForTimeout(400);
}
async function close() {
  await act("close");
  if (await page.locator("[data-action=discard]:visible").count())
    await act("discard");
}
await page.goto("http://127.0.0.1:5175/live/");
await capture("01-sign-in");
await login("owner@npi.test");
await capture("02-npi-overview");
await go("work");
await capture("03-work-register");
await act("open-work");
await page
  .getByRole("heading", { name: "Assignment & team", exact: true })
  .evaluate((el) => el.scrollIntoView({ block: "start" }));
await capture("04-assignment-team");
await page
  .getByRole("heading", { name: "Photo & document gallery", exact: true })
  .evaluate((el) => el.scrollIntoView({ block: "start" }));
await capture("05-private-gallery");
await act("field-file");
await capture("06-stamped-photo");
await close();
await go("settings");
await act("field-settings");
await capture("07-npi-recipients");
await close();
await act("logout");
await login("supervisor");
await go("issues");
await act("field-issue");
await capture("08-company-issue");
await close();
await act("logout");
state.work[0].status = "in-progress";
await page.setViewportSize({ width: 390, height: 844 });
await login("alex");
await capture("09-worker-home");
await act("open-work");
await act("upload");
const pics = fixture.files
  .filter((f) => f.path.endsWith("original.jpg"))
  .slice(0, 2);
await page.locator("#multi-files").setInputFiles(
  pics.map((f, i) => ({
    name: "training-before-" + i + ".jpg",
    mimeType: f.type,
    buffer: Buffer.from(f.base64, "base64"),
  })),
);
await page
  .locator("#photo-queue")
  .evaluate((el) => el.scrollIntoView({ block: "start" }));
await capture("10-multiple-upload-queue");
await close();
await act("field-report");
await capture("11-worker-issue-report");
await close();
await act("upload");
await page.locator("#start-camera").click();
await page.waitForFunction(
  () => document.querySelector("#camera-feed").videoWidth > 0,
  {},
  { timeout: 8000 },
);
await page.locator("#capture-photo").click();
await page
  .locator("#capture-review")
  .evaluate((el) => el.scrollIntoView({ block: "start" }));
await capture("12-direct-camera-preview");
await close();
await act("claim");
await page.locator("#action-form button[type=submit]").click();
await page
  .getByRole("heading", {
    name: "Work submitted for company review.",
    exact: true,
  })
  .waitFor();
await capture("13-submission-confirmation");
await close();
await act("logout");
await page.setViewportSize({ width: 1440, height: 1000 });
state.work[0].status = "npi-review";
state.work[0].outcome = "partial";
state.work[0].outcome_reason = "Training exception: one area was inaccessible.";
await login("owner@npi.test");
await go("work");
await act("open-work");
await act("npi-approve");
await capture("14-explicit-exception-review");
await fs.writeFile(
  root + "/lighthouse-three-roles.html",
  await flow.generateReport(),
);
await fs.writeFile(
  root + "/lighthouse-three-roles.json",
  JSON.stringify(await flow.createFlowResult(), null, 2),
);
await fs.writeFile(
  root + "/axe-three-roles.json",
  JSON.stringify(results, null, 2),
);
await chrome.close();
