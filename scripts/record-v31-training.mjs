import { trainingCamera } from "./training-camera.mjs";
// Record the actual frontend; all cloud, GPS and camera inputs are training fixtures.
import { chromium } from "playwright";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { backend, u } from "../tests/helpers/live-fixture.js";
import { prepareVisits } from "../tests/helpers/visits-fixture.js";
const root = "docs/operations-v3.1.0/training";
await fs.mkdir(root, { recursive: true });
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
let sharedState, sharedFiles;
const stories = [];
for (const role of ["worker", "sub", "npi"]) {
  const mobile = role === "worker";
  const ctx = await browser.newContext({
    viewport: { width: mobile ? 390 : 1280, height: mobile ? 844 : 720 },
    recordVideo: {
      dir: root + "/raw",
      size: { width: mobile ? 390 : 1280, height: mobile ? 844 : 720 },
    },
    permissions: ["camera", "geolocation"],
    geolocation: { latitude: 61.2181, longitude: -149.8923, accuracy: 12 },
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  const fixture = await backend(page, { sharedState, sharedFiles });
  sharedState = fixture.state;
  sharedFiles = fixture.storedFiles;
  const state = sharedState;
  if (role === "worker") {
    prepareVisits(state);
    state.people.find((p) => p.id === u.worker).display_name = "Alex Morgan";
    state.people.find((p) => p.id === u.sub).display_name =
      "Company Administrator";
    state.people.find((p) => p.id === u.npi).display_name = "NPI Administrator";
    state.companies[0].name = "Example Alaska Contractor";
    for (const [name, photo_path] of [
      ["Nesbit Courthouse", "nesbit"],
      ["Snowden Courthouse", "snowden"],
      ["Anchorage Youth Court", "youth"],
    ])
      state.sites.push({
        id: crypto.randomUUID(),
        name,
        photo_path,
        address: "Training reference — verify before live use",
        version: 1,
      });
    state.field = {
      issues: [],
      comments: [],
      history: [],
      notifications: [],
      email_status: [],
      settings: [
        {
          scope: "npi",
          emails: ["npi@example.test"],
          escalation_minutes: 60,
          daily_summary: false,
        },
        {
          scope: state.companies[0].id,
          emails: ["company@example.test"],
          escalation_minutes: 60,
          daily_summary: false,
        },
      ],
    };
  }
  const scenes = [],
    start = Date.now();
  const act = async (name) => {
    await page.locator(`[data-action="${name}"]:visible`).first().click();
    await page.waitForTimeout(350);
  };
  const save = async () => {
    await page.locator("#action-form button[type=submit]").click();
    await page.waitForTimeout(500);
  };
  const close = async () => {
    if (!(await page.locator("#dialog").isVisible())) return;
    await act("close");
    if (await page.locator("[data-action=discard]:visible").count())
      await act("discard");
  };
  const go = async (hash) => {
    await page.goto("http://127.0.0.1:5173/live/#" + hash);
    await page.waitForTimeout(700);
  };
  const scene = async (title, text, fn) => {
    const s = (Date.now() - start) / 1000;
    await fn();
    await page.waitForTimeout(1000);
    scenes.push({ title, text, start: s, end: (Date.now() - start) / 1000 });
    console.log(role, title);
  };
  await page.goto("http://127.0.0.1:5173/live/");
  await scene(
    "Company account",
    "Sign in with your company account. This recording uses fictional records, simulated location and a test camera. No live work is created.",
    async () => {
      await page
        .locator("#username")
        .fill(
          role === "npi" ? "owner" : role === "sub" ? "supervisor" : "alex",
        );
      await page.locator("#password").fill("training-only-password");
      if (role === "worker")
        await page.locator("[name=remember_device]").check();
      await page.locator("#login-form button[type=submit]").click();
      await page.locator(".live-connection").waitFor();
    },
  );
  if (role === "worker") {
    await scene(
      "Start a visit",
      "Select Start work. Choose your authorised site and service. No daily assignment is required. Expand Crew and equipment only when recording a crew or equipment details.",
      async () => {
        await act("visit-new");
        await page.locator("#line_id").selectOption(state.visits.items[0].id);
        await page
          .locator("summary")
          .filter({ hasText: "Crew & equipment" })
          .click();
        await page.locator("#equipment").fill("Loader 04");
        await save();
      },
    );
    await scene(
      "Before photos",
      "Add before photos before starting. Use Take photo, then Capture and Keep. Repeat for more pictures, or choose several files for ordinary evidence. Snow ruler evidence must use the in-app camera. Device-saved photos survive a reload; wait for server upload before checking in.",
      async () => {
        await act("upload");
        await page.locator("#start-camera").click();
        await page.waitForTimeout(900);
        await page.locator("#capture-photo").click();
        await page.locator("#keep-photo").click();
        await page.waitForTimeout(500);
        await page.locator("#capture-photo").click();
        await page.locator("#keep-photo").click();
        await page.locator("#stop-camera").click();
        await page.waitForFunction(
          () =>
            document.querySelectorAll(".photo-card").length === 2 &&
            [...document.querySelectorAll(".photo-card")].every((c) =>
              c.textContent.includes("Saved on this device"),
            ),
        );
      },
    );
    await scene(
      "Device recovery",
      "On a personal device, Keep me signed in restores your session after a reload. Unsent photos are saved on this device under your own account. Device photos lets you resume a visit or download an original. Shared devices should not remember sessions; signing out removes your pending device photos after confirmation.",
      async () => {
        await close();
        await page.reload();
        await page.locator(".live-connection").waitFor();
        await go("work");
        await act("visit-device");
      },
    );
    await scene(
      "Confirm snow depth",
      "Record snow depth. Select the ruler photo and enter inches. Automatic reading is optional and must be confirmed. Manual entry remains available when automatic reading is unavailable. This one-inch example selects Below 2 inches and flags the work for both reviews. It does not create a billing entitlement.",
      async () => {
        await page.locator("#dialog [data-action=open-work]").first().click();
        await act("upload");
        await page.locator(".photo-card").first().waitFor();
        await page.locator("#upload-batch").click();
        await page.waitForFunction(() =>
          document
            .querySelector("#photo-status")
            .textContent.includes("saved successfully"),
        );
        await close();
        await act("visit-line");
        await page
          .locator("#ruler_evidence")
          .selectOption(state.evidence.at(-1).id);
        await page.locator("#snow_inches").fill("1");
        await page.locator("[name=measurement_confirmed]").check();
        await save();
      },
    );
    await scene(
      "Check in with GPS",
      "Select Start work and capture a fresh position. Record attendance only after the correct site and required before evidence are saved. A typed location does not replace GPS attendance.",
      async () => {
        await act("clock-in");
        await act("gps");
        await save();
        await close();
      },
    );
    await scene(
      "Add another service",
      "One visit can contain several services. Add sanding to the same visit. Record its quantity and completion separately. Attendance hours are counted once for each worker, not once per service.",
      async () => {
        await act("visit-add");
        await page.locator("#line_id").selectOption(state.visits.items[1].id);
        await save();
        await page.locator("[data-action=visit-line]").nth(1).click();
        await page.locator("#quantity").fill("1.5");
        await page.locator("[name=completed]").check();
        await save();
        await page.locator("[data-action=visit-line]").first().click();
        await page.locator("[name=measurement_confirmed]").check();
        await page.locator("[name=completed]").check();
        await save();
      },
    );
    await scene(
      "Report an issue",
      "Use Report a problem for access, safety, equipment or other issues. Choose urgency and describe the problem. Both administrators receive in-app alerts; email requires the configured sender and dispatcher.",
      async () => {
        await act("field-report");
        await page
          .locator("#description")
          .fill(
            "Training issue: access route was blocked. Alternate route used.",
          );
        await save();
        await close();
      },
    );
    await scene(
      "After photos and checkout",
      "Add after-work photos, then select Finish work. Capture a new checkout location and record any unpaid break. Original attendance remains unchanged if a later claim needs correction.",
      async () => {
        await act("upload");
        await page.locator("#photo-stage").selectOption("after");
        await page.locator("#start-camera").click();
        await page.waitForTimeout(600);
        await page.locator("#capture-photo").click();
        await page.locator("#keep-photo").click();
        await page.locator("#stop-camera").click();
        await page.locator("#upload-batch").click();
        await page.waitForFunction(() =>
          document.querySelector("#photo-status").textContent.includes("saved"),
        );
        await close();
        await act("clock-out");
        await act("gps");
        await save();
        await close();
      },
    );
    await scene(
      "Submit for review",
      "Check your recorded hours and submit. Explain any correction instead of changing original check-ins. The company reviews first, then NPI verifies. The displayed one hour forty-five minutes is a training value, not the recording duration.",
      async () => {
        await act("claim");
        await save();
        await close();
      },
    );
    assert.equal(state.work[0].status, "contractor-review");
  } else if (role === "sub") {
    await scene(
      "Review when needed",
      "The overview shows worker-started activity and the company review queue. You do not need to assign each job. Visit the app periodically, or use the configured daily summary to identify pending reviews.",
      async () => {
        await go("overview");
      },
    );
    await scene(
      "Invite and approve workers",
      "Manage your own workers in My team. Share a worker invitation, check registrations and approve access. Approved workers can start visits within your company’s contract sites.",
      async () => {
        await go("people");
      },
    );
    await scene(
      "Inspect services and hours",
      "Open a submitted work record. Review the crew, each line and sub-line item, measured snow depth and service quantities. Compare original attendance with the worker’s claimed hours.",
      async () => {
        await go("review");
        await act("open-work");
        await page
          .getByRole("heading", { name: "Services recorded" })
          .scrollIntoViewIfNeeded();
      },
    );
    await scene(
      "Inspect photos and issues",
      "Open before and after photos in the private gallery. Check ruler evidence against the confirmed inches. Review location links and resolve reported issues with a clear explanation.",
      async () => {
        await page
          .getByRole("heading", { name: "Photo & document gallery" })
          .scrollIntoViewIfNeeded();
        await act("field-file");
        await close();
        await go("issues");
        await act("field-issue");
        await page.locator("#status").selectOption("resolved");
        await page
          .locator("#resolution")
          .fill("Training resolution: access route checked and cleared.");
        await save();
      },
    );
    await scene(
      "Forward or return",
      "Approve only after checking the services, hours and evidence. Acknowledge the below-two-inch flag after inspecting the ruler photo. Forward the record to NPI, or request a correction with a reason. Company approval does not replace NPI verification.",
      async () => {
        await go("review");
        await act("open-work");
        await act("company-approve");
        await page.locator("[name=acknowledge_below_threshold]").check();
        await save();
        await close();
      },
    );
    await scene(
      "Recipients and daily summary",
      "Set your company’s recipient emails in Settings. Daily summaries are off by default; enable them only when wanted. Immediate issue alerts and queued email status remain available here. A verified sender and scheduled dispatcher are required.",
      async () => {
        await go("settings");
        await act("field-settings");
      },
    );
    assert.equal(state.work[0].status, "npi-review");
  } else {
    await scene(
      "One-time contract setup",
      "Set up the main contract, authorised sites and subcontractor access once. Invite the subcontractor administrator. Their approved workers can then start work without waiting for an assignment.",
      async () => {
        await go("contracts");
      },
    );
    await scene(
      "Line items and sub-line items",
      "Settings holds each contract’s line items and sub-line items. Codes stay in management records; workers see simple service names. New snow services stay in draft until bands cover zero upwards without gaps. The Below 2 inches band is created for you. Activate the parent after completing the remaining bands. No prices are included.",
      async () => {
        await go("settings");
        await page
          .getByRole("heading", {
            name: "Contract line items & sub-line items",
          })
          .scrollIntoViewIfNeeded();
        await act("visit-subitem");
        await page.locator("#parent_id").selectOption(state.visits.items[0].id);
      },
    );
    await close();
    await scene(
      "Periodic review queue",
      "Use the overview and NPI verification queue to review submitted work. The company reviews first. Current activity, open issues and exceptions are visible without creating daily assignments.",
      async () => {
        await go("overview");
      },
    );
    await scene(
      "Verify the complete visit",
      "Inspect the same crew, services, quantities and snow evidence that the company reviewed. Recorded, claimed and accepted hours remain separate. Multiple service lines do not multiply worker attendance.",
      async () => {
        await go("review");
        await act("open-work");
        await page
          .getByRole("heading", { name: "Services recorded" })
          .scrollIntoViewIfNeeded();
      },
    );
    await scene(
      "Accept or request correction",
      "Acknowledge the below-two-inch flag. Accept the exact claimed hours or enter a correction with a reason. Return incomplete records to the company. Original photos, attendance and the review history are retained.",
      async () => {
        await act("npi-approve");
        await page.locator("[name=acknowledge_below_threshold]").check();
        await save();
        await close();
      },
    );
    await scene(
      "Evidence exception report",
      "Reports show how many submitted visits each worker completed with an explicit missing-evidence reason. A partial outcome alone cannot bypass evidence. These figures help review; they do not automatically prove misconduct.",
      async () => {
        await go("reports");
      },
    );
    await scene(
      "Seven-tab management workbook",
      "The management workbook mirrors visits, line items, sub-line items, measurements, attendance and review history in seven tabs. Permitted planning edits return as NPI-reviewed proposals. Passwords and private image files stay out of cells.",
      async () => {
        await go("sheets");
      },
    );
    await scene(
      "Notifications and deployment",
      "Configure NPI recipient emails and the daily summary in Settings. Apply the included migration and update the app, function and workbook script before live use. Test the full workflow with separate company accounts.",
      async () => {
        await go("settings");
        await act("field-settings");
      },
    );
    assert.equal(state.work[0].status, "approved");
  }
  stories.push({ role, mobile, scenes });
  const video = page.video();
  await ctx.close();
  await video.saveAs(`${root}/${role}-screen.webm`);
}
await browser.close();
stories.sort(
  (a, b) =>
    ["npi", "sub", "worker"].indexOf(a.role) -
    ["npi", "sub", "worker"].indexOf(b.role),
);
await fs.writeFile(root + "/stories.json", JSON.stringify(stories, null, 2));
await fs.writeFile(
  root + "/fixture.json",
  JSON.stringify(
    {
      state: sharedState,
      files: [...sharedFiles].map(([path, v]) => ({
        path,
        type: v.type,
        base64: v.bytes.toString("base64"),
      })),
    },
    null,
    2,
  ),
);
console.log("Recorded all three roles.");
