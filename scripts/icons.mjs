import { chromium } from "@playwright/test";
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
const browser = await chromium.launch(
  existsSync("/usr/bin/chromium")
    ? { executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] }
    : {},
);
try {
  const page = await browser.newPage();
  const svg = readFileSync("public/icon.svg", "utf8");
  mkdirSync("public/icons", { recursive: true });
  for (const size of [192, 512]) {
    const base64 = await page.evaluate(
      async ({ svg, size }) => {
        const image = new Image();
        image.src = "data:image/svg+xml;base64," + btoa(svg);
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#102c50";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(image, 0, 0, size, size);
        return canvas.toDataURL("image/png").split(",")[1];
      },
      { svg, size },
    );
    writeFileSync(
      `public/icons/icon-${size}.png`,
      Buffer.from(base64, "base64"),
    );
  }
  const base64 = await page.evaluate(async (svg) => {
    const image = new Image();
    image.src = "data:image/svg+xml;base64," + btoa(svg);
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#102c50";
    ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(image, 64, 64, 384, 384);
    return canvas.toDataURL("image/png").split(",")[1];
  }, svg);
  writeFileSync("public/icons/maskable-512.png", Buffer.from(base64, "base64"));
  console.log(
    "Generated NPI wordmark install icons; original winged-lion file is pending.",
  );
} finally {
  await browser.close();
}
