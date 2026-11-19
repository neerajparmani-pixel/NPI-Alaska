import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { u, backend, png } from "../helpers/live-fixture.js";
async function login(page, username) {
  await page.locator("#username").fill(username);
  await page.locator("#password").fill("fictional-pass-123");
  await page.locator("#login-form button[type=submit]").click();
  await expect(page.locator(".live-banner").first()).toContainText(
    "Connected to Supabase",
  );
}
const act = (page, name) =>
  page.locator(`[data-action="${name}"]:visible`).first().click();
const save = (page) => page.locator("#action-form button[type=submit]").click();
test("live login never falls back to demo roles and stores no browser credentials", async ({
  page,
}) => {
  await backend(page, { denyProfile: true });
  await page.goto("/live/");
  await expect(page.locator("#preview-role")).toHaveCount(0);
  await page.locator("#username").fill("alex");
  await page.locator("#password").fill("private");
  await page.locator("#login-form button[type=submit]").click();
  await expect(page.locator("#feedback")).toContainText("active NPI profile");
  await expect(page.locator("#password")).toHaveValue("");
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  await expect(page.locator(".reference-sidebar")).toHaveCount(0);
});
test("live worker sends fresh GPS and evidence, then company and NPI approve shared records", async ({
  page,
  context,
}) => {
  const { state, writes } = await backend(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: 61.2,
    longitude: -149.9,
    accuracy: 10,
  });
  await page.goto("/live/");
  await login(page, "alex");
  await act(page, "open-work");
  await act(page, "clock-in");
  await save(page);
  await expect(page.locator("#dialog-error")).toContainText("fresh location");
  expect(writes).toHaveLength(0);
  await act(page, "gps");
  await save(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await act(page, "tasks");
  for (const box of await page.locator("input[name=completed_tasks]").all())
    await box.check();
  await save(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await act(page, "upload");
  await page.locator("#file").setInputFiles({
    name: "evidence.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await save(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await context.setGeolocation({
    latitude: 61.21,
    longitude: -149.91,
    accuracy: 12,
  });
  await act(page, "clock-out");
  await act(page, "gps");
  await save(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await act(page, "claim");
  await save(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(state.work[0].status).toBe("contractor-review");
  const clocks = writes.filter((w) => w.p_action === "clock");
  expect(clocks.map((c) => c.p_body.latitude)).toEqual([61.2, 61.21]);
  expect(clocks.every((c) => /^[0-9a-f-]{36}$/.test(c.p_request))).toBe(true);
  await act(page, "logout");
  await login(page, "supervisor");
  await act(page, "open-work");
  await act(page, "company-approve");
  await save(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(state.work[0].status).toBe("npi-review");
  await act(page, "logout");
  await login(page, "owner@npi.test");
  await act(page, "open-work");
  await act(page, "npi-approve");
  await save(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(state.work[0].status).toBe("approved");
  expect(state.reviews[0].accepted_minutes).toBe(105);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
test("live admin screen and rate form are accessible, with native controls and no phone overflow", async ({
  page,
}) => {
  await backend(page);
  await page.goto("/live/");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await login(page, "owner@npi.test");
  await page.goto("/live/#rates");
  await act(page, "new-rate");
  await save(page);
  await expect(page.locator("#price")).toHaveAttribute("aria-invalid", "true");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});
test("dirty live forms retain their opened version across refreshes", async ({
  page,
}) => {
  const { state, writes } = await backend(page);
  await page.goto("/live/");
  await login(page, "alex");
  await act(page, "open-work");
  state.work[0].status = "in-progress";
  await act(page, "refresh");
  await act(page, "tasks");
  await page.locator("input[name=completed_tasks]").first().check();
  state.work[0].version++;
  await save(page);
  await expect(page.locator("#dialog-error")).toContainText("changed");
  expect(writes.at(-1).p_body.version).toBe(1);
  await act(page, "close");
  await expect(
    page.getByText("Unsaved changes:", { exact: false }),
  ).toBeVisible();
  await act(page, "discard");
});

test("live session expiry restores same-user draft without silently changing its version", async ({
  page,
}) => {
  const { state, writes } = await backend(page);
  state.work[0].status = "in-progress";
  await page.goto("/live/");
  await login(page, "alex");
  await act(page, "open-work");
  await act(page, "tasks");
  await page.locator("input[name=completed_tasks]").first().check();
  state.expireNext = true;
  await save(page);
  await expect(page.locator("#login-form")).toBeVisible();
  await login(page, "alex");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.locator("input[name=completed_tasks]").first(),
  ).toBeChecked();
  await expect(page.locator("#dialog-error")).toContainText("Draft restored");
  await save(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(writes.at(-1).p_body.version).toBe(1);
});

test("shown temporary passwords are excluded when a staff form is restored after session expiry", async ({
  page,
}) => {
  const { state } = await backend(page);
  await page.goto("/live/");
  await login(page, "owner@npi.test");
  await page.goto("/live/#people");
  await act(page, "new-person");
  await page.locator("#display_name").fill("Unfinished worker");
  await page.getByRole("dialog").locator("#username").fill("unfinished.worker");
  await page
    .getByRole("dialog")
    .locator("#password")
    .fill("never-restore-this-pass");
  await act(page, "show-staff-password");
  state.expireAdminNext = true;
  await save(page);
  await expect(page.locator("#login-form")).toBeVisible();
  await login(page, "owner@npi.test");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("#display_name")).toHaveValue("Unfinished worker");
  await expect(page.getByRole("dialog").locator("#password")).toHaveValue("");
  await expect(page.getByRole("dialog").locator("#password")).toHaveAttribute(
    "type",
    "password",
  );
});
