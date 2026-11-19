import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const html = await fs.readFile("downloads/NPI-Three-View-Sample.html", "utf8");
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
for (const [device, width, height] of [
  ["desktop", 1440, 1000],
  ["phone", 390, 844],
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("http://artwork-preview.test/**", (r) =>
    r.fulfill({ contentType: "text/html", body: html }),
  );
  await page.goto("http://artwork-preview.test/");
  await page.locator(".login-emblem img").waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `docs/three-view/artwork-welcome-${device}.png`,
    fullPage: true,
  });
  await page.locator("[data-action=role][data-id=npi]").click();
  await page.evaluate(() => (location.hash = "sites"));
  await page.locator(".sitephoto img").first().waitFor();
  await page.evaluate(() =>
    Promise.all([...document.images].map((i) => i.decode().catch(() => {}))),
  );
  await page.screenshot({
    path: `docs/three-view/artwork-sites-${device}.png`,
    fullPage: true,
  });
  await page.locator("#preview-role").selectOption("worker");
  await page.evaluate(() => (location.hash = "orders"));
  await page.locator(".has-site-photo img").first().waitFor();
  await page.screenshot({
    path: `docs/three-view/artwork-worker-${device}.png`,
    fullPage: true,
  });
  if (errors.length) throw Error(errors.join("\n"));
  await page.close();
}
const board = await browser.newPage({
  viewport: { width: 1440, height: 1120 },
});
const shot = async (name) =>
  "data:image/png;base64," +
  (await fs.readFile(`docs/three-view/${name}.png`)).toString("base64");
await board.setContent(
  `<html><head><style>body{margin:0;padding:28px;box-sizing:border-box;background:#e9eff5;color:#19324d;font:18px system-ui}h1{font-size:28px;margin:0 0 8px}p{margin:0 0 20px;color:#50657b}.grid{display:grid;grid-template-columns:870px 480px;gap:24px}.panel{background:white;padding:12px;border-radius:12px;box-shadow:0 2px 12px #10243c15}h2{font-size:17px;margin:0 0 10px}.gallery{width:846px;height:auto;display:block}.welcome{width:456px;display:block}.phone-window{height:530px;overflow:hidden;width:245px;border:7px solid #10243c;border-radius:18px;margin:auto}.phone-window img{width:245px;display:block}.right{display:flex;flex-direction:column;gap:20px}</style></head><body><h1>Alaska NPI · Embedded site photos & selected emblem</h1><p>Actual app screenshots. Original site photos preserved; emblem displayed from the supplied desktop reference.</p><div class="grid"><section class="panel"><h2>Site gallery · Boney, Nesbit, Snowden & Youth Court</h2><img class="gallery" src="${await shot("artwork-sites-desktop")}"></section><div class="right"><section class="panel"><h2>Desktop welcome</h2><img class="welcome" src="${await shot("artwork-welcome-desktop")}"></section><section class="panel"><h2>Worker phone view</h2><div class="phone-window"><img src="${await shot("artwork-worker-phone")}"></div></section></div></div></body></html>`,
);
await board.evaluate(() =>
  Promise.all([...document.images].map((i) => i.decode())),
);
await board.screenshot({
  path: "downloads/NPI-Image-Preview.png",
  fullPage: true,
});
await board.close();
await browser.close();
console.log(
  "Captured welcome, site gallery and worker screens on desktop and phone.",
);
