import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const start = async (p) => {
  await p.goto("/three-view/");
  await p.evaluate(() => localStorage.removeItem("npi-three-view-v1"));
  await p.reload();
  await p.locator("[data-action=role][data-id=npi]").click();
};
const action = (p, a, id) =>
  p
    .locator(`[data-action="${a}"]${id ? '[data-id="' + id + '"]' : ""}`)
    .first()
    .click();
const saved = (p) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("npi-three-view-v1")));
test("dispatch changes only unstarted assignments and records an audit event", async ({
  page,
}) => {
  await start(page);
  await page.goto("/three-view/#schedule");
  await action(page, "edit-plan", "DEMO-104");
  await page
    .getByLabel("Work description", { exact: true })
    .fill("Clear the north access route");
  await page.locator("#plan-date").fill("2026-11-18");
  await page.locator("#plan-form button[type=submit]").click();
  const state = await saved(page);
  expect(state.jobs.find((j) => j.id === "DEMO-104").title).toBe(
    "Clear the north access route",
  );
  expect(state.audit[0].text).toContain("plan updated");
  await expect(
    page.locator("[data-action=edit-plan][data-id=DEMO-101]"),
  ).toHaveCount(0);
  await page.locator("#preview-role").selectOption("sub");
  await page.goto("/three-view/#schedule");
  await expect(
    page.getByText("Summit Site Services", { exact: true }),
  ).toHaveCount(0);
});
test("workbook preview applies planning changes, rejects stale and protected imports", async ({
  page,
}) => {
  await start(page);
  await page.goto("/three-view/#sheets");
  await action(page, "example-workbook");
  const original = await page
    .getByLabel("Edited workbook CSV", { exact: true })
    .inputValue();
  await page.locator("#workbook-form button[type=submit]").click();
  await expect(page.getByRole("dialog")).toContainText("Proposed value");
  await action(page, "apply-workbook");
  expect(
    (await saved(page)).jobs.find((j) => j.id === "DEMO-104").title,
  ).toContain("workbook update");
  await page.getByLabel("Edited workbook CSV", { exact: true }).fill(original);
  await page.locator("#workbook-form button[type=submit]").click();
  await expect(page.locator("#workbook-error")).toContainText("stale");
  await action(page, "example-workbook");
  const current = await page
    .getByLabel("Edited workbook CSV", { exact: true })
    .inputValue();
  await page
    .getByLabel("Edited workbook CSV", { exact: true })
    .fill(current.replace('"draft"', '"approved"'));
  await page.locator("#workbook-form button[type=submit]").click();
  await expect(page.locator("#workbook-error")).toContainText("protected");
});
test("service request becomes an assigned work order through the existing scheduling flow", async ({
  page,
}) => {
  await start(page);
  await page.goto("/three-view/#requests");
  await action(page, "new-request");
  await page
    .getByLabel("Additional work requested")
    .fill("Extra clearing at the access gate");
  await page.locator("#request-form button[type=submit]").click();
  await action(page, "schedule-request");
  await expect(
    page.getByLabel("Work description", { exact: true }),
  ).toHaveValue("Extra clearing at the access gate");
  await page.locator("#job-form button[type=submit]").click();
  const state = await saved(page);
  expect(state.requests[0].jobId).toBe("DEMO-105");
  expect(state.jobs[0].customerBasis).toBe("hourly");
  await page.goto("/three-view/#requests");
  await expect(page.getByText("Scheduled", { exact: true })).toBeVisible();
});
test("workspace settings persist without storing credentials and report export respects scope", async ({
  page,
}) => {
  await start(page);
  await page.goto("/three-view/#settings");
  await action(page, "edit-workspace");
  await page
    .getByLabel("Workspace name", { exact: true })
    .fill("Alaska NPI Operations");
  await page.locator("#workspace-form button[type=submit]").click();
  expect((await saved(page)).workspace.name).toBe("Alaska NPI Operations");
  await expect(
    page.getByText("Not connected", { exact: true }).first(),
  ).toBeVisible();
  await page.locator("#preview-role").selectOption("sub");
  await page.goto("/three-view/#reports");
  await expect(
    page.getByText("Summit Site Services", { exact: true }),
  ).toHaveCount(0);
  const download = page.waitForEvent("download");
  await action(page, "export-report");
  expect((await download).suggestedFilename()).toBe(
    "NPI-Operations-Report.csv",
  );
  await page.goto("/three-view/#sheets");
  await expect(
    page.getByRole("heading", { name: "Management workbook", exact: true }),
  ).toHaveCount(0);
});
test("management screens are accessible and fit phone, tablet and desktop widths", async ({
  page,
}) => {
  await start(page);
  for (const width of [320, 390, 820, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["schedule", "reports", "sheets", "settings"]) {
      await page.goto("/three-view/#" + route);
      expect(
        await page.evaluate(
          () =>
            document.body.scrollWidth <= document.documentElement.clientWidth,
        ),
        route + " " + width,
      ).toBe(true);
      if (width === 390 || width === 1440) {
        const scan = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          scan.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
          route,
        ).toEqual([]);
      }
    }
  }
});
test("worker phone navigation keeps the assignment and hours reachable", async ({
  page,
}) => {
  await start(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#preview-role").selectOption("worker");
  await expect(page.locator(".worker-bottom-nav")).toBeVisible();
  await expect(page.locator(".worker-bottom-nav a")).toHaveCount(4);
  await page.locator('.worker-bottom-nav a[href="#hours"]').click();
  await expect(
    page.getByRole("heading", { name: "My hours & history", exact: true }),
  ).toBeVisible();
  await page.locator('.worker-bottom-nav a[href="#work"]').click();
  await expect(
    page.getByRole("heading", { name: "My work", exact: true }),
  ).toBeVisible();
});
