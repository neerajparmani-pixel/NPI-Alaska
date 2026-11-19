/** Capture the actual standalone sample for a short, narrated instructional video. */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
const out = "/tmp/npi-video";
await fs.mkdir(out, { recursive: true });
const html = await fs.readFile("downloads/NPI-Three-View-Sample.html", "utf8");
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 420, height: 700 } });
await page.route("http://npi-guide.test/**", (route) =>
  route.fulfill({ contentType: "text/html", body: html }),
);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const scenes = [];
async function shot(role, title, instruction, narration, selector) {
  if (selector) {
    await page
      .locator(selector)
      .first()
      .evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page
      .locator(selector)
      .first()
      .evaluate((el) => (el.style.outline = "3px solid #d8b766"));
  }
  await page.evaluate(() => document.fonts.ready);
  const id = String(scenes.length + 1).padStart(2, "0");
  await page.screenshot({ path: path.join(out, `screen-${id}.png`) });
  if (selector)
    await page
      .locator(selector)
      .first()
      .evaluate((el) => (el.style.outline = ""));
  scenes.push({ id, role, title, instruction, narration });
}
async function click(action, id) {
  const el = page
    .locator(`[data-action="${action}"]${id ? '[data-id="' + id + '"]' : ""}`)
    .first();
  if (!(await el.isVisible())) {
    const summary = el
      .locator("xpath=ancestor::details[not(@open)]/summary")
      .first();
    if (await summary.count()) await summary.click();
  }
  await el.click();
}
await page.goto("http://npi-guide.test/START-HERE.html");
await shot(
  "START",
  "Try one work record",
  "Click Start test transaction.",
  "Welcome to the N P I sample. Start one test record. No password or real payment is needed.",
  "[data-action=test-transaction]",
);
await click("test-transaction");
await shot(
  "WORKER",
  "Check your assignment",
  "Confirm the site and equipment.",
  "As a worker, check Boney Courthouse and the assigned equipment. The next action is Check in.",
  "[data-action=capture-in]",
);
await click("capture-in");
await shot(
  "WORKER",
  "Record check-in",
  "Capture a location, then confirm.",
  "At check in, capture a location. For this demonstration choose example G P S, then confirm. Example locations are simulated.",
  "[data-action=example-gps]",
);
await click("example-gps");
await click("capture-confirm");
for (const item of await page.locator("[data-task]").all()) await item.check();
await shot(
  "WORKER",
  "Complete the work",
  "Tick the completed tasks.",
  "Your shift is now in progress. Tick each completed task. Add a completion photo before sending your hours.",
  '[data-task="0"]',
);
await click("example-photo");
await shot(
  "WORKER",
  "Add completion evidence",
  "Use a real photo for real work.",
  "This example photo is only for testing. During real work, select a photo of the completed job.",
  "[data-action=example-photo]",
);
await click("capture-out");
await click("example-gps");
await page.getByLabel("Break minutes for this interval").fill("15");
await shot(
  "WORKER",
  "Record checkout",
  "New location + 15-minute break.",
  "Check out and capture a new location. Enter fifteen break minutes. Our simulated visit lasts two hours.",
  "[data-action=capture-confirm]",
);
await click("capture-confirm");
await click("claim");
await shot(
  "WORKER",
  "Send your hours",
  "2 hours − 15 minutes = 1 h 45 min.",
  "The app calculates one hour and forty five minutes. Confirm your claim, then send it to your company.",
  "#claim-form button[type=submit]",
);
await page.locator("#claim-form button[type=submit]").click();
await shot(
  "WORKER",
  "Your claim is submitted",
  "Your company reviews first.",
  "The worker record is now read only while it is reviewed. Original check in and check out stay unchanged.",
  ".notice",
);
await page.locator("#sample-tools>summary").click();
await page
  .locator("[data-action=test-stage][data-id=sub]")
  .scrollIntoViewIfNeeded();
await shot(
  "SAMPLE CONTROLS",
  "Change to company review",
  "Only for this local demonstration.",
  "Open Sample controls and choose Company review. In the real system, each person will have their own account.",
  "[data-action=test-stage][data-id=sub]",
);
await click("test-stage", "sub");
await shot(
  "SUBCONTRACTOR ADMIN",
  "Check and forward",
  "Inspect evidence before approval.",
  "The subcontractor checks recorded hours, the worker claim and evidence. Approve and forward the claim to N P I.",
  "[data-action=company-approve][data-id=DEMO-105]",
);
await click("company-approve", "DEMO-105");
await click("test-stage", "npi");
await shot(
  "NPI ADMIN",
  "Verify the same evidence",
  "Recorded / claimed / difference.",
  "N P I compares the original evidence with the company approved claim. Differences can be returned for correction.",
  "[data-action=npi-approve][data-id=DEMO-105]",
);
await click("npi-approve", "DEMO-105");
await shot(
  "NPI ADMIN",
  "Accept verified hours",
  "Explain any adjustment to the claim.",
  "Accept the verified hours. If you change any claimed hours, enter a reason. The original attendance is preserved.",
  "#verify-form button[type=submit]",
);
await page.locator("#verify-form button[type=submit]").click();
const work = await page.evaluate(() =>
  JSON.parse(localStorage.getItem("npi-three-view-v1")).jobs.find(
    (j) => j.testRecord,
  ),
);
if (work.status !== "approved" || work.acceptedHours !== 1.75)
  throw Error("The tutorial did not reach the expected approved result.");
