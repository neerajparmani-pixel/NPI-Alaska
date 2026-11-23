const CACHE = "npi-live-v3.2.0";
const ESSENTIALS = [
  "./",
  "./index.html",
  "./app.js",
  "./api.js",
  "./recovery.js",
  "./field.js",
  "./visits.js",
  "./field-domain.js",
  "./photos.js",
  "./enrollment.js",
  "./accounts.js",
  "./reports.js",
  "./config.js",
  "./style.css",
  "../three-view/style.css",
  "../three-view/assets.js",
  "../three-view/icons.js",
];
const OPTIONAL = [
  "./brand-logo.webp",
  "./icon-192.png",
  "./icon-512.png",
  "./manifest.webmanifest",
  "../three-view/assets/boney.jpg",
  "../three-view/assets/nesbit.jpg",
  "../three-view/assets/snowden.jpg",
  "../three-view/assets/youth.jpg",
  "../three-view/fonts/body-400.woff2",
  "../three-view/fonts/body-600.woff2",
  "../three-view/fonts/body-700.woff2",
];
const LAZY = [
  "./vendor/image-decoders.js",
  "./vendor/report-tools.js",
  "./vendor/report-font.ttf",
];
self.addEventListener("install", (e) =>
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      try {
        await c.addAll(ESSENTIALS);
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
      await Promise.allSettled(OPTIONAL.map((p) => c.add(p)));
    })(),
  ),
);
self.addEventListener("message", (e) => {
  if (e.data?.type === "APPLY_UPDATE") self.skipWaiting();
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      await Promise.all(
        (await caches.keys())
          .filter((k) => k.startsWith("npi-live-") && k !== CACHE)
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
    ![...ESSENTIALS, ...OPTIONAL, ...LAZY].some(
      (p) => new URL(p, self.registration.scope).pathname === u.pathname,
    )
  )
    return;
  e.respondWith(
    (async () => {
      try {
        const response = await fetch(e.request);
        if (response.ok) {
          const c = await caches.open(CACHE);
          await c.put(u.origin + u.pathname, response.clone());
        }
        return response;
      } catch {
        return (await caches.match(u.origin + u.pathname)) || Response.error();
      }
    })(),
  );
});
