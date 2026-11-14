const CACHE = "npi-three-view-v3",
  SHELL = [
    "./",
    "./index.html",
    "./style.css",
    "./fonts/body-400.woff2",
    "./fonts/body-600.woff2",
    "./fonts/body-700.woff2",
    "./app.js",
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
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
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