await page.goto("http://npi-guide.test/START-HERE.html#reports");
await page.locator("#report-from").fill(work.date);
await page.locator("#report-until").fill(work.date);
await shot(
  "NPI ADMIN",
  "Review the outcome",
  "1.75 accepted worker-hours.",
  "The report now shows one approved record and one point seven five accepted worker hours. The decision history remains available.",
  ".metrics > .metric:nth-child(3)",
);
await page.locator("#preview-role").selectOption("worker");
await page.goto("http://npi-guide.test/START-HERE.html#hours");
await page.locator("#filter-date").fill(work.date);
await shot(
  "WORKER",
  "See your approved hours",
  "The worker can see the final result.",
  "The worker can also see the accepted hours. Live accounts, cloud sync and priced billing still need setup. This completes the sample.",
  ".metrics > .metric:nth-child(3)",
);
if (errors.length) throw Error(errors.join("\n"));
await fs.writeFile(
  path.join(out, "story.json"),
  JSON.stringify(scenes, null, 2),
);
// The instructor panel is browser-rendered around unmodified screenshots of the actual app.
const stage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const font400 = (
  await fs.readFile("public/three-view/fonts/body-400.woff2")
).toString("base64");
const font700 = (
  await fs.readFile("public/three-view/fonts/body-700.woff2")
).toString("base64");
const esc = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
for (const scene of scenes) {
  const screen = (
    await fs.readFile(path.join(out, `screen-${scene.id}.png`))
  ).toString("base64");
  await stage.setContent(
    `<!doctype html><html><head><style>@font-face{font-family:Guide;src:url(data:font/woff2;base64,${font400});font-weight:400}@font-face{font-family:Guide;src:url(data:font/woff2;base64,${font700});font-weight:700}*{box-sizing:border-box}body{margin:0;width:1280px;height:800px;background:#0b1d31;color:#fff;font-family:Guide,Arial,sans-serif}.copy{position:absolute;left:56px;top:38px;width:690px}.wordmark{font-size:18px;letter-spacing:2px;color:#b9cde1}.role{display:inline-block;font-size:18px;letter-spacing:1px;color:#e8c980;margin-top:38px}h1{font-size:48px;line-height:1.1;letter-spacing:-1px;margin:18px 0 26px;max-width:640px}.instruction{font-size:25px;color:#e8c980;border-left:3px solid #d8b766;padding-left:18px;margin-bottom:26px}.narration{font-size:28px;line-height:1.5;color:#d3dfec;max-width:655px}.bottom{position:absolute;left:56px;bottom:42px;width:690px}.step{font-size:20px;margin-bottom:12px}.bar{height:5px;border-radius:4px;background:#28425f}.bar div{height:5px;background:#d8b766;width:${(Number(scene.id) / scenes.length) * 100}%}.small{font-size:16px;color:#aebfd2;margin-top:18px}.phone{position:absolute;right:36px;top:38px;padding:8px;border-radius:23px;background:#b6c7d9;box-shadow:0 8px 35px #0005}.phone img{display:block;width:420px;height:700px;border-radius:16px}</style></head><body><div class="copy"><div class="wordmark">NPI / ALASKA OPERATIONS</div><div class="role">${esc(scene.role)}</div><h1>${esc(scene.title)}</h1><div class="instruction">${esc(scene.instruction)}</div><div class="narration">${esc(scene.narration.replaceAll("N P I", "NPI").replaceAll("G P S", "GPS"))}</div></div><div class="bottom"><div class="step">Step ${Number(scene.id)} of ${scenes.length}</div><div class="bar"><div></div></div><div class="small">Review sample · example GPS · no real invoice or payment<br>Synthetic voice instructor · captions shown on screen</div></div><div class="phone"><img src="data:image/png;base64,${screen}" alt="Actual sample screen"></div></body></html>`,
  );
  await stage.evaluate(() => document.fonts.ready);
  await stage.screenshot({ path: path.join(out, `scene-${scene.id}.png`) });
}
await browser.close();
console.log(
  `Captured ${scenes.length} tutorial scenes; approved ${work.id} at ${work.acceptedHours} hours.`,
);
