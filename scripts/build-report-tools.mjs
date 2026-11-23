import { build } from "esbuild";
import fs from "node:fs/promises";
await fs.mkdir("public/live/vendor", { recursive: true });
await build({
  entryPoints: ["src/report-files.js"],
  outfile: "public/live/vendor/report-tools.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "linked",
});

let licenses = "Bundled report tools: licenses and source packages.\n\n";
for (const [name, file] of [
  ["fflate", "node_modules/fflate/LICENSE"],
  ["pdf-lib", "node_modules/pdf-lib/LICENSE.md"],
  ["@pdf-lib/fontkit", "src/licenses/fontkit-LICENSE.txt"],
]) {
  try {
    licenses += name + "\n" + (await fs.readFile(file, "utf8")) + "\n\n";
  } catch {
    throw Error("Missing report dependency license: " + file);
  }
}
await fs.writeFile("public/live/vendor/REPORT-TOOLS-LICENSES.txt", licenses);
