const CACHE = "npi-live-v3";
const SHELL = [
  "./",
  "./index.html",
  "./app.js",
  "./api.js",
  "./enrollment.js",
  "./config.js",
  "./style.css",
  "./manifest.webmanifest",
  "../three-view/style.css",
  "../three-view/assets.js",
  "../three-view/icons.js",
  "../three-view/assets/logo-transparent.png",
  "../three-view/assets/boney.jpg",
  "../three-view/assets/nesbit.jpg",
  "../three-view/assets/snowden.jpg",
  "../three-view/assets/youth.jpg",
  "../three-view/fonts/body-400.woff2",
  "../three-view/fonts/body-600.woff2",
  "../three-view/fonts/body-700.woff2",
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
            .filter((k) => k.startsWith("npi-live-") && k !== CACHE)
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
