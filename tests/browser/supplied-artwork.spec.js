import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
test("supplied logo reference and all four site photographs render without uploads", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/three-view/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator(".login-emblem .brand-photo img")).toHaveAttribute(
    "src",
    "./assets/logo-reference.jpg",
  );
  await page.locator("[data-action=role][data-id=npi]").click();
  await page.goto("/three-view/#sites");
  for (const name of ["boney", "nesbit", "snowden", "youth"]) {
    const img = page.locator(`.sitephoto img[src="./assets/${name}.jpg"]`);
    await expect(img).toBeVisible();
    expect(await img.evaluate((e) => e.complete && e.naturalWidth > 0)).toBe(
      true,
    );
  }
  await expect(
    page.getByText("Actual photos are not embedded", { exact: false }),
  ).toHaveCount(0);
  await page.locator('[data-action="photo-view"][data-id="nesbit"]').click();
  await expect(page.locator(".site-photo-full")).toHaveAttribute(
    "src",
    "./assets/nesbit.jpg",
  );
  await page.locator("#dialog [data-action=close]").last().click();
  expect(errors).toEqual([]);
});
test("standalone file embeds original photographs and preserves a custom logo selection", async ({
  page,
}) => {
  const html = await fs.readFile(
    "downloads/NPI-Three-View-Sample.html",
    "utf8",
  );
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("http://embedded-npi.test/**", (r) =>
    r.fulfill({ contentType: "text/html", body: html }),
  );
  await page.goto("http://embedded-npi.test/");
  const mark = page.locator(".login-emblem .brand-photo img");
  await expect(mark).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
  expect(
    await mark.evaluate((e) => e.complete && e.naturalWidth === 1024),
  ).toBe(true);
  await page.locator("[data-action=role][data-id=npi]").click();
  await page.evaluate(() => (location.hash = "sites"));
  await expect(page.locator(".sitephoto img")).toHaveCount(4);
  for (const img of await page.locator(".sitephoto img").all())
    await expect(img).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
  const custom =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";
  await page.evaluate(() => (location.hash = "settings"));
  await page.locator("[data-brand-logo]").setInputFiles({
    name: "custom.png",
    mimeType: "image/png",
    buffer: Buffer.from(custom.split(",")[1], "base64"),
  });
  await expect(page.locator(".brand-image.sidebar")).toHaveAttribute(
    "src",
    custom,
  );
  await page.reload();
  await expect(page.locator(".brand-image.sidebar")).toHaveAttribute(
    "src",
    custom,
  );
  expect(errors).toEqual([]);
});
