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
  await page.locator("#multi-files").setInputFiles({
    name: "evidence.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      await page.evaluate(() => {
        const c = document.createElement("canvas");
        c.width = 20;
        c.height = 20;
        c.getContext("2d").fillRect(0, 0, 20, 20);
        return c.toDataURL("image/png").split(",")[1];
      }),
      "base64",
    ),
  });
  await page.locator("#upload-batch").click();
  await expect(page.locator("#photo-status")).toContainText(
    "saved successfully",
  );
  await act(page, "close");
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
  await expect(
    page.getByRole("heading", {
      name: "Work submitted for company review.",
      exact: true,
    }),
  ).toBeVisible();
  await act(page, "close");
  expect(state.work[0].status).toBe("contractor-review");
  const clocks = writes.filter((w) => w.p_action === "clock");
  expect(clocks.map((c) => c.p_body.latitude)).toEqual([61.2, 61.21]);
  expect(clocks.every((c) => /^[0-9a-f-]{36}$/.test(c.p_request))).toBe(true);
  await act(page, "logout");
  await login(page, "supervisor");
  await act(page, "open-work");
  await act(page, "company-approve");
  await save(page);
  await expect(
    page.getByRole("heading", { name: "Work forwarded to NPI.", exact: true }),
  ).toBeVisible();
  await act(page, "close");
  expect(state.work[0].status).toBe("npi-review");
  await act(page, "logout");
  await login(page, "owner@npi.test");
  await act(page, "open-work");
  const maps = page.locator('a.live-map[href*="google.com/maps"]');
  await expect(maps).toHaveCount(2);
  expect(await maps.first().getAttribute("href")).toContain("61.2,-149.9");
  await act(page, "field-file");
  await expect(page.locator("img.live-modal-photo")).toBeVisible();
  await expect
    .poll(() =>
      page.locator("img.live-modal-photo").evaluate((img) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  await act(page, "close");
  await act(page, "npi-approve");
  await save(page);
  await expect(
    page.getByRole("heading", {
      name: "Work verified and hours accepted.",
      exact: true,
    }),
  ).toBeVisible();
  await act(page, "close");
  expect(state.work[0].status).toBe("approved");
  expect(state.reviews[0].accepted_minutes).toBe(105);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
test("live admin contract form is accessible, with native controls and no phone overflow", async ({
  page,
}) => {
  await backend(page);
  await page.goto("/live/");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await login(page, "owner@npi.test");
  await page.goto("/live/#contracts");
  await act(page, "new-contract");
  await save(page);
  await expect(page.locator("#name")).toHaveAttribute("aria-invalid", "true");
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

test("approved oversight layout uses scoped counts, real empty states and accessible role navigation", async ({
  page,
}) => {
  const { state } = await backend(page);
  state.work = [];
  state.members = [];
  state.reviews = [];
  state.summary = {
    active: 0,
    company_review: 0,
    npi_review: 0,
    approved: 0,
    work_count: 0,
  };
  await page.goto("/live/");
  await login(page, "owner@npi.test");
  await expect(page.locator(".oversight-hero")).toContainText(
    "Every site. Every shift. Verified.",
  );
  await expect(page.locator(".hero-stat strong")).toHaveText("0/0");
  await expect(
    page.getByRole("heading", { name: "Worker activity", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Hours by location", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Attention queue", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No work activity yet" }),
  ).toBeVisible();
  await expect(page.locator("#preview-role")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const narrow = page.viewportSize().width < 960;
  if (narrow) {
    await page.locator("#live-nav").focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await page.locator("#live-nav").selectOption("companies");
  } else {
    await expect(
      page.locator('.side-nav a[href="#companies"] svg'),
    ).toHaveCount(1);
    await page
      .getByRole("link", { name: "Subcontractors", exact: true })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "Subcontractors", exact: true }),
  ).toBeVisible();
  await act(page, "new-company");
  await expect(page.getByRole("dialog")).toBeVisible();
  await act(page, "close");
  await act(page, "logout");
  await login(page, "alex");
  if (narrow) {
    await expect(
      page.getByRole("navigation", { name: "Worker navigation" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "My hours", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "My hours", exact: true }),
    ).toBeVisible();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test("company invitation signup, pending access and company approval preserve the simple three-role flow", async ({
  page,
}) => {
  const { state, writes } = await backend(page);
  await page.goto("/live/");
  await login(page, "supervisor");
  await page.goto("/live/#people");
  await act(page, "new-invitation");
  await page.locator("#email").fill("worker@example.test");
  await save(page);
  await expect(page.locator("#invitation-url")).toBeVisible();
  const link = await page.locator("#invitation-url").inputValue();
  expect(link).toContain("#join=");
  await act(page, "close");
  await act(page, "logout");
  await page.goto(link);
  await expect(page.locator("#registration-form")).toBeVisible();
  expect(page.url()).not.toContain("join=");
  await expect(
    page.locator("select[name=role],select[name=company_id]"),
  ).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator("#join-name").fill("Alex Test");
  await page.locator("#join-username").fill("alex.test");
  await page.locator("#join-password").fill("safe-password-123");
  await page.locator("#join-confirm").fill("wrong");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator("#join-confirm")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.locator("#join-confirm").fill("safe-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Verify your email" }),
  ).toBeVisible();
  expect(
    writes.find((w) => w.operation === "register_invitation").role,
  ).toBeUndefined();
  await page.getByRole("link", { name: "Go to sign in" }).click();
  await page.locator("#username").fill("alex.test");
  await page.locator("#password").fill("safe-password-123");
  await page.locator("#login-form button[type=submit]").click();
  await expect(
    page.getByRole("heading", { name: "Your account is awaiting approval" }),
  ).toBeVisible();
  await expect(page.locator(".reference-sidebar")).toHaveCount(0);
  await act(page, "logout");
  state.accountStatus = "approved";
  state.people.find((p) => p.role === "worker").account_status = "pending";
  state.people.find((p) => p.role === "worker").active = false;
  await login(page, "supervisor");
  await page.goto("/live/#people?tab=pending");
  await act(page, "account-approve");
  await save(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await act(page, "logout");
  await login(page, "alex.test");
  await expect(
    page.getByRole("heading", { name: "My work", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
});
test("invalid links fail closed and registration failures clear revealed passwords", async ({
  page,
}) => {
  const { state } = await backend(page);
  state.invitationInvalid = true;
  await page.goto("/live/#join=" + "a".repeat(64));
  await expect(
    page.getByRole("heading", { name: "Invitation unavailable" }),
  ).toBeVisible();
  await expect(page.locator("#registration-form")).toHaveCount(0);
  state.invitationInvalid = false;
  state.registrationFails = true;
  await page.goto("/live/#join=" + "b".repeat(64));
  await expect(page.locator("#registration-form")).toBeVisible();
  await page.locator("#join-name").fill("Alex");
  await page.locator("#join-username").fill("alex.test");
  await page.locator("#join-password").fill("safe-password-123");
  await page.locator("#join-confirm").fill("safe-password-123");
  await page.getByRole("button", { name: "Show passwords" }).click();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator("#join-error")).toContainText("could not complete");
  await expect(page.locator("#join-password")).toHaveValue("");
  await expect(page.locator("#join-confirm")).toHaveValue("");
  await expect(page.locator("#join-password")).toHaveAttribute(
    "type",
    "password",
  );
});
test("NPI invites the subcontractor admin, who sees assigned scope and can dispatch only its own workers", async ({
  page,
}) => {
  const { state, writes } = await backend(page);
  const scope = crypto.randomUUID(),
    contract = crypto.randomUUID();
  state.contracts = [
    { id: contract, name: "Court services", client: "Court", active: true },
  ];
  state.scopes = [
    {
      id: scope,
      contract_id: contract,
      company_id: state.companies[0].id,
      site_id: state.sites[0].id,
      active: true,
    },
  ];
  await page.goto("/live/");
  await login(page, "owner@npi.test");
  await page.goto("/live/#people");
  await act(page, "new-invitation");
  await page.locator("#email").fill("admin@example.test");
  await page.locator("#role").selectOption("sub");
  await page.locator("#company_id").selectOption(state.companies[0].id);
  await save(page);
  const link = await page.locator("#invitation-url").inputValue();
  await act(page, "close");
  await act(page, "logout");
  state.invitationRole = "sub";
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: "Set up your company account" }),
  ).toBeVisible();
  await page.locator("#join-name").fill("Company Administrator");
  await page.locator("#join-username").fill("supervisor");
  await page.locator("#join-password").fill("safe-password-123");
  await page.locator("#join-confirm").fill("safe-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Verify your email" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Go to sign in" }).click();
  await login(page, "supervisor");
  await page.goto("/live/#work");
  await act(page, "new-work");
  await page.locator("#scope_id").selectOption(scope);
  await page.locator("#planned_date").fill("2026-11-19");
  await page.locator("input[name=members]").first().check();
  await save(page);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const body = writes.find((w) => w.p_action === "create_work").p_body;
  expect(body.company_id).toBe(state.companies[0].id);
  expect(body.contract_id).toBe(contract);
  expect(body.site_id).toBe(state.sites[0].id);
  await expect(
    page.locator('a[href="#documents"],a[href="#rates"]'),
  ).toHaveCount(0);
});

test("password recovery is private and administrators cannot choose another person's password", async ({
  page,
}) => {
  await backend(page);
  await page.goto("/live/");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await page.locator("#identity-email").fill("worker@example.test");
  await page.locator("#identity-form button[type=submit]").click();
  await expect(
    page.getByRole("heading", { name: "Request received" }),
  ).toBeVisible();
  await page.goto(
    "/live/#type=recovery&access_token=test-recovery&refresh_token=private-refresh",
  );
  await page.locator("#identity-password").fill("new-private-password-123");
  await page.locator("#identity-confirm").fill("new-private-password-123");
  await page.locator("#identity-form button[type=submit]").click();
  await expect(
    page.getByRole("heading", { name: "Password updated" }),
  ).toBeVisible();
  expect(page.url()).not.toContain("access_token");
  expect(
    await page.evaluate(
      () =>
        Object.values(localStorage).join("") +
        Object.values(sessionStorage).join(""),
    ),
  ).not.toContain("new-private-password");
});
