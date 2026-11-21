/* Offline support: network first, cached copy when offline. Bump VERSION on every publish.
   Cache names MUST start with this app's PREFIX: all isaymotion apps share one origin and one cache storage. */
const PREFIX = "little-garden-";
const VERSION = PREFIX + "2.4.2";
const CORE = ["./", "./index.html", "./styles.css", "./app.js", "./data/app-meta.js", "./data/changelog.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/apple-touch-icon.png", "./icons/favicon-32.png", "./app-icon.png", "./welcome-banner.jpg"];
self.addEventListener("install", (event) => {
  // add() one by one so a single missing file cannot make the whole install fail
  event.waitUntil(caches.open(VERSION).then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      // Only delete this app's own old caches: the other apps on isaymotion.github.io share this cache storage.
      .then((keys) => Promise.all(keys.filter((k) => k.indexOf(PREFIX) === 0 && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    // no-cache: always ask the server, so Safari's own saved copy can never hold back an update
    fetch(req, {cache: "no-cache"})
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});
