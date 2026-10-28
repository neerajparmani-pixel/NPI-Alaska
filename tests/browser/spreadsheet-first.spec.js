import { test, expect } from "@playwright/test";
import { spreadsheetTest } from "../helpers/sheets-mock.js";
test("spreadsheet frontend completes real backend workflow with mocked Google services", async ({
  page,
}) => {
  const app = spreadsheetTest();
  await page.exposeFunction("_npiApi", (payload) =>
    JSON.parse(JSON.stringify(app.api(payload))),
  );
  await page.addInitScript(() => {
    function runner(success, failure) {
      return {
        withSuccessHandler: (cb) => runner(cb, failure),
        withFailureHandler: (cb) => runner(success, cb),
        npiTestApi: (payload) =>
          window
            ._npiApi(payload)
            .then(success, (error) => failure({ message: error.message })),
      };
    }
    window.google = { script: { run: runner() } };
  });
  await page.goto("/spreadsheet-first/Index.html");
  await expect(page.getByRole("heading", { name: "My work" })).toBeVisible();
  await page.locator("#view").selectOption("supervisor");
  await page
    .getByRole("button", { name: "Create assignment", exact: true })
    .click();
  await page.getByLabel("Work area", { exact: true }).fill("Test parking lot");
  await page.getByLabel("Worker name").fill("Alex (sample)");
  await page.getByLabel("Equipment", { exact: true }).fill("Plow truck");
  await page
    .getByRole("button", { name: "Create assignment", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Work summary" }),
  ).toBeVisible();
  await page.locator("#view").selectOption("worker");
  await page.getByRole("button", { name: "Open work" }).click();
  await page.getByRole("button", { name: "Start work", exact: true }).click();
  await expect(page.getByLabel("Plowing", { exact: true })).toBeEnabled();
  await page.getByLabel("Plowing", { exact: true }).check();
  await page.locator("#photo").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/H0AAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expect(page.locator(".photo a")).toContainText("photo.png");
  await expect(
    page.getByRole("button", { name: "Submit work for review" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Submit work for review" }).click();
  await expect(page.locator(".badge")).toHaveText("Submitted");
  await page.locator("#view").selectOption("supervisor");
  await page.getByRole("button", { name: "Review work", exact: true }).click();
  await page
    .getByLabel("Correction instructions")
    .fill("Add a note about the sidewalk");
  await page.getByRole("button", { name: "Request correction" }).click();
  await expect(page.locator(".badge")).toHaveText("Correction requested");
  await page.locator("#view").selectOption("worker");
  await page.getByRole("button", { name: "Open work" }).click();
  await page.getByLabel("Work notes").fill("Sidewalk complete");
  await page.getByRole("button", { name: "Submit work for review" }).click();
  await expect(page.locator(".badge")).toHaveText("Submitted");
  await page.locator("#view").selectOption("supervisor");
  await page.getByRole("button", { name: "Review work", exact: true }).click();
  await page.getByRole("button", { name: "Approve work", exact: true }).click();
  await expect(page.locator(".badge")).toHaveText("Approved");
  expect(app.api({ action: "list" }).jobs[0].status).toBe("Approved");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("unsaved worker edits are not shown as saved review data and refresh requires confirmation", async ({
  page,
}) => {
  const app = spreadsheetTest();
  const create = app.api({
    action: "create",
    requestId: "test-create-00000000001",
    data: {
      site: "Courthouse",
      area: "Sample area",
      worker: "Alex (sample)",
      equipment: "Plow",
    },
  }).job;
  app.api({
    action: "start",
    id: create.id,
    version: create.version,
    requestId: "test-start-00000000001",
  });
  await page.exposeFunction("_npiApi", (payload) =>
    JSON.parse(JSON.stringify(app.api(payload))),
  );
  await page.addInitScript(() => {
    function runner(success, failure) {
      return {
        withSuccessHandler: (cb) => runner(cb, failure),
        withFailureHandler: (cb) => runner(success, cb),
        npiTestApi: (payload) =>
          window
            ._npiApi(payload)
            .then(success, (error) => failure({ message: error.message })),
      };
    }
    window.google = { script: { run: runner() } };
  });
  await page.goto("/spreadsheet-first/Index.html");
  await page.getByRole("button", { name: "Open work" }).click();
  await page.getByLabel("Work notes").fill("Unsaved local note");
  await page.locator("#view").selectOption("management");
  await page.getByRole("button", { name: "Open work" }).click();
  await expect(page.getByLabel("Work notes")).toHaveValue("");
  await expect(page.getByLabel("Work notes")).toHaveAttribute("readonly", "");
  await page.locator("#view").selectOption("worker");
  await page.getByRole("button", { name: "Open work" }).click();
  await expect(page.getByLabel("Work notes")).toHaveValue("Unsaved local note");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Work notes")).toHaveValue("Unsaved local note");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard drafts and refresh" })
    .click();
  await expect(page.getByLabel("Work notes")).toHaveValue("");
});

test("settings exposes backend tabs, saves workspace details and keeps unconnected login actions disabled", async ({
  page,
}, testInfo) => {
  const app = spreadsheetTest();
  await page.exposeFunction("_npiApi", (payload) =>
    JSON.parse(JSON.stringify(app.api(payload))),
  );
  await page.addInitScript(() => {
    function runner(success, failure) {
      return {
        withSuccessHandler: (cb) => runner(cb, failure),
        withFailureHandler: (cb) => runner(success, cb),
        npiTestApi: (payload) =>
          window
            ._npiApi(payload)
            .then(success, (error) => failure({ message: error.message })),
      };
    }
    window.google = { script: { run: runner() } };
  });
  await page.goto("/spreadsheet-first/Index.html");
  await expect(page.getByRole("heading", { name: "My work" })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Settings & access" }),
  ).toBeVisible();
  await expect(page.locator(".backend-links a")).toHaveCount(8);
  await expect(
    page.getByRole("button", { name: "Create user", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Reset password", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Account setup requirements" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Company account setup" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByLabel("Workspace name").fill("NPI Alaska Operations");
  await page.getByLabel("Support contact").fill("Contact the site supervisor");
  await page.getByRole("button", { name: "Save workspace settings" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Workspace settings saved." }),
  ).toBeVisible();
  expect(app.api({ action: "settings" }).workspace.name).toBe(
    "NPI Alaska Operations",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: testInfo.outputPath("settings.png"),
    fullPage: true,
  });
});

test("initial connection failures show recovery instead of an indefinite loading page", async ({
  page,
}) => {
  await page.addInitScript(() => {
    function runner(success, failure) {
      return {
        withSuccessHandler: (cb) => runner(cb, failure),
        withFailureHandler: (cb) => runner(success, cb),
        npiTestApi: () =>
          setTimeout(() => failure({ message: "Run setupNpiTest again." }), 0),
      };
    }
    window.google = { script: { run: runner() } };
  });
  await page.goto("/spreadsheet-first/Index.html");
  await expect(
    page.getByRole("heading", { name: "Let’s connect your spreadsheet." }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Run setupNpiTest");
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeEnabled();
});
