const CACHE = "npi-operations-v2",
  SHELL = [
    "./",
    "./index.html",
    "./operations.js",
    "./domain.js",
    "./manifest.webmanifest",
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
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("npi-operations-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
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
