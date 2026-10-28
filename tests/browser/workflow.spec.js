import { test, expect } from "@playwright/test";
const photo = {
  name: "work.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/H0AAAAASUVORK5CYII=",
    "base64",
  ),
};
test("worker submission, supervisor correction, resubmission and approval persist", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Let’s get to work." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "View assignment" }).first().click();
  await page.getByRole("button", { name: "Start work", exact: true }).click();
  await page.getByRole("button", { name: "Submit work for review" }).click();
  await expect(page.getByRole("alert")).toContainText("Select at least one");
  await page.getByLabel("Plowing", { exact: true }).check();
  await page.getByRole("button", { name: "Submit work for review" }).click();
  await expect(page.getByRole("alert")).toContainText("photo");
  await page.locator("#photo-input").setInputFiles(photo);
  await expect(page.getByAltText("Work evidence 1")).toBeVisible();
  await page.getByRole("button", { name: "Submit work for review" }).click();
  await expect(
    page.getByRole("heading", { name: "Your work history" }),
  ).toBeVisible();
  await page.reload();
  await page.getByLabel("Demo view").selectOption("supervisor");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Review work", exact: true })
    .click();
  await page
    .locator(".jobcard")
    .filter({ hasText: "AK-101" })
    .getByRole("button", { name: "Review work" })
    .click();
  await page
    .getByLabel("Correction instructions")
    .fill("Add a note about the sidewalk");
  await page.getByRole("button", { name: "Request correction" }).click();
  await expect(page.locator(".notice")).toContainText("Add a note");
  await page.getByLabel("Demo view").selectOption("worker");
  await page.getByRole("button", { name: "Fix & resubmit" }).click();
  await page.getByLabel("Work notes").fill("Sidewalk cleared.");
  await page.getByRole("button", { name: "Submit work for review" }).click();
  await expect(
    page.getByRole("heading", { name: "Your work history" }),
  ).toBeVisible();
  await page.getByLabel("Demo view").selectOption("supervisor");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Review work", exact: true })
    .click();
  await page
    .locator(".jobcard")
    .filter({ hasText: "AK-101" })
    .getByRole("button", { name: "Review work" })
    .click();
  await page.getByRole("button", { name: "Approve work" }).click();
  await expect(page.locator(".badge")).toHaveText("Approved");
  await page.reload();
  await page.getByRole("button", { name: "My history" }).click();
  await expect(
    page.locator(".jobcard").filter({ hasText: "AK-101" }),
  ).toContainText("Approved");
});
test("supervisor creates an assignment and worker can see it", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Demo view").selectOption("supervisor");
  await page.getByRole("button", { name: "Assign work" }).click();
  await page.getByRole("button", { name: "Create assignment" }).click();
  await expect(page.getByRole("alert")).toContainText("work area");
  await page.getByLabel("Work area or assignment").fill("North parking lot");
  await page.getByLabel("Equipment", { exact: true }).fill("Plow 12");
  await page.getByRole("button", { name: "Create assignment" }).click();
  await expect(
    page.getByRole("heading", { name: "Work records", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Demo view").selectOption("worker");
  await expect(page.getByText("North parking lot")).toBeVisible();
  await page.getByRole("button", { name: "Tote Port", exact: true }).click();
  await expect(page.locator(".jobcard")).toHaveCount(1);
  await page.getByRole("button", { name: "David Dowd", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No work here yet" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("keyboard navigation and narrow-screen screenshot", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Let’s get to work." }),
  ).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveAttribute("data-page", "work");
  await page.screenshot({
    path: testInfo.outputPath("worker-home.png"),
    fullPage: true,
  });
  await page.getByLabel("Demo view").selectOption("management");
  await expect(
    page.getByRole("heading", { name: "A clear view of the field." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("draft survives offline editing and invalid upload retains existing evidence", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "View assignment" }).first().click();
  await page.getByRole("button", { name: "Start work", exact: true }).click();
  await expect(page.getByLabel("Plowing", { exact: true })).toBeVisible();
  await page.locator("#photo-input").setInputFiles(photo);
  await expect(page.getByAltText("Work evidence 1")).toBeVisible();
  await page.locator("#photo-input").setInputFiles({
    name: "wrong.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a photo"),
  });
  await expect(page.getByRole("alert")).toContainText("supported file");
  await expect(page.getByAltText("Work evidence 1")).toBeVisible();
  await context.setOffline(true);
  await expect(
    page.getByRole("status").filter({ hasText: "Offline" }),
  ).toBeVisible();
  await page.getByLabel("Work notes").fill("Offline draft");
  await page.getByLabel("Plowing", { exact: true }).check();
  await page.getByRole("button", { name: "Back to my work" }).click();
  await page.getByRole("button", { name: "Continue work" }).click();
  await expect(page.getByLabel("Work notes")).toHaveValue("Offline draft");
  await expect(page.getByLabel("Plowing", { exact: true })).toBeChecked();
  await context.setOffline(false);
});
test("every visible enabled button has an action", async ({ page }) => {
  await page.addInitScript(() => {
    const original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, ...args) {
      if (this instanceof HTMLElement) {
        this.__npiEvents ??= [];
        this.__npiEvents.push(type);
      }
      return original.call(this, type, ...args);
    };
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Let’s get to work." }),
  ).toBeVisible();
  const inactive = () =>
    page
      .locator("button:visible:enabled")
      .evaluateAll((buttons) =>
        buttons
          .filter(
            (b) =>
              !b.onclick &&
              !b.__npiEvents?.includes("click") &&
              !(b.type === "submit" && b.form),
          )
          .map((b) => b.textContent.trim()),
      );
  expect(await inactive()).toEqual([]);
  await page.getByRole("button", { name: "View assignment" }).first().click();
  expect(await inactive()).toEqual([]);
  await page.getByRole("button", { name: "Start work", exact: true }).click();
  await expect(page.getByLabel("Plowing", { exact: true })).toBeVisible();
  expect(await inactive()).toEqual([]);
  await page.getByLabel("Demo view").selectOption("supervisor");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Review work", exact: true })
    .click();
  await page
    .locator(".jobcard")
    .first()
    .getByRole("button", { name: "Review work" })
    .click();
  expect(await inactive()).toEqual([]);
});
