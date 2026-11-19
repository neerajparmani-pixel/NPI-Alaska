// Actual frontend recording; intercepted, fictional backend. Never contacts production.
import { chromium } from "playwright";
import { backend, u } from "../tests/helpers/live-fixture.js";
import fs from "node:fs/promises";
const root = "docs/training";
await fs.mkdir(root, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const stories = [];
for (const role of process.env.TRAINING_ROLE
  ? [process.env.TRAINING_ROLE]
  : ["npi", "sub", "worker"]) {
  const mobile = role === "worker";
  const context = await browser.newContext({
    viewport: { width: mobile ? 390 : 1280, height: mobile ? 844 : 720 },
    recordVideo: {
      dir: root + "/raw",
      size: { width: mobile ? 390 : 1280, height: mobile ? 844 : 720 },
    },
    permissions: ["geolocation"],
    geolocation: { latitude: 61.2181, longitude: -149.8923, accuracy: 12 },
  });
  const page = await context.newPage();
  const { state } = await backend(page);
  state.companies[0].name = "Example subcontractor";
  state.sites[0].address = "Training address — confirm the actual site address";
  state.people.find((p) => p.id === u.worker).display_name = "Alex Morgan";
  state.people.find((p) => p.id === u.sub).display_name =
    "Company Administrator";
  state.people.find((p) => p.id === u.npi).display_name = "NPI Administrator";
  state.contracts = [
    {
      id: "60000000-0000-0000-0000-000000000001",
      name: "Example court services",
      client: "Example customer",
      reference: "TRAINING",
      active: true,
    },
  ];
  state.scopes = [
    {
      id: "70000000-0000-0000-0000-000000000001",
      contract_id: state.contracts[0].id,
      company_id: state.companies[0].id,
      site_id: state.sites[0].id,
      active: true,
    },
  ];
  if (role !== "worker") {
    state.work[0].status = role === "npi" ? "npi-review" : "contractor-review";
    state.work[0].completed_tasks = [0, 1];
    state.reviews[0].recorded_minutes = 105;
    state.reviews[0].claimed_minutes = 105;
    for (const [kind, time] of [
      ["check-in", "2026-11-18T16:30:00Z"],
      ["check-out", "2026-11-18T18:15:00Z"],
    ])
      state.events.push({
        id: crypto.randomUUID(),
        work_id: state.work[0].id,
        worker_id: u.worker,
        captured_by: u.worker,
        event_kind: kind,
        device_time: time,
        received_at: time,
        latitude: 61.2181,
        longitude: -149.8923,
        accuracy_metres: 12,
      });
  }
  await page.goto("http://127.0.0.1:5173/live/");
  const start = Date.now();
  const scenes = [];
  async function scene(title, text, action) {
    const t = (Date.now() - start) / 1000;
    await action();
    await page.waitForTimeout(850);
    scenes.push({ title, text, start: t, end: (Date.now() - start) / 1000 });
    console.log(role, title);
  }
  async function go(hash) {
    await page.goto("http://127.0.0.1:5173/live/#" + hash);
    await page.waitForTimeout(350);
  }
  async function act(a) {
    await page.locator(`[data-action="${a}"]:visible`).first().click();
  }
  async function close() {
    await act("close");
    if (await page.locator("[data-action=discard]:visible").count())
      await act("discard");
  }
  async function scroll() {
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }),
    );
    await page.waitForTimeout(600);
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
  async function save() {
    await page.locator("#action-form button[type=submit]").click();
    await page.waitForTimeout(550);
  }
  await scene(
    "Sign in to your workspace",
    "This is a recording of the running app with fictional training records. Cloud responses and G P S are simulated. Sign in using your company username and password. Never share your password.",
    login,
  );
  if (role === "npi") {
    await scene(
      "1. Review the overview",
      "N P I oversees every subcontractor. Check active work, company reviews and work waiting for verification. Start by setting up the company, locations, services and contract before inviting its administrator.",
      () => go("overview"),
    );
    await scene(
      "2. Add a subcontractor",
      "Open Companies and choose Add company. Enter the subcontractor business name and save. Repeat for future subcontractors. You do not need to create their worker accounts.",
      async () => {
        await go("companies");
        await act("new-company");
        await page.locator("#name").fill("Example Alaska subcontractor");
      },
    );
    await close();
    await scene(
      "3. Add locations and pictures",
      "Open Locations and Add location. Enter the site name and a verified street address. Select the matching bundled photograph, then save. Site pictures identify the building; they are not evidence that work was completed.",
      async () => {
        await go("sites");
        await act("new-site");
        await page.locator("#name").fill("Example courthouse");
        await page
          .locator("#address")
          .fill("Enter the verified street address");
        await page.locator("#photo_path").selectOption("boney");
      },
    );
    await close();
    await scene(
      "4. Set up service types",
      "In Settings, use Add service to define the work your companies can assign, such as snow clearing or hauling. Enter a clear name and description. Billing and prices are deliberately excluded from this release.",
      async () => {
        await go("settings");
        await act("new-task");
        await page.locator("#name").fill("Example snow clearing");
      },
    );
    await close();
    await scene(
      "5. Register the main contract",
      "Open Contracts and add the contract name, customer and optional reference. These details organise responsibility. Do not enter confidential contract documents or prices into these descriptive fields.",
      async () => {
        await go("contracts");
        await act("new-contract");
        await page.locator("#name").fill("Example court services");
        await page.locator("#client").fill("Example customer");
      },
    );
    await close();
    await scene(
      "6. Assign contract sites",
      "Choose Assign site to subcontractor. Select the contract, company and location. Save each permitted combination. These assignments control where a company may schedule its workers.",
      async () => {
        await act("new-scope");
      },
    );
    await close();
    await scene(
      "7. Invite the company administrator",
      "Open People and access and invite a subcontractor administrator. Select the company and create its invitation link. Share the link privately. It is single use and expires after seven days. The administrator chooses their own credentials.",
      async () => {
        await go("people");
        await act("new-invitation");
      },
    );
    await close();
    await scene(
      "8. Monitor accounts and access",
      "Review the account register. The company administrator approves their own worker registrations. N P I can oversee accounts, reset company access or pause access when needed. Pausing access preserves original work records.",
      async () => {
        await scroll();
      },
    );
    await scene(
      "9. Inspect attendance and hours",
      "Open a work order waiting for N P I. Compare recorded time with the worker claim. Read both check in and checkout timestamps. Each location link opens the captured coordinates on a map. Check accuracy and the assigned site address.",
      async () => {
        await go("work");
        await act("open-work");
        await scroll();
      },
    );
    await scene(
      "10. Verify or return work",
      "Check completed tasks and open uploaded evidence. Choose Verify and accept hours only when satisfied. Keep exact claimed time, or explain a manual adjustment. To return a record, close this form and choose Return to company with a clear correction reason.",
      async () => {
        await page.evaluate(() => window.scrollTo(0, 0));
        await act("npi-approve");
      },
    );
    await close();
    await scene(
      "11. Review spreadsheet changes",
      "Spreadsheet review shows proposed management changes. Check the values and version before accepting or rejecting. Original attendance remains protected. The spreadsheet is a management table view; it is not the same interface as the app.",
      () => go("sheets"),
    );
    await scene(
      "12. Daily operating routine",
      "Check the overview, review submitted work, and refresh after changes. Repeat company and site setup for future subcontractors. All working times use the Anchorage timezone. Sign out when finished on a shared device.",
      () => go("overview"),
    );
  } else if (role === "sub") {
    await scene(
      "1. Your invitation and company scope",
      "First open the administrator invitation from N P I and choose your own username and password. After signing in, your company workspace shows only its permitted work. Ask N P I to correct missing contract sites.",
      () => go("contracts"),
    );
    await scene(
      "2. Invite your workers",
      "Open My team and choose Invite workers. Create the company link and share it privately with your team. The link expires after seven days and permits up to one hundred registrations. Workers enter their own details.",
      async () => {
        await go("people");
        await act("new-invitation");
      },
    );
    await close();
    await scene(
      "3. Approve worker accounts",
      "New registrations appear under Pending workers. Verify each person belongs to your company, then approve or reject. Account approval grants access; it does not approve their work hours.",
      async () => {
        state.people.find((p) => p.id === u.worker).account_status = "pending";
        await act("refresh");
        await act("access-approve_worker");
      },
    );
    await close();
    state.people.find((p) => p.id === u.worker).account_status = "approved";
    await scene(
      "4. Create a work assignment",
      "Open Work orders and create an assignment. Choose a permitted contract site and service. Enter instructions, date and equipment. Select approved workers from your company and add a practical checklist, then save.",
      async () => {
        await go("work");
        await act("new-work");
        await page.locator("#title").fill("Clear the assigned access route");
        await page.locator("#planned_date").fill("2026-11-20");
      },
    );
    await close();
    await scene(
      "5. Individual and crew work",
      "Select all workers assigned to a crew job. Workers can capture attendance for the assigned crew, but each person keeps their own recorded and claimed time. Hauling assignments additionally record whole loads and a timecard.",
      () => go("work"),
    );
    await scene(
      "6. Monitor progress",
      "Use the overview and work orders to see activity and work waiting for company review. Refresh for updated records. An assignment reference photo identifies the site; workers must upload actual work evidence separately.",
      () => go("overview"),
    );
    await scene(
      "7. Review attendance and evidence",
      "Open submitted work. Compare recorded hours with each worker claim. Inspect both G P S events, accuracy, tasks and uploaded photos or timecards. Click a coordinate link to inspect that captured position on a map.",
      async () => {
        await go("work");
        await act("open-work");
        await scroll();
      },
    );
    await scene(
      "8. Forward verified work to NPI",
      "If the record is correct, choose Approve and forward to N P I, then confirm. Your review is the first approval stage. N P I performs the final verification of the original evidence and hours.",
      async () => {
        await page.evaluate(() => window.scrollTo(0, 0));
        await act("company-approve");
      },
    );
    await close();
    await scene(
      "9. Request a correction",
      "If work or hours need clarification, use Request correction and enter a specific reason. The worker corrects the claim or evidence and submits again. Never rewrite original G P S attendance to make a claim match.",
      async () => {
        await act("return");
        await page
          .locator("#reason")
          .fill(
            "Please clarify the difference between recorded and claimed hours.",
          );
      },
    );
    await close();
    await scene(
      "10. Manage team access",
      "In My team you can reset a worker password, pause access or restore access. Disable unused invitation links to stop new registrations. Share replacement passwords privately. Existing work records remain available for review.",
      async () => {
        await go("people");
        await scroll();
      },
    );
    await scene(
      "11. Settings and daily close",
      "Settings shows your company identity, timezone and available services. Ask N P I for additional sites or service types. Finish by checking work waiting for review and sign out on shared devices. Invoices will be added in a future release.",
      () => go("settings"),
    );
  } else {
    await scene(
      "1. Register from your company link",
      "Before your first shift, open the invitation sent by your subcontractor administrator. Enter your own name, username and a strong password. Company and role come from the invitation. Wait for company approval, then sign in.",
      async () => {
        await act("logout");
        await go("join=" + "a".repeat(64));
        await page.locator("#registration-form").waitFor();
      },
    );
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await login();
    await scene(
      "2. Find your assignment",
      "My work shows the jobs assigned to you. Check the site photograph, location, work instructions and equipment. Open View assignment before starting. If the job or location is wrong, contact your company administrator.",
      () => go("work"),
    );
    await scene(
      "3. Check in with a fresh location",
      "Open the assignment and choose Check in. Select the correct assigned crew members. Tap Capture current location and allow precise location on your phone. Save only after capture succeeds. This recording uses simulated coordinates.",
      async () => {
        await act("open-work");
        await act("clock-in");
        await act("gps");
        await page.waitForTimeout(500);
      },
    );
    await save();
    await scene(
      "4. Complete the task checklist",
      "During the job, choose Update tasks and loads. Tick only work actually completed, then save. For a hauling job, enter completed whole loads. Keep the assignment instructions in view and report problems to your administrator.",
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
      "5. Upload your work evidence",
      "Choose Upload evidence. Select Work photo and choose a clear picture of the actual work. Hauling work also needs the requested timecard. Supported files are images or P D F, up to eight megabytes. Do not substitute the site reference photograph. This demonstration file is labelled training only.",
      async () => {
        await act("upload");
        const png = await page.evaluate(() => {
          const c = document.createElement("canvas");
          c.width = 800;
          c.height = 500;
          const x = c.getContext("2d");
          x.fillStyle = "#f4f7fb";
          x.fillRect(0, 0, 800, 500);
          x.fillStyle = "#172f47";
          x.font = "bold 35px sans-serif";
          x.fillText("TRAINING ONLY", 50, 180);
          x.fillText("NOT FIELD EVIDENCE", 50, 250);
          return c.toDataURL("image/png").split(",")[1];
        });
        await page.locator("#file").setInputFiles({
          name: "training-only-not-field-evidence.png",
          mimeType: "image/png",
          buffer: Buffer.from(png, "base64"),
        });
      },
    );
    await save();
    await scene(
      "6. Check out with a new location",
      "When the job is finished, choose Check out and capture your location again. Enter any unpaid break minutes, then save. A check in position cannot replace a new checkout capture. If location fails, enable permission and retry.",
      async () => {
        await act("clock-out");
        await act("gps");
        await page.waitForTimeout(500);
      },
    );
    await save();
    await scene(
      "7. Submit your hours",
      "After all crew members check out, select Submit my hours. Usually keep Use the exact recorded time. If you need a different claim, untick it, enter the claimed hours and explain why. Submit for your company administrator to review.",
      async () => {
        await act("claim");
      },
    );
    await save();
    await scene(
      "8. Track review and accepted time",
      "Open My hours to see recorded, claimed and accepted time separately. Your company checks first, then N P I verifies. A submitted claim is not final approval. Return to the work record if a correction is requested and follow the written reason.",
      () => go("hours"),
    );
    await scene(
      "9. Site information and help",
      "Locations shows site names, photographs and addresses. Map links in attendance show the captured check in or checkout position. Contact your company administrator for assignments, approval or password help. Sign out on shared phones.",
      () => go("sites"),
    );
  }
  if (role === "worker") {
    if (
      state.events.length !== 2 ||
      state.events[0].event_kind !== "check-in" ||
      state.events[1].event_kind !== "check-out" ||
      !state.evidence.length ||
      state.work[0].completed_tasks.length !== 2 ||
      state.work[0].status !== "contractor-review"
    )
      throw new Error(
        "Worker training transaction did not reach company review",
      );
  }
  await page.waitForTimeout(500);
  const video = page.video();
  await context.close();
  const path = await video.path();
  await fs.rename(path, root + "/" + role + "-screen.webm");
  stories.push({ role, mobile, scenes });
}
await browser.close();
if (process.env.TRAINING_ROLE) {
  const old = JSON.parse(await fs.readFile(root + "/stories.json", "utf8"));
  for (const story of stories) {
    old[old.findIndex((x) => x.role === story.role)] = story;
  }
  await fs.writeFile(root + "/stories.json", JSON.stringify(old, null, 2));
} else
  await fs.writeFile(root + "/stories.json", JSON.stringify(stories, null, 2));
