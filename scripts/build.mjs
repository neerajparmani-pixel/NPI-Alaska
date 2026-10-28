import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
const logo = ["npi-emblem.png", "npi-emblem.jpg", "npi-emblem.webp"].find(
  (file) => existsSync(`public/${file}`),
);
if (!logo)
  console.log(
    "Brand asset: original emblem pending; using NPI wordmark fallback.",
  );
const result = spawnSync(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "build"],
  {
    stdio: "inherit",
    env: { ...process.env, VITE_LOGO_URL: logo ? `/${logo}` : "" },
  },
);
process.exit(result.status ?? 1);
