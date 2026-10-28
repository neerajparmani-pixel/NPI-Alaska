import { test, expect } from "@playwright/test";
test("company form validates, masks password and handles failure safely", async ({
  page,
}) => {
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: '{"error":"Username or password is incorrect."}',
    }),
  );
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("username");
  await expect(page.getByLabel("Username", { exact: true })).toBeFocused();
  await page.getByLabel("Username", { exact: true }).fill("worker.one");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("password");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-a-real-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("incorrect");
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
    "worker.one",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("verified account is separate from demo and does not grant unconfigured work access", async ({
  page,
}) => {
  await page.route("**/api/auth/login", (route) =>
    route.fulfill({ contentType: "application/json", body: '{"ok":true}' }),
  );
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "uid-worker",
          username: "worker.one",
          displayName: "Worker One",
        },
        workspaceReady: false,
      }),
    }),
  );
  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({ contentType: "application/json", body: '{"ok":true}' }),
  );
  await page.goto("/login");
  await page.getByLabel("Username", { exact: true }).fill("worker.one");
  await page
    .getByLabel("Password", { exact: true })
    .fill("not-a-real-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hello, Worker One." }),
  ).toBeVisible();
  await expect(
    page.getByText("Work records are not connected yet.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Demo view")).toHaveCount(0);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});
test("brand buttons have readable contrast and form has no phone overflow", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  const style = await page
    .getByRole("button", { name: "Sign in", exact: true })
    .evaluate((el) => ({
      background: getComputedStyle(el).backgroundColor,
      color: getComputedStyle(el).color,
      height: el.getBoundingClientRect().height,
    }));
  expect(style.background).toBe("rgb(24, 90, 219)");
  expect(style.color).toBe("rgb(255, 255, 255)");
  expect(style.height).toBeGreaterThanOrEqual(54);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
