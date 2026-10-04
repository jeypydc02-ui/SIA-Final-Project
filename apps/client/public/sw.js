// FinTrack Stark service worker.
//
// What it caches, and why:
//   - the app shell (the page, its built JS/CSS, icons), so the app opens
//     instantly and still opens with no connection;
//   - never anything under /api/. That is people's financial data and their
//     session; it must always come fresh from the server and must not be left
//     behind on a shared device.
//
// Bump VERSION when this file's caching rules change; old caches are removed
// when the new worker activates.
const VERSION = "v1";
const CACHE = "fts-shell-" + VERSION;
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("fts-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // always network, never cached

  // Pages: try the network so a new deploy shows up at once; if offline, fall
  // back to the cached shell (every route is the same single-page app).
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put("/", copy));
          }
          return res;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Built assets have content hashes in their names, so a cached copy is
  // never stale: serve from cache, fetch and keep it the first time.
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
      )
    );
  }
});
