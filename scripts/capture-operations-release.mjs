// Local screenshots use intercepted provider responses and fictional identities only.
import { chromium } from "playwright";
import { backend, u } from "../tests/helpers/live-fixture.js";
import { mkdir } from "node:fs/promises";
await mkdir("docs/operations-release", { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
for (const [name, width, height, user, route] of [
  ["01-owner-overview", 1440, 1000, "owner@npi.test", "overview"],
  ["02-company-team", 1440, 1000, "supervisor", "people"],
  ["03-worker-phone", 390, 844, "alex", "work"],
  ["04-worker-signup", 390, 844, null, "signup"],
  ["05-admin-contracts", 1440, 1000, "owner@npi.test", "contracts"],
  ["06-owner-phone", 390, 844, "owner@npi.test", "overview"],
]) {
  const context = await browser.newContext({ viewport: { width, height } }),
    page = await context.newPage();
  const { state } = await backend(page);
  state.people.find((p) => p.id === u.npi).display_name = "NPI Administrator";
  state.people.find((p) => p.id === u.sub).display_name =
    "Company Administrator";
  state.people.find((p) => p.id === u.worker).display_name = "Alex Morgan";
  state.companies[0].name = "Example subcontractor";
  state.contracts = [
    {
      id: "60000000-0000-0000-0000-000000000001",
      name: "Example court services",
      client: "Example customer",
      reference: "Review only",
      active: true,
    },
  ];
  state.scopes = [
    {
      id: "70000000-0000-0000-0000-000000000001",
      contract_id: state.contracts[0].id,
      company_id: state.companies[0].id,
      site_id: state.sites[0].id,
      active: true,
    },
  ];
  await page.goto(
    "http://127.0.0.1:5173/live/" +
      (route === "signup" ? "#join=" + "a".repeat(64) : ""),
  );
  if (user) {
    await page.locator("#username").fill(user);
    await page.locator("#password").fill("fictional-pass-123");
    await page.locator("#login-form button[type=submit]").click();
    await page.locator(".live-connection").waitFor();
    await page.goto("http://127.0.0.1:5173/live/#" + route);
    await page.waitForFunction(
      () => !document.querySelector('button[data-action="refresh"]:disabled'),
    );
  } else await page.locator("#registration-form").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `docs/operations-release/${name}.png`,
    fullPage: true,
  });
  await context.close();
}
await browser.close();
