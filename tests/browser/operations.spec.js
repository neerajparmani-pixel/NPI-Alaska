import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const start = async (page) => {
  await page.goto("/operations/");
  await page.evaluate(() => localStorage.removeItem("npi-subcontracts-v1"));
  await page.reload();
};
const role = async (p, r) => p.getByLabel("Preview as").selectOption(r);
const action = async (p, a, id) =>
  p
    .locator(`[data-a="${a}"]${id ? '[data-id="' + id + '"]' : ""}`)
    .first()
    .click();
test("operations: GPS required independently at both events, crew hours pass contractor then NPI", async ({
  page,
}) => {
  await start(page);
  await role(page, "Worker");
  await action(page, "capture-in");
  await expect(page.locator("[data-a=confirm-capture]")).toBeDisabled();
  await page.getByLabel("Attendance mode").selectOption("crew");
  await page.getByLabel("Ben Taylor", { exact: true }).check();
  await page.getByLabel("Lee Brooks", { exact: true }).check();
  await action(page, "example-gps");
  await action(page, "confirm-capture");
  for (const c of await page.locator("[data-task]").all()) await c.check();
  await action(page, "photo");
  await action(page, "capture-out");
  await expect(page.locator("[data-a=confirm-capture]")).toBeDisabled();
  await action(page, "example-gps");
  await page.getByLabel("Break minutes for this interval").fill("30");
  await action(page, "confirm-capture");
  await action(page, "claim");
  await page.locator("#claim-form button[type=submit]").click();
  await role(page, "NPI supervisor");
  await expect(
    page.locator("[data-a=npi-approve][data-id=WO-204]"),
  ).toHaveCount(0);
  await role(page, "Subcontractor");
  await page.goto("/operations/#approvals");
  await action(page, "contractor-approve", "WO-204");
  await role(page, "NPI supervisor");
  await action(page, "npi-approve", "WO-204");
  await page.locator("#npi-form button[type=submit]").click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("npi-subcontracts-v1")).works.find(
      (w) => w.id === "WO-204",
    ),
  );
  expect(saved.acceptedHours).toBe(4.5);
  expect(saved.acceptedBy.alex).toBe(1.5);
  expect(saved.sessions[0].in.source).toBe("Example GPS");
  expect(saved.sessions[0].out).toBeTruthy();
  await role(page, "Worker");
  await page.getByLabel("Choose your work").selectOption("WO-204");
  await expect(
    page.locator(".metric").filter({ hasText: "NPI-approved hours" }),
  ).toContainText("1.50");
});
test("operations: NPI adjusts a contractor claim without replacing original events; map uses event point", async ({
  page,
}) => {
  await start(page);
  await role(page, "NPI supervisor");
  await action(page, "npi-approve", "WO-202");
  await page.locator("#npi-form button[type=submit]").click();
  await expect(page.locator("#form-error")).toContainText("Explain");
  await page
    .getByLabel("Verification note / reason for adjustments")
    .fill("Original roster: three workers, two hours each.");
  await page.locator("#npi-form button[type=submit]").click();
  const w = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("npi-subcontracts-v1")).works.find(
      (w) => w.id === "WO-202",
    ),
  );
  expect(w.acceptedHours).toBe(6);
  expect(w.claimedHours).toBe(7);
  expect(w.sessions[0].in.time).toBe("2026-11-10T15:00:00Z");
  await page.goto("/operations/#hours");
  await action(page, "point");
  await expect(
    page.getByRole("link", { name: "Open recorded location" }),
  ).toHaveAttribute("href", /query=61\.2184%2C-149\.899/);
  await expect(
    page.getByText("Recorded address", { exact: true }),
  ).toBeVisible();
});
test("operations: contractor bill mismatch, dispute, revision and payment; customer prices stay separate", async ({
  page,
}) => {
  await start(page);
  await role(page, "Subcontractor");
  await page.goto("/operations/#billing");
  await expect(
    page.getByText("Estimated gross margin", { exact: true }),
  ).toHaveCount(0);
  await action(page, "new-bill");
  await page.getByLabel("Your subcontractor invoice number").fill("AUR-001");
  await page.getByLabel("Claimed total (USD)").fill("400");
  await page.locator("#document-form button[type=submit]").click();
  await role(page, "Management");
  await page.goto("/operations/#billing");
  await action(page, "review-bill");
  await expect(
    page.getByRole("button", { name: "Approve matched bill" }),
  ).toBeDisabled();
  await page
    .getByLabel("Review / dispute note")
    .fill("Claim exceeds agreed approved quantities.");
  await page.getByRole("button", { name: "Dispute bill", exact: true }).click();
  await role(page, "Subcontractor");
  await page.goto("/operations/#billing");
  await action(page, "revise-bill");
  await page.getByLabel("Claimed total (USD)").fill("307.5");
  await page.locator("#document-form button[type=submit]").click();
  await role(page, "Management");
  await page.goto("/operations/#billing");
  await action(page, "review-bill");
  await page
    .getByRole("button", { name: "Approve matched bill", exact: true })
    .click();
  await action(page, "payment");
  await page.getByLabel("Payment / receipt reference").fill("BOOK-001");
  await page.locator("#payment-form button[type=submit]").click();
  await expect(
    page.getByRole("cell", { name: "BOOK-001", exact: true }),
  ).toBeVisible();
  await action(page, "new-invoice");
  await page.getByLabel("Invoice draft reference").fill("CLIENT-001");
  await page.locator("#document-form button[type=submit]").click();
  await action(page, "new-invoice");
  await expect(page.getByRole("status")).toContainText("No unallocated");
});
test("operations: real device GPS denied cannot record; captured coordinates are not replaced by site", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_ok, err) => err({ code: 1 });
  });
  await start(page);
  await role(page, "Worker");
  await action(page, "capture-in");
  await action(page, "gps");
  await expect(
    page.getByText("No event was recorded.", { exact: false }),
  ).toBeVisible();
  await expect(page.locator("[data-a=confirm-capture]")).toBeDisabled();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "hidden");
});
test("operations: accessibility, company scope and responsive views", async ({
  page,
}) => {
  await start(page);
  for (const route of [
    "overview",
    "hours",
    "sites",
    "contracts",
    "billing",
    "settings",
  ]) {
    await page.goto("/operations/#" + route);
    expect(
      await page.evaluate(
        () => document.body.scrollWidth <= document.documentElement.clientWidth,
      ),
      route,
    ).toBe(true);
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      r.violations.map((v) => v.id),
      route,
    ).toEqual([]);
  }
  await role(page, "Subcontractor");
  await expect(
    page.getByText("Northern Site Crew (sample)", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('.navlink[href="#contracts"]')).toHaveCount(0);
});

