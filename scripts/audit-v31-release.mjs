import { trainingCamera } from "./training-camera.mjs";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import { backend, u } from "../tests/helpers/live-fixture.js";
const root = "docs/operations-v3.1.0/audit";
await fs.mkdir(root, { recursive: true });
const fixture = JSON.parse(
  await fs.readFile("docs/operations-v3.1.0/training/fixture.json", "utf8"),
);
const cameraFile = await trainingCamera();
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    `--use-file-for-fake-video-capture=${cameraFile}`,
  ],
});
const results = [];
for (const role of ["worker", "sub", "npi"]) {
  const context = await browser.newContext({
    viewport: {
      width: role === "worker" ? 390 : 1440,
      height: role === "worker" ? 844 : 1000,
    },
    permissions: ["camera", "geolocation"],
    geolocation: { latitude: 61.2181, longitude: -149.8923, accuracy: 12 },
  });
  const page = await context.newPage();
  const state = structuredClone(fixture.state);
  const w = state.work[0];
  w.status =
    role === "worker"
      ? "draft"
      : role === "sub"
        ? "contractor-review"
        : "npi-review";
  state.events = role === "worker" ? [] : state.events;
  for (const review of state.reviews) {
    review.accepted_minutes = null;
    if (role === "worker") {
      review.claimed_minutes = null;
      review.recorded_minutes = 0;
    }
  }
  const files = new Map(
    fixture.files.map((f) => [
      f.path,
      { type: f.type, bytes: Buffer.from(f.base64, "base64") },
    ]),
  );
  await backend(page, { sharedState: state, sharedFiles: files });
  const act = async (a) => {
    await page.locator(`[data-action="${a}"]:visible`).first().click();
    await page.waitForTimeout(500);
  };
  const close = async () => {
    if (await page.locator("#dialog").isVisible()) {
      await act("close");
      if (await page.locator("[data-action=discard]:visible").count())
        await act("discard");
    }
  };
  const shot = async (name, note) => {
    await page.waitForTimeout(200);
    await page.screenshot({ path: root + "/" + name + ".png" });
    const a = await new AxeBuilder({ page }).analyze();
    results.push({
      name,
      role,
      note,
      violations: a.violations,
      incomplete: a.incomplete.map((x) => ({ id: x.id, impact: x.impact })),
    });
    console.log(name, a.violations.length);
  };
  await page.goto("http://127.0.0.1:5175/live/");
  await page
    .locator("#username")
    .fill(role === "npi" ? "owner" : role === "sub" ? "supervisor" : "alex");
  await page.locator("#password").fill("fictional-audit-password");
  await page.locator("#login-form button[type=submit]").click();
  await page.locator(".live-connection").waitFor();
  if (role === "worker") {
    await shot(
      "01-worker-home",
      "Worker can start a visit without an assignment. Supplied site photo and current work remain available.",
    );
    await act("visit-new");
    await shot(
      "02-site-service",
      "Site and service selection, optional crew disclosure and nearest-site suggestion.",
    );
    await close();
    await act("open-work");
    await shot(
      "03-prepared-visit",
      "Short service cards and before-photo/start actions.",
    );
    await act("upload");
    await page.locator("#start-camera").click();
    await page.waitForTimeout(700);
    await page.locator("#capture-photo").click();
    await page.waitForFunction(() => {
      const i = document.querySelector("#capture-image");
      return i?.naturalWidth > 0 && !i.closest("[hidden]");
    });
    await shot(
      "04-direct-camera",
      "Direct camera capture with keep and retake; synthetic camera feed.",
    );
    await close();
    await act("visit-line");
    await page
      .locator("#ruler_evidence")
      .selectOption(
        state.evidence.find(
          (e) => e.stage === "before" && e.source === "app-camera",
        ).id,
      );
    await page.locator("#snow_inches").fill("1");
    await shot(
      "05-snow-measurement",
      "Ruler photo, manual inches and explicit confirmation. Automatic reading is optional.",
    );
    await page.route("**/functions/v1/npi-admin", (r) =>
      r.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"Reading unavailable"}',
      }),
    );
    await act("visit-read");
    await shot(
      "06-reading-fallback",
      "Unavailable automatic reader leaves manual input usable and does not confirm a reading.",
    );
    await close();
    w.status = "in-progress";
    await act("refresh");
    await act("field-report");
    await shot(
      "07-issue-report",
      "Category, urgency and description use the established issue form.",
    );
    await close();
  } else if (role === "sub") {
    await page.goto("http://127.0.0.1:5175/live/#review");
    await page.getByRole("heading", { name: "Review hours" }).waitFor();
    await act("open-work");
    await page
      .getByRole("heading", { name: "Services recorded" })
      .scrollIntoViewIfNeeded();
    await shot(
      "08-company-review",
      "Company reviews line/sub-line quantities and original versus claimed hours.",
    );
    await page
      .getByRole("heading", { name: "Photo & document gallery" })
      .scrollIntoViewIfNeeded();
    await act("field-file");
    await shot(
      "09-private-photo",
      "Same private viewing file available to the company; original retained separately.",
    );
    await close();
  } else {
    await page.goto("http://127.0.0.1:5175/live/#settings");
    await page
      .getByRole("heading", { name: "Contract line items & sub-line items" })
      .waitFor();
    await page
      .getByRole("heading", { name: "Contract line items & sub-line items" })
      .scrollIntoViewIfNeeded();
    await shot(
      "10-npi-catalogue",
      "Contract line and sub-line configuration remains in NPI administration.",
    );
    await act("visit-subitem");
    await page.locator("#parent_id").selectOption(state.visits.items[0].id);
    await shot(
      "11-sub-line-configuration",
      "Parent line sets contract, service category and unit. Snow minimum/maximum bounds are explicit.",
    );
    await close();
    await act("field-settings");
    await shot(
      "12-notification-settings",
      "Separate recipient list, escalation and daily-summary control.",
    );
    await close();
    await page.goto("http://127.0.0.1:5175/live/#review");
    await page.getByRole("heading", { name: "Review hours" }).waitFor();
    await act("open-work");
    await act("npi-approve");
    await shot(
      "13-npi-verification",
      "Exact claimed hours or reasoned correction; approval still follows company review.",
    );
  }
  await context.close();
}
await browser.close();
await fs.writeFile(
  root + "/axe-results.json",
  JSON.stringify(results, null, 2),
);
if (results.some((r) => r.violations.length)) process.exitCode = 1;
