import { test, expect } from "@playwright/test";
import { backend } from "../helpers/live-fixture.js";
const act = (p, a) => p.locator(`[data-action="${a}"]:visible`).first().click();
async function login(p, user = "alex", remember = true) {
  await p.goto("/live/");
  await p.locator("#username").fill(user);
  await p.locator("#password").fill("fictional-password-123");
  if (remember) await p.locator("[name=remember_device]").check();
  await p.locator("#login-form button[type=submit]").click();
  await expect(p.locator(".live-connection")).toBeVisible();
}
async function file(p) {
  return Buffer.from(
    await p.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 60;
      c.height = 60;
      c.getContext("2d").fillRect(0, 0, 60, 60);
      return c.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
}
test("personal-device session restores across reload and is cleared across tabs on sign-out", async ({
  page,
  context,
}) => {
  const { state } = await backend(page);
  await login(page);
  expect(
    await page.evaluate(() => Object.values(localStorage).join("")),
  ).not.toContain("fictional-password");
  await page.reload();
  await expect(page.locator(".live-connection")).toBeVisible();
  const second = await context.newPage();
  await backend(second, { sharedState: state });
  await second.goto("/live/");
  await expect(second.locator(".live-connection")).toBeVisible();
  await act(second, "logout");
  await expect(page.locator("#login-form")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).filter((k) => k.startsWith("npi-auth"))
          .length,
    ),
  ).toBe(0);
});
test("IndexedDB resumes pending uploads after reload without duplicating saved originals", async ({
  page,
}) => {
  const { state, storedFiles } = await backend(page);
  state.work[0].status = "in-progress";
  await login(page);
  await act(page, "open-work");
  await act(page, "upload");
  await page.locator("#multi-files").setInputFiles({
    name: "pending.png",
    mimeType: "image/png",
    buffer: await file(page),
  });
  await expect(page.locator(".photo-card")).toContainText(
    "Saved on this device",
  );
  let failed = false;
  await page.route("**/rpc/npi_field_action", async (r) => {
    if (!failed && r.request().postDataJSON().p_action === "evidence") {
      failed = true;
      await r.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"error":"Temporary metadata error"}',
      });
    } else await r.fallback();
  });
  await page.locator("#upload-batch").click();
  await expect(page.locator("#photo-status")).toContainText("failed");
  expect(storedFiles.size).toBe(2);
  await act(page, "close");
  await page.goto("/live/#work");
  await act(page, "visit-device");
  await expect(page.locator("#dialog")).toContainText("pending.png");
  await page.locator("#dialog [data-action=open-work]").first().click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.reload();
  await expect(page.locator(".live-connection")).toBeVisible();
  await act(page, "open-work");
  await act(page, "upload");
  await expect(page.locator(".photo-card")).toContainText(
    "Recovered on device",
  );
  await page.locator("#upload-batch").click();
  await expect(page.locator("#photo-status")).toContainText(
    "saved successfully",
  );
  expect(storedFiles.size).toBe(2);
  expect(state.evidence.length).toBe(1);
  await act(page, "close");
  await page.goto("/live/#work");
  await act(page, "visit-device");
  await expect(page.getByText("No unsent device photos.")).toBeVisible();
});
test("another account cannot see a worker pending device photo", async ({
  page,
  context,
}) => {
  const { state } = await backend(page);
  state.work[0].status = "in-progress";
  await login(page);
  await act(page, "open-work");
  await act(page, "upload");
  await page.locator("#multi-files").setInputFiles({
    name: "private-pending.png",
    mimeType: "image/png",
    buffer: await file(page),
  });
  await expect(page.locator(".photo-card")).toContainText(
    "Saved on this device",
  );
  const second = await context.newPage();
  await backend(second, { sharedState: state });
  await second.goto("/live/");
  await second.evaluate(() => localStorage.clear());
  await login(second, "supervisor", false);
  await expect(second.locator("#app")).not.toContainText("private-pending.png");
  const own = await second.evaluate(async () => {
    const { photoStore } = await import("/live/recovery.js");
    return photoStore.list("10000000-0000-0000-0000-000000000002");
  });
  expect(own.length).toBe(0);
  await expect(page.locator("#login-form")).toBeVisible();
});
test("missing backend upgrade blocks the changed workflow", async ({
  page,
}) => {
  const { state } = await backend(page);
  state.backendRelease = "3.0";
  await page.goto("/live/");
  await page.locator("#username").fill("alex");
  await page.locator("#password").fill("fictional-password");
  await page.locator("#login-form button[type=submit]").click();
  await expect(page.locator("#feedback")).toContainText("migration 008");
  await expect(page.locator("[data-action=visit-new]")).toHaveCount(0);
});
test("storage failure is explicit and never claims the photo is saved on the device", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", { value: undefined }),
  );
  const { state } = await backend(page);
  state.work[0].status = "in-progress";
  await login(page);
  await act(page, "open-work");
  await act(page, "upload");
  await page.locator("#multi-files").setInputFiles({
    name: "memory-only.png",
    mimeType: "image/png",
    buffer: await file(page),
  });
  await expect(page.locator("#photo-status")).toContainText(
    "Device recovery unavailable",
  );
  await expect(page.locator(".photo-card")).not.toContainText(
    "Saved on this device",
  );
  await act(page, "close");
  await expect(page.locator("#dialog-error")).toContainText("Unsaved changes");
});