test("operations: device check-in and checkout retain two independently captured positions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let count = 0;
    navigator.geolocation.getCurrentPosition = (ok) => {
      count++;
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
  await role(page, "Worker");
  await action(page, "capture-in");
  await action(page, "gps");
  await action(page, "confirm-capture");
  await action(page, "capture-out");
  await expect(page.locator("[data-a=confirm-capture]")).toBeDisabled();
  await action(page, "gps");
  await action(page, "confirm-capture");
  const session = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("npi-subcontracts-v1")).works.find(
        (w) => w.id === "WO-204",
      ).sessions[0],
  );
  expect(session.in.source).toBe("Browser GPS");
  expect(session.out.source).toBe("Browser GPS");
  expect(session.in.lat).not.toBe(session.out.lat);
  expect(session.in.lng).not.toBe(session.out.lng);
  expect(session.in.positionTime).toBeTruthy();
  expect(session.out.positionTime).toBeTruthy();
  await page.goto("/operations/#hours");
  await action(page, "point");
  await expect(
    page.getByRole("link", { name: "Open recorded location (map)" }),
  ).toHaveAttribute("href", new RegExp("query=" + session.in.lat));
});
test("operations: scoped PWA shell reopens offline and workbook CSV is downloadable", async ({
  page,
  context,
}) => {
  await start(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.goto("/operations/#spreadsheet");
  const dl = page.waitForEvent("download");
  await action(page, "export-hours");
  expect((await dl).suggestedFilename()).toBe(
    "NPI-Subcontract-Hours-Sample.csv",
  );
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Management workbook preview" }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("operations: management assigns a company-scoped work order with separate pricing", async ({
  page,
}) => {
  await start(page);
  await action(page, "new-work");
  await page
    .getByLabel("Work description")
    .fill("New subcontract snow service");
  await page
    .getByLabel("Subcontractor company", { exact: true })
    .selectOption("north");
  await page
    .getByRole("button", { name: "Create subcontract assignment", exact: true })
    .click();
  await expect(page.locator("#form-error")).toContainText("must belong");
  await page
    .getByLabel("Subcontractor company", { exact: true })
    .selectOption("aurora");
  await page
    .getByLabel("Customer basis", { exact: true })
    .selectOption("fixed");
  await page
    .getByLabel("Subcontractor basis", { exact: true })
    .selectOption("hourly");
  await page
    .getByRole("button", { name: "Create subcontract assignment", exact: true })
    .click();
  await role(page, "Worker");
  await expect(page.getByLabel("Choose your work")).toContainText("WO-205");
});
