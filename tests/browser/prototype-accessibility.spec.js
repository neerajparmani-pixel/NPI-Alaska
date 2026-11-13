import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("sample: accessibility scan across office, worker and account dialog", async ({
  page,
}) => {
  for (const route of ["overview", "settings", "reports", "sites"]) {
    await page.goto("/sample/#" + route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
      route,
    ).toEqual([]);
  }
  await page.getByLabel("Preview role").selectOption("Worker");
  await page.locator("[data-action=start]").click();
  let results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    "worker",
  ).toEqual([]);
  await page.getByLabel("Preview role").selectOption("Management");
  await page.goto("/sample/#settings");
  await page.locator("[data-action=new-person]").click();
  results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    "account dialog",
  ).toEqual([]);
});
