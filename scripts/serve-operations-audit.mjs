// Local static audit server applies the same CSP as the deploy package.
import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve("public");
const headers = await fs.readFile("public/_headers", "utf8");
const csp = headers.match(/Content-Security-Policy: (.*)/)[1];
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
};
http
  .createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (pathname.endsWith("/")) pathname += "index.html";
      const file = path.resolve(root, "." + pathname);
      if (!file.startsWith(root + path.sep)) throw Error();
      const content = await fs.readFile(file);
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
        "Content-Security-Policy": csp,
        "Permissions-Policy":
          "geolocation=(self), camera=(self), microphone=()",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(5175, "127.0.0.1", () =>
    console.log("Operations static audit server http://127.0.0.1:5175"),
  );
