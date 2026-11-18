import { test, expect } from "@playwright/test";
const action = (p, a, id) =>
  p
    .locator(`[data-action="${a}"]${id ? '[data-id="' + id + '"]' : ""}`)
    .first()
    .click();
const fresh = async (p) => {
  await p.goto("/three-view/");
  await p.evaluate(() => localStorage.removeItem("npi-three-view-v1"));
  await p.reload();
};
const state = (p) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("npi-three-view-v1")));
test("one test transaction completes worker, company and NPI review without duplicate creation", async ({
  page,
}) => {
  await fresh(page);
  await action(page, "test-transaction");
  let s = await state(page);
  const id = s.testTransactionId;
  expect(s.jobs.filter((j) => j.testRecord)).toHaveLength(1);
  expect(id).toBe("DEMO-105");
  await expect(page.locator("body")).toHaveAttribute("data-role", "worker");
  await action(page, "capture-in");
  await expect(page.locator("[data-action=capture-confirm]")).toBeDisabled();
  await action(page, "example-gps");
  await action(page, "capture-confirm");
  for (const task of await page.locator("[data-task]").all())
    await task.check();
  await action(page, "example-photo");
  await action(page, "capture-out");
  await expect(page.locator("[data-action=capture-confirm]")).toBeDisabled();
  await action(page, "example-gps");
  await page.getByLabel("Break minutes for this interval").fill("15");
  await action(page, "capture-confirm");
  await action(page, "claim");
  await page.locator("#claim-form button[type=submit]").click();
  await action(page, "test-stage", "sub");
  await action(page, "company-approve", id);
  await action(page, "test-stage", "npi");
  await action(page, "npi-approve", id);
  await page.locator("#verify-form button[type=submit]").click();
  s = await state(page);
  const j = s.jobs.find((j) => j.id === id);
  expect(j.status).toBe("approved");
  expect(j.acceptedHours).toBe(1.75);
  expect(j.sessions[0].in.source).toBe("Example GPS");
  expect(j.sessions[0].out.source).toBe("Example GPS");
  await action(page, "test-transaction");
  expect((await state(page)).jobs.filter((j) => j.testRecord)).toHaveLength(1);
});
// Synthetic bytes exercise the clipboard transfer boundary; they are never shipped as branding.
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";
async function pasteImage(page) {
  await page.evaluate((data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)),
      transfer = new DataTransfer();
    transfer.items.add(
      new File([bytes], "clipboard.png", { type: "image/png" }),
    );
    document
      .querySelector("#image-paste-zone")
      .dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, clipboardData: transfer }),
      );
  }, png);
}
test("pasted original logo and separate site image are saved and rendered unchanged", async ({
  page,
}) => {
  await fresh(page);
  await action(page, "paste-image", "logo");
  await pasteImage(page);
  await expect(page.locator(".login-emblem img")).toHaveAttribute(
    "src",
    "data:image/png;base64," + png,
  );
  await action(page, "role", "npi");
  await page.goto("/three-view/#sites");
  await action(page, "paste-image", "boney");
  await pasteImage(page);
  const s = await state(page);
  expect(s.brandLogo).toBe("data:image/png;base64," + png);
  expect(s.sites.find((x) => x.id === "boney").photo).toBe(
    "data:image/png;base64," + png,
  );
  expect(s.sites.find((x) => x.id === "nesbit").photo).toBe("");
  await page.locator("#preview-role").selectOption("worker");
  await expect(page.locator(".has-site-photo img").first()).toHaveAttribute(
    "src",
    "data:image/png;base64," + png,
  );
});
test("image paste rejects text-only clipboard with actionable recovery", async ({
  page,
}) => {
  await fresh(page);
  await action(page, "paste-image", "logo");
  await page.locator("#image-paste-zone").evaluate((el) => {
    const transfer = new DataTransfer();
    transfer.setData("text/plain", "https://example.com/logo.png");
    el.dispatchEvent(
      new ClipboardEvent("paste", { bubbles: true, clipboardData: transfer }),
    );
  });
  await expect(page.locator("#dialog-error")).toContainText("Copy image");
  await expect(page.locator("#dialog")).toBeVisible();
});

test("original clipboard images above the JSON limit persist in image storage across reload", async ({
  page,
}) => {
  await fresh(page);
  await action(page, "paste-image", "logo");
  await page.evaluate((data) => {
    const header = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const bytes = new Uint8Array(650000);
    bytes.set(header);
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([bytes], "large-original.png", { type: "image/png" }),
    );
    document
      .querySelector("#image-paste-zone")
      .dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, clipboardData: transfer }),
      );
  }, png);
  await expect(page.locator(".login-emblem img")).toBeVisible();
  const s = await state(page);
  expect(s.brandLogo).toMatch(/^npi-artwork:/);
  await page.reload();
  await expect(page.locator(".login-emblem img")).toHaveAttribute(
    "src",
    /^data:image\/png;base64,/,
  );
  expect(
    await page.locator(".login-emblem img").evaluate((img) => img.naturalWidth),
  ).toBe(1);
});

test("personalized download embeds artwork but excludes entered credentials and live work records", async ({
  page,
}) => {
  const fs = await import("node:fs/promises");
  const template = await fs.readFile(
    new URL("../../downloads/NPI-Three-View-Sample.html", import.meta.url),
    "utf8",
  );
  // Serve the exact packaged bytes: Vite otherwise converts inline modules into dev-only proxy scripts.
  await page.route("**/downloads/NPI-Three-View-Sample.html", (route) =>
    route.fulfill({ contentType: "text/html", body: template }),
  );
  await page.goto("/downloads/NPI-Three-View-Sample.html");
  await page.evaluate(() => localStorage.removeItem("npi-three-view-v1"));
  await page.reload();
  await page.locator("#login-password").fill("NEVER-EXPORT-THIS-PASSWORD");
  await action(page, "paste-image", "logo");
  await pasteImage(page);
  await action(page, "role", "npi");
  await page.evaluate(() => {
    const key = "npi-three-view-v1",
      s = JSON.parse(localStorage.getItem(key));
    s.jobs[0].title = "NEVER-EXPORT-THIS-WORK";
    localStorage.setItem(key, JSON.stringify(s));
  });
  await page.goto("/downloads/NPI-Three-View-Sample.html#settings");
  const downloaded = page.waitForEvent("download");
  await action(page, "export-personalized");
  const download = await downloaded;
  const html = await fs.readFile(await download.path(), "utf8");
  expect(html).toContain("npi-sample-assets");
  expect(html).toContain("data:image/png;base64," + png);
  expect(html).not.toContain("NEVER-EXPORT-THIS-PASSWORD");
  expect(html).not.toContain("NEVER-EXPORT-THIS-WORK");
});
