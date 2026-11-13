import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const start = async (p) => {
  await p.goto("/three-view/");
  await p.evaluate(() => localStorage.removeItem("npi-three-view-v1"));
  await p.reload();
};
const action = async (p, a, id) =>
  p
    .locator(`[data-action="${a}"]${id ? '[data-id="' + id + '"]' : ""}`)
    .first()
    .click();
const role = async (p, r) => action(p, "role", r);
test("three views: only requested roles, company scope, no contracts or financial amounts", async ({
  page,
}) => {
  await start(page);
  await expect(page.locator(".role")).toHaveCount(3);
  await expect(page.locator(".role").nth(0)).toContainText("NPI Admin");
  await expect(page.locator(".role").nth(1)).toContainText(
    "Subcontractor Admin",
  );
  await expect(page.locator(".role").nth(2)).toContainText(
    "Subcontractor Worker",
  );
  await expect(
    page.getByText("Summit Site Services", { exact: true }),
  ).toBeVisible();
  await role(page, "sub");
  await expect(
    page.getByText("Summit Site Services", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("[data-action=new-job]")).toHaveCount(0);
  await page.goto("/three-view/#bills");
  await expect(
    page.getByText("Customer invoice checklists", { exact: true }),
  ).toHaveCount(0);
  await role(page, "worker");
  await expect(page.locator(".tabs a")).toHaveCount(4);
  await expect(page.locator("input[type=password]")).toHaveCount(0);
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/\$\s*\d/);
});
test("three views: crew attendance, required separate locations and two admin approvals", async ({
  page,
}) => {
  await start(page);
  await role(page, "worker");
  await action(page, "open-job", "DEMO-104");
  await action(page, "capture-in");
  await expect(page.locator("[data-action=capture-confirm]")).toBeDisabled();
  await page.getByLabel("Attendance mode").selectOption("crew");
  await page.getByLabel("Jamal Reed", { exact: true }).check();
  await page.getByLabel("Lee Parker", { exact: true }).check();
  await action(page, "example-gps");
  await action(page, "capture-confirm");
  for (const c of await page.locator("[data-task]").all()) await c.check();
  await action(page, "example-photo");
  await action(page, "capture-out");
  await expect(page.locator("[data-action=capture-confirm]")).toBeDisabled();
  await action(page, "example-gps");
  await page.getByLabel("Break minutes for this interval").fill("30");
  await action(page, "capture-confirm");
  await action(page, "claim");
  await page.locator("#claim-form button[type=submit]").click();
  await role(page, "npi");
  await page.goto("/three-view/#review");
  await expect(
    page.locator("[data-action=npi-approve][data-id=DEMO-104]"),
  ).toHaveCount(0);
  await role(page, "sub");
  await page.goto("/three-view/#review");
  await action(page, "company-approve", "DEMO-104");
  await role(page, "npi");
  await page.goto("/three-view/#review");
  await action(page, "npi-approve", "DEMO-104");
  await page.locator("#verify-form button[type=submit]").click();
  const j = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("npi-three-view-v1")).jobs.find(
      (j) => j.id === "DEMO-104",
    ),
  );
  expect(j.acceptedHours).toBe(4.5);
  expect(j.acceptedBy.alex).toBe(1.5);
  expect(j.sessions[0].out).toBeTruthy();
  await role(page, "worker");
  await page.goto("/three-view/#hours");
  await expect(
    page.getByRole("cell", { name: "1.50 · 1.50 · 1.50", exact: true }),
  ).toBeVisible();
});
test("three views: NPI adjustment preserves claim, evidence and map point", async ({
  page,
}) => {
  await start(page);
  await page.goto("/three-view/#review");
  await action(page, "npi-approve", "DEMO-101");
  await page.locator("#verify-form button[type=submit]").click();
  await expect(page.locator("#verify-note-error")).toContainText("Explain");
  await page
    .getByLabel("Verification note / adjustment reason")
    .fill(
      "Example: accepted original crew intervals, three people at two hours.",
    );
  await page.locator("#verify-form button[type=submit]").click();
  const j = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("npi-three-view-v1")).jobs.find(
      (j) => j.id === "DEMO-101",
    ),
  );
  expect(j.claimedHours).toBe(7);
  expect(j.acceptedHours).toBe(6);
  expect(j.claimedBy.alex).toBe(3);
  expect(j.sessions[0].in.time).toBe("2026-11-10T15:00:00Z");
  await page.goto("/three-view/#orders");
  await action(page, "evidence", "DEMO-101");
  await action(page, "point");
  await expect(
    page.getByRole("link", { name: "Open recorded point on map" }),
  ).toHaveAttribute("href", /query=61\.2184%2C-149\.899/);
});
test("three views: correction, hauling evidence and unpriced billing allocation", async ({
  page,
}) => {
  await start(page);
  await role(page, "sub");
  await page.goto("/three-view/#review");
  await action(page, "return", "DEMO-102");
  await page.locator("#return-form button[type=submit]").click();
  await expect(page.locator("#correction-error")).toContainText("reason");
  await page
    .getByLabel("What must be corrected?")
    .fill("Please clarify the additional time.");
  await page.locator("#return-form button[type=submit]").click();
  await page.goto("/three-view/#bills");
  await action(page, "new-bill");
  await page.getByLabel("Your document reference").fill("SAMPLE-Q-1");
  await page.locator("#document-form button[type=submit]").click();
  await role(page, "npi");
  await page.goto("/three-view/#bills");
  await action(page, "review-bill");
  await page
    .getByRole("button", { name: "Accept quantities", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "Accepted", exact: true }),
  ).toBeVisible();
  await role(page, "sub");
  await page.goto("/three-view/#bills");
  await action(page, "new-bill");
  await expect(page.getByRole("status")).toContainText("No unallocated");
  await role(page, "worker");
  await action(page, "open-job", "DEMO-103");
  await action(page, "capture-in");
  await action(page, "example-gps");
  await action(page, "capture-confirm");
  for (const c of await page.locator("[data-task]").all()) await c.check();
  await action(page, "example-photo");
  await action(page, "capture-out");
  await action(page, "example-gps");
  await action(page, "capture-confirm");
  await action(page, "claim");
  await expect(page.getByRole("status")).toContainText("timecard");
});
test("three views: assignments, sample users, dirty dialog and local save failure", async ({
  page,
}) => {
  await start(page);
  await action(page, "new-job");
  await page.getByLabel("Work description").fill("Example site assignment");
  await page
    .getByLabel("Subcontractor company", { exact: true })
    .selectOption("summit");
  await page.locator("#job-form button[type=submit]").click();
  await expect(page.locator("#job-worker-error")).toContainText(
    "selected company",
  );
  await page
    .getByLabel("Subcontractor company", { exact: true })
    .selectOption("north");
  await page.locator("#job-form button[type=submit]").click();
  await expect(page.getByText("DEMO-105", { exact: false })).toBeVisible();
  await role(page, "sub");
  await page.goto("/three-view/#team");
  await action(page, "new-person");
  await page.getByLabel("Worker name").fill("Test Crew Member");
  await page.keyboard.press("Escape");
  await expect(
    page.getByText("These changes have not been saved.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Worker name")).toHaveValue("Test Crew Member");
  await page.getByLabel("Company username").fill("test.crew");
  await page.locator("#person-form button[type=submit]").click();
  await expect(page.getByText("test.crew", { exact: true })).toBeVisible();
  await action(page, "new-person");
  await page.getByLabel("Worker name").fill("Unsaved worker");
  await page.getByLabel("Company username").fill("unsaved.worker");
  await page.evaluate(
    () =>
      (Storage.prototype.setItem = () => {
        throw Error("Quota");
      }),
  );
  await page.locator("#person-form button[type=submit]").click();
  await expect(page.getByRole("status")).toContainText("Could not save");
  await expect(page.getByLabel("Worker name")).toHaveValue("Unsaved worker");
});
test("three views: device GPS denial and independent device positions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let count = 0;
    navigator.geolocation.getCurrentPosition = (ok, fail) => {
      count++;
      if (count === 1) fail({ code: 1 });
      else
        ok({
          coords: {
            latitude: 61.21 + count / 1000,
            longitude: -149.89 - count / 1000,
            accuracy: 8,
          },
          timestamp: Date.now(),
        });
    };
  });
  await start(page);
  await role(page, "worker");
  await action(page, "open-job", "DEMO-104");
  await action(page, "capture-in");
  await action(page, "gps");
  await expect(page.locator("[data-action=capture-confirm]")).toBeDisabled();
  await expect(
    page.getByText("No attendance event was recorded.", { exact: false }),
  ).toBeVisible();
  await action(page, "gps");
  await action(page, "capture-confirm");
  await action(page, "capture-out");
  await expect(page.locator("[data-action=capture-confirm]")).toBeDisabled();
  await action(page, "gps");
  await action(page, "capture-confirm");
  const s = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("npi-three-view-v1")).jobs.find(
        (j) => j.id === "DEMO-104",
      ).sessions[0],
  );
  expect(s.in.lat).not.toBe(s.out.lat);
  expect(s.in.source).toBe("Browser GPS");
  expect(s.out.source).toBe("Browser GPS");
});
test("three views: keyboard accessibility, search, narrow layout and PWA offline", async ({
  page,
  context,
}) => {
  await start(page);
  for (const route of [
    "overview",
    "orders",
    "review",
    "hours",
    "sites",
    "bills",
    "settings",
  ]) {
    await page.goto("/three-view/#" + route);
    const a = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      a.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      route,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.body.scrollWidth <= document.documentElement.clientWidth,
      ),
      route,
    ).toBe(true);
  }
  await page.goto("/three-view/#orders");
  await page.getByLabel("Search work orders").fill("zzzz");
  await expect(
    page.getByText("No matching records", { exact: true }),
  ).toBeVisible();
  await action(page, "clear-search");
  await expect(page.getByLabel("Search work orders")).toHaveValue("");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Work orders", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("three views: requesting fresh device GPS clears the earlier example point", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (ok) =>
      (window.finishLocation = () =>
        ok({
          coords: { latitude: 61.22, longitude: -149.91, accuracy: 9 },
          timestamp: Date.now(),
        }));
  });
  await start(page);
  await role(page, "worker");
  await action(page, "open-job", "DEMO-104");
  await action(page, "capture-in");
  await action(page, "example-gps");
  await expect(page.locator("[data-action=capture-confirm]")).toBeEnabled();
  await action(page, "gps");
  await expect(page.locator("[data-action=capture-confirm]")).toBeDisabled();
  await expect(page.locator("[data-action=example-gps]")).toBeDisabled();
  await page.evaluate(() => window.finishLocation());
  await action(page, "capture-confirm");
  const p = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("npi-three-view-v1")).jobs.find(
        (j) => j.id === "DEMO-104",
      ).sessions[0].in,
  );
  expect(p.source).toBe("Browser GPS");
  expect(p.lat).toBe(61.22);
});

test("three views: company assigns its own worker before attendance begins", async ({
  page,
}) => {
  await start(page);
  await role(page, "sub");
  await page.goto("/three-view/#orders");
  await action(page, "assign-worker", "DEMO-103");
  await expect(page.getByLabel("Worker / crew lead")).not.toContainText(
    "Miles Taylor",
  );
  await page.getByLabel("Worker / crew lead").selectOption("jamal");
  await page.locator("#assign-worker-form button[type=submit]").click();
  await role(page, "worker");
  await expect(
    page.locator("[data-action=open-job][data-id=DEMO-103]"),
  ).toHaveCount(0);
  await expect(
    page.locator("[data-action=open-job][data-id=DEMO-104]"),
  ).toBeVisible();
});
