import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { backend } from "../helpers/live-fixture.js";
import { prepareVisits } from "../helpers/visits-fixture.js";
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
const login = async (p, user = "alex") => {
  await p.goto("/live/");
  await p.locator("#username").fill(user);
  await p.locator("#password").fill("fictional-pass-123");
  await p.locator("#login-form button[type=submit]").click();
  await expect(p.locator(".live-connection")).toBeVisible();
};
test("worker prepares an unassigned visit, records manual snow measurement and adds a second service", async ({
  page,
}) => {
  const { state } = await backend(page);
  const { snow, sand } = prepareVisits(state);
  await login(page);
  await act(page, "visit-new");
  await page.locator("#line_id").selectOption(snow);
  await page.locator("#action-form button[type=submit]").click();
  await expect(
    page.getByRole("heading", { name: "Services recorded" }),
  ).toBeVisible();
  expect(state.work).toHaveLength(1);
  expect(state.work[0].worker_led).toBe(true);
  await act(page, "upload");
  await page.context().grantPermissions(["camera"]);
  await page.locator("#start-camera").click();
  await page.waitForTimeout(500);
  await page.locator("#capture-photo").click();
  await page.locator("#keep-photo").click();
  await page.locator("#stop-camera").click();
  await page.locator("#upload-batch").click();
  await expect(page.locator("#photo-status")).toContainText("saved");
  await act(page, "close");
  await act(page, "visit-line");
  await page.locator("#ruler_evidence").selectOption(state.evidence[0].id);
  await page.locator("#snow_inches").fill("3");
  await page.locator("[name=measurement_confirmed]").check();
  await page.locator("#action-form button[type=submit]").click();
  await expect(page.locator("#main")).toContainText("A1");
  await act(page, "visit-add");
  await page.locator("#line_id").selectOption(sand);
  await page.locator("#action-form button[type=submit]").click();
  expect(state.visits.lines).toHaveLength(2);
  expect(state.events).toHaveLength(0);
  expect(state.work).toHaveLength(1);
});
test("new visit form and NPI line-item settings are accessible and fit both layouts", async ({
  page,
}) => {
  const { state } = await backend(page);
  prepareVisits(state);
  await login(page);
  await act(page, "visit-new");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await act(page, "close");
  await act(page, "logout");
  await login(page, "owner");
  await page.goto("/live/#settings");
  await expect(
    page.getByRole("heading", { name: "Contract line items & sub-line items" }),
  ).toBeVisible();
  await act(page, "visit-subitem");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("automatic reading errors keep manual entry usable and never confirm measurements", async ({
  page,
}) => {
  const { state } = await backend(page);
  prepareVisits(state);
  await login(page);
  await act(page, "visit-new");
  await page.locator("#line_id").selectOption(state.visits.items[0].id);
  await page.locator("#action-form button[type=submit]").click();
  const l = state.visits.lines[0];
  state.evidence.push({
    id: crypto.randomUUID(),
    work_id: l.work_id,
    stage: "before",
    kind: "photo",
    filename: "ruler.jpg",
    source: "app-camera",
    captured_at: new Date().toISOString(),
  });
  await act(page, "refresh");
  await act(page, "visit-line");
  await page.locator("#ruler_evidence").selectOption(state.evidence[0].id);
  await page.route("**/functions/v1/npi-admin", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"Reading unavailable"}',
    }),
  );
  await act(page, "visit-read");
  await expect(page.locator("#snow-reading")).toContainText(
    "Enter inches manually",
  );
  await expect(page.locator("[name=measurement_confirmed]")).not.toBeChecked();
  await expect(page.locator("#snow_inches")).toBeEditable();
});
