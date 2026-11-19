// Version 2 actual screen recordings. Network, camera and GPS are simulated training inputs.
import { chromium } from "playwright";
import { backend, u } from "../tests/helpers/live-fixture.js";
import fs from "node:fs/promises";
const root = "docs/operations-v2/training";
await fs.mkdir(root, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
let sharedState, sharedFiles;
const stories = [];
for (const role of ["worker", "sub", "npi"]) {
  const mobile = role === "worker";
  const context = await browser.newContext({
    viewport: { width: mobile ? 390 : 1280, height: mobile ? 844 : 720 },
    recordVideo: {
      dir: root + "/raw",
      size: { width: mobile ? 390 : 1280, height: mobile ? 844 : 720 },
    },
    permissions: ["camera", "geolocation"],
    geolocation: { latitude: 61.2181, longitude: -149.8923, accuracy: 12 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const fixture = await backend(page, { sharedState, sharedFiles });
  const { state } = fixture;
  sharedState = state;
  sharedFiles = fixture.storedFiles;
  if (role === "worker") {
    state.companies[0].name = "Example Alaska Contractor";
    state.people.find((p) => p.id === u.worker).display_name = "Alex Morgan";
    state.people.find((p) => p.id === u.sub).display_name =
      "Company Administrator";
    state.people.find((p) => p.id === u.npi).display_name = "NPI Administrator";
    state.sites[0].address = "Training address — verify before live use";
    state.sites[0].latitude = 61.2181;
    state.sites[0].longitude = -149.8923;
    state.sites[0].radius_metres = 200;
    for (const [name, photo_path] of [
      ["Nesbit Courthouse", "nesbit"],
      ["Snowden Courthouse", "snowden"],
      ["Anchorage Youth Court", "youth"],
    ])
      state.sites.push({
        id: crypto.randomUUID(),
        name,
        photo_path,
        address: "Training reference — verify the address",
        version: 1,
      });
    state.contracts = [
      {
        id: crypto.randomUUID(),
        name: "Example court services",
        client: "Example customer",
        active: true,
      },
    ];
    state.scopes = state.sites.map((s) => ({
      id: crypto.randomUUID(),
      contract_id: state.contracts[0].id,
      site_id: s.id,
      company_id: state.companies[0].id,
      active: true,
    }));
    Object.assign(state.work[0], {
      created_by: u.sub,
      created_at: new Date().toISOString(),
      contract_id: state.contracts[0].id,
      area: "Main access route and entrance",
      instructions:
        "Keep pedestrian access clear. Report blocked access before proceeding.",
      evidence_policy: { before: true, after: true },
      outcome: "complete",
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
          emails: ["npi.manager@example.test"],
          escalation_minutes: 60,
        },
        {
          scope: state.companies[0].id,
          emails: ["company.admin@example.test"],
          escalation_minutes: 60,
        },
      ],
      storage: { files: 0, bytes: 0 },
    };
  }
  if (role === "sub" && !state.people.some((p) => p.username === "casey"))
    state.people.push({
      id: crypto.randomUUID(),
      role: "worker",
      username: "casey",
      display_name: "Casey Lee",
      company_id: state.companies[0].id,
      active: false,
      account_status: "pending",
      access_version: 1,
    });
  await page.goto("http://127.0.0.1:5175/live/");
  const started = Date.now(),
    scenes = [];
  async function scene(title, text, action) {
    const start = (Date.now() - started) / 1000;
    await action();
    await page.waitForTimeout(950);
    scenes.push({ title, text, start, end: (Date.now() - started) / 1000 });
    console.log(role, title, flush());
  }
  function flush() {
    return "";
  }
  async function act(name) {
    await page.locator(`[data-action="${name}"]:visible`).first().click();
    await page.waitForTimeout(400);
  }
  async function go(hash) {
    await page.goto("http://127.0.0.1:5175/live/#" + hash);
    await page.waitForTimeout(350);
  }
  async function close() {
    await act("close");
    if (await page.locator("[data-action=discard]:visible").count())
      await act("discard");
  }
  async function save() {
    await page.locator("#action-form button[type=submit]").click();
    await page.waitForTimeout(450);
  }
  async function login() {
    await page
      .locator("#username")
      .fill(
        role === "npi"
          ? "owner@npi.test"
          : role === "sub"
            ? "supervisor"
            : "alex",
      );
    await page.locator("#password").fill("fictional-pass-123");
    await page.locator("#login-form button[type=submit]").click();
    await page.locator(".live-connection").waitFor();
  }
  async function capture() {
    await page.waitForFunction(
      () => document.querySelector("#camera-feed").videoWidth > 0,
      {},
      { timeout: 8000 },
    );
    await page.locator("#capture-photo").click();
    await page.waitForTimeout(250);
    await page.locator("#keep-photo").click();
    await page.waitForTimeout(550);
  }
  async function upload() {
    await page.locator("#stop-camera").click();
    await page.locator("#upload-batch").click();
    await page.waitForFunction(
      () =>
        document
          .querySelector("#photo-status")
          ?.textContent.includes("saved successfully"),
      {},
      { timeout: 10000 },
    );
  }
  await scene(
    "Sign in to your company account",
    "This guide uses the running app with fictional training records. Camera, location and cloud responses are simulated. Sign in with your company username and password. The written guide includes every task and setup step.",
    login,
  );
  if (role === "worker") {
    await scene(
      "1. Register and wait for approval",
      "First use the invitation from your subcontractor administrator. Enter your own name, username and password. Your company and role come from the invitation. Your administrator must approve your account before you can work.",
      async () => {
        await act("logout");
        await go("join=" + "a".repeat(64));
        await page.locator("#registration-form").waitFor();
      },
    );
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await login();
    await scene(
      "2. Open the correct assignment",
      "My work shows your assignments. Check the building photo, date and instructions. Open the assignment and read the exact work area and hazards. Your assigned team is listed in the record. Use search filters only when needed.",
      async () => {
        await go("work");
        await act("open-work");
      },
    );
    await scene(
      "3. Check in with fresh GPS",
      "At the site, choose Check in. Select the correct assigned crew members. Capture your current location and allow precise location permission. Check the position and accuracy before recording attendance. Every checkout needs another fresh capture.",
      async () => {
        await act("clock-in");
        await act("gps");
      },
    );
    await save();
    await scene(
      "4. Take the first before photo",
      "Choose Upload evidence and select Before work. Tap Take photo, then Capture photo. Inspect the preview. Keep the picture if it is useful, or choose Retake. This demonstration uses a synthetic camera feed.",
      async () => {
        await act("upload");
        await page.locator("#start-camera").click();
        await page.waitForFunction(
          () => document.querySelector("#camera-feed").videoWidth > 0,
          {},
          { timeout: 8000 },
        );
        await page.locator("#capture-photo").click();
      },
    );
    await scene(
      "5. Keep it and take another",
      "Tap Keep photo. The camera opens again so you can take the next picture. Repeat one at a time. Review your thumbnails and remove unwanted pictures before uploading. Each picture retains its own capture record.",
      async () => {
        await page.locator("#keep-photo").click();
        await page.waitForTimeout(500);
        await capture();
        await page.locator("#stop-camera").click();
      },
    );
    await scene(
      "6. Upload and confirm every picture",
      "Tap Upload photos. Wait until every picture says Saved. Failed items remain available for retry, while saved items are not uploaded again. Originals remain unchanged; management sees a stamped viewing copy and the server upload time.",
      async () => {
        await page.locator("#upload-batch").click();
        await page.waitForFunction(
          () =>
            document
              .querySelector("#photo-status")
              ?.textContent.includes("saved successfully"),
          {},
          { timeout: 10000 },
        );
      },
    );
    await close();
    await scene(
      "7. Complete tasks and report problems",
      "Update the checklist as the work is completed. Hauling jobs also need whole loads and their timecard. If work is only partial, impossible, or required evidence is missing, use Work outcome and explain the reason. Never invent a completed task or photo.",
      async () => {
        await act("tasks");
        for (const box of await page
          .locator("input[name=completed_tasks]")
          .all())
          await box.check();
      },
    );
    await save();
    await scene(
      "8. Report an issue and notify admins",
      "Use Report a problem for blocked access, equipment, weather or safety issues. Describe the problem and choose its urgency. Saving creates an issue and in-app notifications. Email delivery uses the configured recipients and dispatcher. Immediate danger needs a direct call.",
      async () => {
        await act("field-report");
        await page
          .locator("#description")
          .fill("Training issue: temporary equipment blocking the entrance.");
        await page.locator("#urgency").selectOption("urgent");
      },
    );
    await save();
    await page
      .getByRole("heading", { name: "Issue reported", exact: true })
      .waitFor();
    await close();
    await scene(
      "9. Attach pictures to the issue",
      "Open the evidence uploader, choose Issue evidence and select the related issue. Take a clear picture or choose files. You can add several pictures. Management can open the issue and its evidence inside the app.",
      async () => {
        await act("upload");
        await page.locator("#photo-stage").selectOption("issue");
        await page
          .locator("#photo-issue")
          .selectOption(state.field.issues[0].id);
        await page.locator("#start-camera").click();
        await capture();
      },
    );
    await upload();
    await close();
    await scene(
      "10. Add after-work photos",
      "When work is finished, choose After work and take the final pictures. Show the same areas clearly enough for management to compare before and after. Upload and wait for the saved confirmation before leaving the evidence screen.",
      async () => {
        await act("upload");
        await page.locator("#photo-stage").selectOption("after");
        await page.locator("#start-camera").click();
        await capture();
      },
    );
    await upload();
    await close();
    await scene(
      "11. Check out and record breaks",
      "Choose Check out, capture a new current location and enter unpaid break minutes. Save the attendance event. If checkout was missed, record the real current event and explain a corrected claim; never backdate original attendance.",
      async () => {
        await act("clock-out");
        await act("gps");
      },
    );
    await save();
    await scene(
      "12. Submit hours for company review",
      "Choose Submit my hours. Normally keep Use the exact recorded time. A different claim requires a clear reason. All crew members must check out first. Submit, then read the confirmation so you know who reviews the work next.",
      async () => {
        await act("claim");
      },
    );
    await save();
    await page
      .getByRole("heading", {
        name: "Work submitted for company review.",
        exact: true,
      })
      .waitFor();
    await close();
    await scene(
      "13. Track hours, issues and next steps",
      "My hours separates recorded, claimed and accepted time. Your company reviews first, then N P I. Issues shows acknowledgements and resolutions. Alerts shows updates. If a correction is requested, follow the reason, update the permitted information and submit again.",
      () => go("hours"),
    );
    if (
      state.events.length !== 2 ||
      state.evidence.length !== 4 ||
      state.work[0].status !== "contractor-review"
    )
      throw Error("Worker training transaction did not complete correctly");
  } else if (role === "sub") {
    await scene(
      "1. Your company scope",
      "Open your invitation from N P I to create the company administrator account. After signing in, My subcontract shows your permitted contract sites. Ask N P I to add missing responsibilities. Your company manages its own workers and scheduling.",
      () => go("contracts"),
    );
    await scene(
      "2. Invite your workers",
      "Open My team and choose Invite workers. Create the company link and share it privately. Workers register themselves and wait for your approval. The link expires after seven days and allows up to one hundred registrations.",
      async () => {
        await go("people");
        await act("new-invitation");
      },
    );
    await save();
    await page
      .getByRole("heading", { name: "Share invitation link", exact: true })
      .waitFor();
    await close();
    await scene(
      "3. Approve genuine worker accounts",
      "Check Pending workers and verify who belongs to your company. Approve genuine registrations or reject unknown people. This grants account access only. Work hours still need a separate review. Reset passwords or pause access from the account register when needed.",
      async () => {
        await go("people");
        await act("access-approve_worker");
      },
    );
    await save();
    await scene(
      "4. Assign work to your team",
      "Create a work order. Choose the permitted contract site and service. Enter the work area, instructions, date, equipment and checklist. Select the approved company workers. Save the assignment; N P I can see who assigned it and every team member.",
      async () => {
        await go("work");
        await act("new-work");
        await page
          .locator("#title")
          .fill("Clear entrance and pedestrian route");
        await page.locator("#area").fill("Main entrance and sidewalks");
        await page.locator("#planned_date").fill("2026-11-20");
        await page.locator("#equipment").fill("Loader");
        await page.locator("input[name=members]").first().check();
      },
    );
    await close();
    await scene(
      "5. Repeat work and preserve history",
      "For regular jobs, use Repeat assignment. Choose the first date, interval and number of copies. Review the schedule before creating it. Unstarted crew changes need a reason. After work starts, preserve the crew and create a separate job for additional workers.",
      async () => {
        await act("open-work");
        await act("field-repeat");
        await page.locator("#first_date").fill("2026-11-27");
      },
    );
    await close();
    await scene(
      "6. Configure your notification emails",
      "In Settings, enter your company recipients and the urgent acknowledgement deadline. N P I has its own recipient list. Send a test email and check the email queue. Queued is not sent; delivery needs the configured sender and scheduled dispatcher.",
      async () => {
        await go("settings");
        await act("field-settings");
        await page
          .locator("#emails")
          .fill("company.admin@example.test\noperations@example.test");
      },
    );
    await save();
    await scene(
      "7. Acknowledge and resolve issues",
      "Open the issue, acknowledge it and choose a responsible administrator. Add comments as work progresses. A resolution needs an explanation. Urgent issues that remain open are escalated by the dispatcher. The reporter can see the status and resolution.",
      async () => {
        await go("issues");
        await act("field-issue");
        await page.locator("#status").selectOption("resolved");
        await page.locator("#owner_id").selectOption(u.sub);
        await page
          .locator("#resolution")
          .fill(
            "Training resolution: obstruction removed and access restored.",
          );
      },
    );
    await save();
    await scene(
      "8. Inspect workers, attendance and photos",
      "Open submitted work. Compare each worker’s recorded and claimed time. Inspect both G P S events, accuracy, checklist and outcome. Scroll to compare Before, Progress, After and Issue evidence. Clicking a photo opens a viewing copy and its unchanged original.",
      async () => {
        await go("work");
        await act("open-work");
        await page
          .getByRole("heading", {
            name: "Photo & document gallery",
            exact: true,
          })
          .evaluate((el) => el.scrollIntoView({ block: "start" }));
      },
    );
    await scene(
      "9. Forward verified work to NPI",
      "Choose Approve and forward to N P I only after checking the record. Incomplete work or an evidence exception requires explicit acknowledgement. If anything needs correction, return it with a specific reason instead.",
      async () => {
        await page.evaluate(() => scrollTo(0, 0));
        await act("company-approve");
      },
    );
    await save();
    await page
      .getByRole("heading", { name: "Work forwarded to NPI.", exact: true })
      .waitFor();
    await close();
    await scene(
      "10. Daily reports and access controls",
      "Check activity and exceptions for overdue work, long open shifts, location concerns and hour differences. Filter reports by date, company or site and export the loaded records. Use the paginated work register to find older jobs. Sign out on shared devices.",
      () => go("reports"),
    );
  } else {
    await scene(
      "1. Monitor all subcontractors",
      "The overview shows activity and review stages. N P I can inspect every permitted company, assignment and worker. Subcontractors manage their daily scheduling; N P I monitors evidence and verifies the work.",
      () => go("overview"),
    );
    await scene(
      "2. Set up company and contract responsibility",
      "Add the subcontractor company, locations and services first. Register the main contract and assign its sites to that company. Repeat for future subcontractors. No rates or invoices are included in this operations release.",
      async () => {
        await go("contracts");
        await act("new-scope");
      },
    );
    await close();
    await scene(
      "3. Invite the subcontractor administrator",
      "Invite the company administrator from People and access. Select the correct company and create its single-use, seven-day link. Share it privately. The administrator chooses their credentials and invites their own workers; N P I does not need to know the workers first.",
      async () => {
        await go("people");
        await act("new-invitation");
      },
    );
    await close();
    await scene(
      "4. Configure locations and evidence rules",
      "Locations shows the supplied building pictures and verified addresses. Add access instructions, hazards and optional site coordinates for advisory G P S checks. In Settings, configure whether each service needs before and after pictures on new assignments.",
      async () => {
        await go("sites");
        await page.waitForTimeout(700);
        await go("settings");
        await act("field-policy");
      },
    );
    await scene(
      "5. See who assigned each worker",
      "Work orders is the shared register. Filter by contract, company, site, worker, date or status. Every card shows the assignment creator and team. Open a record to inspect each worker’s attendance and the assignment history.",
      () => go("work"),
    );
    await scene(
      "6. Inspect the original attendance",
      "Compare recorded, claimed and accepted hours separately. Inspect check in and checkout times, captured positions and accuracy. A map link opens the recorded coordinates. Location flags need investigation; they do not automatically prove that work was invalid.",
      async () => {
        await act("open-work");
        await page
          .getByRole("heading", { name: "Attendance evidence", exact: true })
          .evaluate((el) => el.scrollIntoView({ block: "start" }));
      },
    );
    await scene(
      "7. Compare before and after evidence",
      "The grouped gallery shows the worker’s before, after and issue pictures from this training transaction. Check who uploaded each file and the server upload time. Capture or preparation stamps are device-reported. Open the unchanged original when needed.",
      async () => {
        await page
          .getByRole("heading", {
            name: "Photo & document gallery",
            exact: true,
          })
          .evaluate((el) => el.scrollIntoView({ block: "start" }));
        await act("field-file");
      },
    );
    await close();
    await scene(
      "8. Accept or return the work",
      "After company approval, choose Verify and accept hours. Keep exact claimed hours or explain any adjustment. Review incomplete outcomes and evidence exceptions explicitly. If information is missing, return the work with a useful correction reason.",
      async () => {
        await page.evaluate(() => scrollTo(0, 0));
        await act("npi-approve");
      },
    );
    await save();
    await page
      .getByRole("heading", {
        name: "Work verified and hours accepted.",
        exact: true,
      })
      .waitFor();
    await close();
    await scene(
      "9. Configure NPI email recipients",
      "Settings contains N P I’s own recipient list and urgent acknowledgement deadline. Each company maintains its recipients separately. Test delivery after the owner configures the verified sender. The queue distinguishes queued, retry, failed and accepted-by-provider states.",
      async () => {
        await go("settings");
        await act("field-settings");
      },
    );
    await close();
    await scene(
      "10. Review notifications and issues",
      "Alerts shows assignments, issue reports and review updates. Issues tracks responsibility, comments and resolution. Both N P I and the relevant company receive issue notices. Private photos stay behind sign-in and are not attached publicly to email.",
      () => go("issues"),
    );
    await scene(
      "11. Review spreadsheet planning changes",
      "The compact management workbook has seven tabs. Operational records mirror from Supabase. Permitted planning and site edits return as proposals for N P I review. Check the values and version before accepting. Original attendance, evidence and approvals remain protected.",
      () => go("sheets"),
    );
    await scene(
      "12. Use reports and complete the rollout",
      "Activity reports highlight exceptions and export the loaded records. The work register searches older records with pages. Before rollout, apply the backend upgrade, configure email delivery and workbook triggers, deploy the frontend and complete a real phone acceptance test.",
      () => go("reports"),
    );
    if (
      state.work[0].status !== "approved" ||
      state.reviews[0].accepted_minutes !== 105
    )
      throw Error("Training approvals did not complete");
  }
  await page.waitForTimeout(500);
  const video = page.video();
  await context.close();
  await fs.rename(await video.path(), root + "/" + role + "-screen.webm");
  stories.push({ role, mobile, scenes });
  await fs.writeFile(root + "/stories.json", JSON.stringify(stories, null, 2));
  await fs.writeFile(
    root + "/fixture.json",
    JSON.stringify({
      state: sharedState,
      files: [...sharedFiles].map(([path, file]) => ({
        path,
        type: file.type,
        base64: file.bytes.toString("base64"),
      })),
    }),
  );
}
await browser.close();
stories.sort(
  (a, b) =>
    ["npi", "sub", "worker"].indexOf(a.role) -
    ["npi", "sub", "worker"].indexOf(b.role),
);
await fs.writeFile(root + "/stories.json", JSON.stringify(stories, null, 2));
await fs.writeFile(
  root + "/transaction.json",
  JSON.stringify(
    {
      status: sharedState.work[0].status,
      evidence: sharedState.evidence.map((e) => ({
        stage: e.stage,
        source: e.source,
        has_preview: !!e.preview_path,
      })),
      events: sharedState.events.length,
      accepted_minutes: sharedState.reviews[0].accepted_minutes,
      issue_status: sharedState.field.issues[0].status,
    },
    null,
    2,
  ),
);
