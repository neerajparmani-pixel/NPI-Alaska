import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { backend, u } from "../helpers/live-fixture.js";
const act = (p, a) => p.locator(`[data-action="${a}"]:visible`).first().click();
async function login(p, name = "owner") {
  await p.goto("/live/");
  await p.locator("#username").fill(name);
  await p.locator("#password").fill("private-test-password");
  await p.locator("#login-form button[type=submit]").click();
  await expect(p.locator(".live-connection")).toBeVisible();
}
test("NPI can invite a second NPI admin without a company and see pending approvals", async ({
  page,
}) => {
  const { state, writes } = await backend(page);
  await login(page);
  await page.goto("/live/#people");
  await act(page, "new-invitation");
  await page.locator("#email").fill("new.admin@example.test");
  await expect(page.locator("[data-invite-company]")).toBeHidden();
  await page.locator("#action-form button[type=submit]").click();
  await expect(page.locator("#invitation-url")).toBeVisible();
  const b = writes.find((w) => w.p_action === "create_invite").p_body;
  expect(b.role).toBe("npi");
  expect(b.company_id).toBe(null);
  expect(b.email).toBe("new.admin@example.test");
  await act(page, "close");
  state.people.push({
    id: crypto.randomUUID(),
    role: "npi",
    company_id: null,
    username: "new.admin",
    email: "new.admin@example.test",
    display_name: "New NPI Admin",
    account_status: "pending",
    active: false,
    email_verified: true,
    invited_by: u.npi,
    access_version: 1,
  });
  await page.goto("/live/#people?tab=pending");
  await expect(
    page.getByRole("heading", { name: "Pending approvals", exact: true }),
  ).toBeVisible();
  await act(page, "account-approve");
  await expect(page.locator("#dialog")).toContainText(
    "Full NPI administration",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("email verification route removes token from the address and leaves access pending", async ({
  page,
}) => {
  await backend(page);
  await page.goto("/live/#verify=" + "a".repeat(64));
  await expect(
    page.getByRole("heading", { name: "Email verified" }),
  ).toBeVisible();
  expect(page.url()).not.toContain("a".repeat(64));
  await expect(
    page.getByText("Your account is awaiting administrator approval.", {
      exact: false,
    }),
  ).toBeVisible();
});
test("report downloads include all 603 rows across server pages, real Excel and PDF files", async ({
  page,
}) => {
  const { state } = await backend(page);
  state.reportRows = Array.from({ length: 603 }, (_, i) => ({
    work_id: state.work[0].id,
    date: "2026-11-23",
    company: "Test contractor",
    site: "Boney",
    title: "Visit " + i,
    recorded_hours: 1.75,
    status: "approved",
    record_link: "https://alaska.npi6030.com/live/#work=" + state.work[0].id,
  }));
  await login(page);
  await page.goto("/live/#reports");
  await page.locator("#complete-report-filters button[type=submit]").click();
  await expect(page.locator("#report-progress")).toContainText(
    "All matching rows",
  );
  await expect(page.getByText("603 rows", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (const [action, ext] of [
    ["report-csv", ".csv"],
    ["report-xlsx", ".xlsx"],
    ["report-pdf", ".pdf"],
  ]) {
    const download = page.waitForEvent("download");
    await act(page, action);
    const file = await download;
    expect(file.suggestedFilename()).toContain(ext);
    const bytes = await fs.readFile(await file.path());
    if (ext === ".csv") expect(bytes.toString()).toContain("Visit 602");
    if (ext === ".xlsx") {
      const sheet = strFromU8(unzipSync(bytes)["xl/worksheets/sheet1.xml"]);
      expect((sheet.match(/<row r=/g) || []).length).toBe(604);
    }
    if (ext === ".pdf") expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  }
});
test("empty reports show no matches and invalid dates have a clear recovery message", async ({
  page,
}) => {
  await backend(page);
  await login(page);
  await page.goto("/live/#reports");
  await page.locator("#from").fill("2026-11-23");
  await page.locator("#to").fill("2026-11-01");
  await page.locator("#complete-report-filters button[type=submit]").click();
  await expect(page.locator("#report-error")).toContainText("valid date range");
  await page.locator("#to").fill("2026-11-23");
  await page.locator("#complete-report-filters button[type=submit]").click();
  await expect(page.getByText("0 rows", { exact: true })).toBeVisible();
});

test("selected private evidence is downloaded with its original bytes in a ZIP", async ({
  page,
}) => {
  const { state, storedFiles } = await backend(page);
  const id = crypto.randomUUID(),
    path = state.work[0].id + "/" + u.worker + "/" + id + ".jpg",
    bytes = Buffer.from("unchanged-private-original");
  storedFiles.set(path, { type: "image/jpeg", bytes });
  state.evidence.push({
    id,
    work_id: state.work[0].id,
    path,
    filename: "before.jpg",
    bytes: bytes.length,
  });
  state.reportRows = [
    {
      work_id: state.work[0].id,
      evidence_id: id,
      date: "2026-11-23",
      company: "Test contractor",
      site: "Boney",
      stage: "before",
      filename: "before.jpg",
      bytes: bytes.length,
    },
  ];
  await login(page);
  await page.goto("/live/#reports");
  await page.locator("#kind").selectOption("evidence");
  await page.locator("#complete-report-filters button[type=submit]").click();
  await page.locator("[data-evidence-select]").check();
  const download = page.waitForEvent("download");
  await act(page, "report-evidence");
  const file = await download;
  const bundle = unzipSync(await fs.readFile(await file.path()));
  expect(Buffer.from(Object.values(bundle)[0])).toEqual(bytes);
  expect(file.suggestedFilename()).toBe("NPI-private-evidence.zip");
});
test("an interrupted signup resumes its request ticket after reopening the link without persisting passwords", async ({
  page,
}) => {
  const { state, writes } = await backend(page);
  state.registrationFails = true;
  const link = "/live/#join=" + "c".repeat(64);
  await page.goto(link);
  await page.locator("#join-name").fill("Resume Worker");
  await page.locator("#join-username").fill("resume.worker");
  await page.locator("#join-password").fill("private-password-123");
  await page.locator("#join-confirm").fill("private-password-123");
  await page.locator("#registration-form button[type=submit]").click();
  await expect(page.locator("#join-error")).toBeVisible();
  expect(
    await page.evaluate(() => Object.values(sessionStorage).join("")),
  ).not.toContain("private-password");
  state.registrationFails = false;
  await page.goto(link);
  await expect(page.locator("#join-name")).toHaveValue("Resume Worker");
  await expect(page.locator("#join-password")).toHaveValue("");
  await page.locator("#join-password").fill("private-password-123");
  await page.locator("#join-confirm").fill("private-password-123");
  await page.locator("#registration-form button[type=submit]").click();
  await expect(
    page.getByRole("heading", { name: "Verify your email" }),
  ).toBeVisible();
  expect(writes.some((w) => w.operation === "register_invitation")).toBe(true);
  expect(
    await page.evaluate(
      () =>
        Object.keys(sessionStorage).filter((k) => k.startsWith("npi-signup:"))
          .length,
    ),
  ).toBe(0);
});
