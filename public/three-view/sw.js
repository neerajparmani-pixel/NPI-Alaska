const CACHE = "npi-three-view-v4",
  SHELL = [
    "./",
    "./index.html",
    "./style.css",
    "./fonts/body-400.woff2",
    "./fonts/body-600.woff2",
    "./fonts/body-700.woff2",
    "./app.js",
    "./workbook.js",
    "./manifest.webmanifest",
    "../operations/domain.js",
    "/icon.svg",
    "/icons/icon-192.png",
    "/icons/icon-512.png",
  ];
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("npi-three-view-") && k !== CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (
    e.request.method !== "GET" ||
    u.origin !== location.origin ||
    !SHELL.some(
      (p) => new URL(p, self.registration.scope).pathname === u.pathname,
    )
  )
    return;
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(u.origin + u.pathname).then((r) => r || Response.error()),
    ),
  );
});
