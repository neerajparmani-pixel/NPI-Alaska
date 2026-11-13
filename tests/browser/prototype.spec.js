import { test, expect } from "@playwright/test";
const open = async (page) => {
  await page.goto("/sample/");
  await page.evaluate(() => localStorage.removeItem("npi-alaska-clickable-v1"));
  await page.reload();
};
const role = async (page, r) => page.getByLabel("Preview role").selectOption(r);
const click = async (page, action) =>
  page.locator(`[data-action="${action}"]`).first().click();
test("sample: worker validation, submission, supervisor correction, resubmission and approval", async ({
  page,
}) => {
  await open(page);
  await role(page, "Worker");
  await click(page, "start");
  await click(page, "finish");
  await expect(page.getByRole("alert")).toContainText(
    "Complete every checklist task",
  );
  for (const box of await page.locator("[data-task]").all()) await box.check();
  await page
    .getByLabel("Anything to tell your supervisor?")
    .fill("Sample note: entry steps checked.");
  await click(page, "photo");
  await expect(
    page.getByLabel("Anything to tell your supervisor?"),
  ).toHaveValue("Sample note: entry steps checked.");
  await click(page, "finish");
  await click(page, "submit-work");
  await expect(page.getByText("Your work is awaiting review.")).toBeVisible();
  await role(page, "Supervisor");
  await click(page, "open-reviews");
  await page.getByRole("button", { name: "Open AK-1042", exact: true }).click();
  await click(page, "return-work");
  await page.locator("#correction-form button[type=submit]").click();
  await expect(page.locator("#correction-reason-error")).toHaveText(
    "Describe what the worker needs to correct.",
  );
  await page
    .getByLabel("What needs to change?")
    .fill("Check the ramp once more.");
  await page.locator("#correction-form button[type=submit]").click();
  await role(page, "Worker");
  await expect(page.getByText("Check the ramp once more.")).toBeVisible();
  await click(page, "finish");
  await click(page, "submit-work");
  await role(page, "Supervisor");
  await click(page, "open-reviews");
  await page.getByRole("button", { name: "Open AK-1042", exact: true }).click();
  await click(page, "approve");
  await role(page, "Worker");
  await expect(page.getByText("Work approved. Thank you.")).toBeVisible();
  await page.reload();
  await role(page, "Worker");
  await expect(page.getByText("Work approved. Thank you.")).toBeVisible();
});
test("sample: people, assignment and workspace forms validate and persist", async ({
  page,
}) => {
  await open(page);
  await page.goto("/sample/#settings");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await click(page, "new-person");
  await page.getByLabel("Full name", { exact: true }).fill("Test Worker");
  await page.getByLabel("Company username").fill("alex.m");
  await page.locator("#person-form button[type=submit]").click();
  await expect(page.locator("#person-username-error")).toContainText(
    "already in use",
  );
  await page.getByLabel("Company username").fill("test.worker");
  await page.locator("#person-form button[type=submit]").click();
  await expect(page.getByText("test.worker", { exact: true })).toBeVisible();
  await expect(page.locator("input[type=password]")).toHaveCount(0);
  await page
    .locator("[data-action=settings-tab][data-value=workspace]")
    .click();
  await page.getByLabel("Company / workspace name").fill("NPI Test Office");
  await page
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await page.reload();
  await page
    .locator("[data-action=settings-tab][data-value=workspace]")
    .click();
  await expect(page.getByLabel("Company / workspace name")).toHaveValue(
    "NPI Test Office",
  );
  await page.goto("/sample/#assignments");
  await click(page, "new-job");
  await page
    .getByLabel("What needs to be done?")
    .fill("Test morning snow removal");
  await page.locator("#job-form button[type=submit]").click();
  await expect(page.getByText(/Test morning snow removal/)).toBeVisible();
});
test("sample: two-way bridge applies validated edits and resolves stale conflict without overwrite", async ({
  page,
}) => {
  await open(page);
  await page.goto("/sample/#reports");
  await page.locator("[data-action=sheet-edit][data-id=AK-1042]").click();
  await page
    .getByLabel("Assignment title", { exact: true })
    .fill("Title from spreadsheet");
  await page.locator("#sheet-form button[type=submit]").click();
  await click(page, "sync-demo");
  await expect(
    page.getByRole("cell", { name: "Title from spreadsheet", exact: true }),
  ).toBeVisible();
  await page.locator("[data-action=sheet-edit][data-id=AK-1042]").click();
  await page
    .getByLabel("Assignment title", { exact: true })
    .fill("Conflicting sheet title");
  await page.getByLabel("Sync scenario").selectOption("stale");
  await page.locator("#sheet-form button[type=submit]").click();
  await click(page, "sync-demo");
  await expect(
    page.locator("td .badge").filter({ hasText: "Conflict" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Title from spreadsheet", exact: true }),
  ).toBeVisible();
  await click(page, "resolve");
  await expect(
    page.getByText("Nothing was overwritten.", { exact: false }),
  ).toBeVisible();
  await click(page, "resolve-sheet");
  await click(page, "sync-demo");
  await expect(
    page.getByRole("cell", { name: "Conflicting sheet title", exact: true }),
  ).toBeVisible();
  await page.locator("[data-action=sheet-edit][data-id=AK-1039]").click();
  await page
    .getByLabel("Assignment title", { exact: true })
    .fill("Forbidden overwrite");
  await page.locator("#sheet-form button[type=submit]").click();
  await click(page, "sync-demo");
  await expect(
    page.getByText("Rejected — protected", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Evening site safety check", exact: true }),
  ).toBeVisible();
});
test("sample: dirty state, keyboard dialog dismissal, search empty state, narrow layout and local failure", async ({
  page,
}) => {
  await open(page);
  await role(page, "Worker");
  await click(page, "start");
  await page
    .getByLabel("Anything to tell your supervisor?")
    .fill("Keep these notes");
  await page.getByLabel("Preview role").selectOption("Management");
  await expect(
    page.getByRole("heading", { name: "Save your work first?" }),
  ).toBeVisible();
  await click(page, "close");
  await expect(
    page.getByLabel("Anything to tell your supervisor?"),
  ).toHaveValue("Keep these notes");
  await click(page, "save-draft");
  await role(page, "Management");
  await page.goto("/sample/#settings");
  await click(page, "new-person");
  await page.getByLabel("Full name", { exact: true }).fill("Unsaved name");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Discard unsaved changes?" }),
  ).toBeVisible();
  await click(page, "keep-dialog");
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Unsaved name",
  );
  await click(page, "close");
  await click(page, "discard-dialog");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/sample/#assignments");
  await page.getByLabel("Search assignments").fill("zzzzzz");
  await expect(
    page.getByText("No matching work", { exact: true }),
  ).toBeVisible();
  await click(page, "clear-search");
  await expect(page.getByLabel("Search assignments")).toHaveValue("");
  expect(
    await page.evaluate(
      () => document.body.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.goto("/sample/#settings");
  await page
    .locator("[data-action=settings-tab][data-value=workspace]")
    .click();
  await page.getByLabel("Company / workspace name").fill("Unsaved failure");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw Error("QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "Save workspace", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Could not save");
  await expect(page.getByLabel("Company / workspace name")).toHaveValue(
    "Unsaved failure",
  );
});
test("sample: PWA offline reload, CSV and no unexpected external requests", async ({
  page,
  context,
}) => {
  const external = [];
  page.on("request", (r) => {
    if (
      !r.url().startsWith("http://127.0.0.1:5173") &&
      !r.url().startsWith("data:")
    )
      external.push(r.url());
  });
  await open(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.goto("/sample/#reports");
  const download = page.waitForEvent("download");
  await click(page, "export");
  expect((await download).suggestedFilename()).toBe(
    "NPI-Sample-Assignments.csv",
  );
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "The office can stay in Sheets." }),
  ).toBeVisible();
  await expect(
    page.getByText("Offline. This sample works on this device;", {
      exact: false,
    }),
  ).toBeVisible();
  expect(external).toEqual([]);
  await context.setOffline(false);
});

test("sample: cross-tab edits stop stale writes and preserve notes", async ({
  page,
  context,
}) => {
  await open(page);
  await role(page, "Worker");
  await click(page, "start");
  await page
    .getByLabel("Anything to tell your supervisor?")
    .fill("Do not lose my notes");
  const second = await context.newPage();
  await second.goto("/sample/#reports");
  await second.locator("[data-action=sheet-edit][data-id=AK-1042]").click();
  await second
    .getByLabel("Assignment title", { exact: true })
    .fill("Another-tab change");
  await second.locator("#sheet-form button[type=submit]").click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Another tab changed the sample" }),
  ).toContainText("Another tab changed the sample");
  await expect(
    page.getByLabel("Anything to tell your supervisor?"),
  ).toHaveValue("Do not lose my notes");
  await click(page, "save-draft");
  await expect(page.getByRole("status")).toContainText("Reload before saving");
  await second.close();
});
