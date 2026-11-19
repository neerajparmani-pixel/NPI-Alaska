import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { backend } from "../helpers/live-fixture.js";
test.use({
  launchOptions: {
    executablePath: "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});
const act = (p, a) => p.locator(`[data-action="${a}"]:visible`).first().click();
async function login(p, user = "alex") {
  await p.goto("/live/");
  await p.locator("#username").fill(user);
  await p.locator("#password").fill("fictional-pass-123");
  await p.locator("#login-form button[type=submit]").click();
  await expect(p.locator(".live-connection")).toBeVisible();
}
async function picture(p) {
  return Buffer.from(
    await p.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 80;
      c.height = 80;
      const x = c.getContext("2d");
      x.fillStyle = "navy";
      x.fillRect(0, 0, 80, 80);
      return c.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
}
test("multi-photo originals and stamped copies save once, with retry of only failed items", async ({
  page,
}) => {
  const { state } = await backend(page);
  state.work[0].status = "in-progress";
  await login(page);
  await act(page, "open-work");
  await act(page, "upload");
  const buffer = await picture(page);
  await page.locator("#multi-files").setInputFiles([
    { name: "before-1.png", mimeType: "image/png", buffer },
    { name: "before-2.png", mimeType: "image/png", buffer },
  ]);
  await expect(page.locator(".photo-card")).toHaveCount(2);
  let failed = false;
  await page.route("**/storage/v1/object/work-evidence/**", async (route) => {
    if (!failed) {
      failed = true;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Temporary upload failure" }),
      });
    } else await route.fallback();
  });
  await page.locator("#upload-batch").click();
  await expect(page.locator("#photo-status")).toContainText("1 failed");
  expect(state.evidence).toHaveLength(1);
  await page.locator("#upload-batch").click();
  await expect(page.locator("#photo-status")).toContainText(
    "saved successfully",
  );
  expect(state.evidence).toHaveLength(2);
  expect(new Set(state.evidence.map((e) => e.path)).size).toBe(2);
  expect(
    state.evidence.every(
      (e) =>
        e.preview_path &&
        e.stage === "before" &&
        e.source === "file" &&
        !e.captured_at,
    ),
  ).toBe(true);
});
test("issue notification settings, issue creation and resolution keep company context", async ({
  page,
}) => {
  const { state } = await backend(page);
  await login(page, "supervisor");
  await page.goto("/live/#settings");
  await act(page, "field-settings");
  await page
    .locator("#emails")
    .fill("manager@example.test\noperations@example.test");
  await page.locator("#action-form button[type=submit]").click();
  await expect(page.locator("#success-toast")).toContainText("saved");
  expect(state.field.settings[0].emails).toHaveLength(2);
  await page.goto("/live/#work");
  await act(page, "open-work");
  await act(page, "field-report");
  await page.locator("#description").fill("Entrance blocked by equipment");
  await page.locator("#urgency").selectOption("urgent");
  await page.locator("#action-form button[type=submit]").click();
  await expect(
    page.getByRole("heading", { name: "Issue reported", exact: true }),
  ).toBeVisible();
  await act(page, "close");
  await page.goto("/live/#issues");
  await act(page, "field-issue");
  await page.locator("#status").selectOption("resolved");
  await page.locator("#resolution").fill("Equipment moved; access restored");
  await page.locator("#action-form button[type=submit]").click();
  await expect(page.getByText("urgent · resolved")).toBeVisible();
});
test("new worker evidence and issue screens are accessible and fit a narrow viewport", async ({
  page,
}) => {
  const { state } = await backend(page);
  state.work[0].status = "in-progress";
  await login(page);
  await act(page, "open-work");
  await act(page, "upload");
  const a = await new AxeBuilder({ page }).analyze();
  expect(a.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await act(page, "close");
  await act(page, "field-report");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("same-user sign-in resumes the photo queue after expiry without duplicating original uploads", async ({
  page,
}) => {
  const { state } = await backend(page);
  state.work[0].status = "in-progress";
  await login(page);
  await act(page, "open-work");
  await act(page, "upload");
  await page.locator("#multi-files").setInputFiles({
    name: "recover.png",
    mimeType: "image/png",
    buffer: await picture(page),
  });
  await expect(page.locator(".photo-card")).toHaveCount(1);
  state.expireFieldNext = true;
  await page.locator("#upload-batch").click();
  await expect(page.locator("#login-form")).toBeVisible();
  await page.locator("#username").fill("alex");
  await page.locator("#password").fill("fictional-pass-123");
  await page.locator("#login-form button[type=submit]").click();
  await expect(page.locator("#photo-uploader")).toBeVisible();
  await expect(page.locator(".photo-card")).toHaveCount(1);
  await page.locator("#upload-batch").click();
  await expect(page.locator("#photo-status")).toContainText(
    "saved successfully",
  );
  expect(state.evidence).toHaveLength(1);
});
test("photo drafts are never restored for a different signed-in account", async ({
  page,
}) => {
  const { state } = await backend(page);
  state.work[0].status = "in-progress";
  await login(page);
  await act(page, "open-work");
  await act(page, "upload");
  await page.locator("#multi-files").setInputFiles({
    name: "private-draft.png",
    mimeType: "image/png",
    buffer: await picture(page),
  });
  state.expireFieldNext = true;
  await page.locator("#upload-batch").click();
  await expect(page.locator("#login-form")).toBeVisible();
  await page.locator("#username").fill("owner@npi.test");
  await page.locator("#password").fill("fictional-pass-123");
  await page.locator("#login-form button[type=submit]").click();
  await expect(page.locator(".live-connection")).toBeVisible();
  await expect(page.locator("#photo-uploader")).toHaveCount(0);
  await expect(page.getByText("private-draft.png")).toHaveCount(0);
});
test("camera captures multiple photos one at a time, supports retake and stops after closing", async ({
  page,
  context,
}) => {
  const { state, storedFiles } = await backend(page);
  state.work[0].status = "in-progress";
  await context.grantPermissions(["camera"]);
  await login(page);
  await act(page, "open-work");
  await act(page, "upload");
  await page.locator("#start-camera").click();
  await page.waitForFunction(
    () => document.querySelector("#camera-feed").videoWidth > 0,
  );
  await page.locator("#capture-photo").click();
  await page.locator("#retake-photo").click();
  await expect(page.locator(".photo-card")).toHaveCount(0);
  for (let n = 1; n <= 2; n++) {
    await page.waitForFunction(
      () => document.querySelector("#camera-feed").videoWidth > 0,
    );
    await page.locator("#capture-photo").click();
    await page.locator("#keep-photo").click();
    await expect(page.locator(".photo-card")).toHaveCount(n);
  }
  await page.locator("#stop-camera").click();
  expect(await page.locator("#camera-feed").evaluate((v) => v.srcObject)).toBe(
    null,
  );
  await page.locator("#upload-batch").click();
  await expect(page.locator("#photo-status")).toContainText(
    "saved successfully",
  );
  expect(state.evidence).toHaveLength(2);
  expect(
    state.evidence.every((e) => e.source === "app-camera" && e.captured_at),
  ).toBe(true);
  expect(storedFiles.size).toBe(4);
});
test("issue edits require save or explicit discard before switching to a comment", async ({
  page,
}) => {
  const { state } = await backend(page);
  state.field = {
    issues: [
      {
        id: crypto.randomUUID(),
        work_id: state.work[0].id,
        category: "access",
        urgency: "normal",
        description: "Blocked entrance",
        status: "open",
        version: 1,
        created_at: new Date().toISOString(),
      },
    ],
    comments: [],
    history: [],
    notifications: [],
    email_status: [],
    settings: [],
  };
  await login(page, "supervisor");
  await page.goto("/live/#issues");
  await act(page, "field-issue");
  await page.locator("#resolution").fill("Unsaved resolution");
  await act(page, "field-comment");
  await expect(page.locator("#resolution")).toHaveValue("Unsaved resolution");
  await expect(page.locator("#dialog-error")).toContainText("Unsaved changes");
  await act(page, "discard");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
