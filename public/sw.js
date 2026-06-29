/* Detective Pulse — offline fallback service worker.
 *
 * Conservative by design: it does NOT cache HTML pages (the app is SSR/dynamic,
 * so cached pages would go stale). It only precaches a self-contained offline
 * screen and serves it when a top-level navigation fails with no network.
 * Online users always get fresh responses (network-first for navigations,
 * pass-through for everything else). */

const CACHE = "dp-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Only intercept top-level navigations: try the network, fall back to the
  // cached offline screen when the device is offline.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});
