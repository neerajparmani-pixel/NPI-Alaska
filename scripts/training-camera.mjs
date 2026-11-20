// Reproducible, explicitly labelled test camera. Never used in the deployed app.
import { chromium } from "playwright";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
export async function trainingCamera() {
  const file =
    process.env.NPI_TRAINING_CAMERA ||
    path.join(os.tmpdir(), "npi-training-ruler.y4m");
  if (existsSync(file)) return file;
  const browser = await chromium.launch({
    executablePath: existsSync("/usr/bin/chromium")
      ? "/usr/bin/chromium"
      : undefined,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const data = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 480;
    const x = c.getContext("2d");
    x.fillStyle = "#edf2f7";
    x.fillRect(0, 0, 640, 480);
    x.fillStyle = "#102c50";
    x.font = "bold 24px Arial";
    x.fillText("TRAINING ONLY — RULER EXAMPLE", 30, 40);
    x.fillStyle = "#e8bd57";
    x.fillRect(270, 65, 100, 350);
    x.fillStyle = "#102c50";
    for (let i = 0; i <= 5; i++) {
      x.fillRect(270, 390 - i * 60, 48, 3);
      x.fillText(String(i), 330, 398 - i * 60);
    }
    x.strokeStyle = "#2459a0";
    x.lineWidth = 5;
    x.beginPath();
    x.moveTo(25, 330);
    x.lineTo(610, 330);
    x.stroke();
    x.fillText("Example surface: 1 inch", 50, 455);
    return c.toDataURL().split(",")[1];
  });
  await browser.close();
  await fs.writeFile(file + ".png", Buffer.from(data, "base64"));
  const r = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-loop",
      "1",
      "-i",
      file + ".png",
      "-t",
      "2",
      "-r",
      "15",
      "-pix_fmt",
      "yuv420p",
      file,
    ],
    { stdio: "ignore" },
  );
  if (r.status !== 0)
    throw Error("FFmpeg is required to create the labelled training camera.");
  return file;
}
