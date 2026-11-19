import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("private local rates: validation, calculate, edit, persistence and role boundaries", async ({
  page,
}) => {
  await page.goto("/three-view/");
  await page.evaluate(() => localStorage.removeItem("npi-three-view-v1"));
  await page.reload();
  await page.goto("/three-view/#settings");
  await page.locator("[data-action=new-rate]").click();
  await page.locator("#rate-form button[type=submit]").click();
  await expect(page.locator("#rate-amount")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.locator("#rate-task").fill("Snow clearing");
  await page.locator("#rate-amount").fill("25.99");
  await page.locator("#rate-from").fill("2026-11-01");
  await page.locator("#rate-form button[type=submit]").click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("$25.99", { exact: false })).toBeVisible();
  await page.locator("[data-action=calculate-rate]").click();
  await page.locator("#rate-quantity").fill("1.75");
  await page.locator("#rate-calculator button[type=submit]").click();
  await expect(page.locator("#rate-total")).toContainText("$45.48");
  await page.locator("#dialog [data-action=close]").last().click();
  await page.locator("[data-action=edit-rate]").click();
  await page.locator("#rate-amount").fill("26.00");
  await page.locator("#rate-form button[type=submit]").click();
  await page.reload();
  await page.goto("/three-view/#settings");
  await expect(page.getByText("$26.00", { exact: false })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-action=export-rates]").click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "NPI-private-rates.csv",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator("#preview-role").selectOption("sub");
  await page.goto("/three-view/#settings");
  await expect(page.locator("[data-action=new-rate]")).toHaveCount(0);
  await expect(page.getByText("$26.00")).toHaveCount(0);
});
