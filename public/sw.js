/* Service worker: makes hmm. installable and opens instantly/offline.
   App shell = cache-first. /api/* (AI + data) is never cached — always goes to the network. */
const VERSION = "hmm-v7";
const SHELL = [
  "/", "/index.html", "/manifest.webmanifest",
  "/styles/tokens.css", "/styles/base.css", "/styles/chameleon.css",
  "/js/app.js", "/js/chameleon/chameleon.js", "/js/chameleon/pet.js",
  "/js/screens/home.js", "/js/screens/chameleon-playground.js", "/js/ui/icons.js", "/js/screens/session.js", "/js/engine/engine.js", "/js/store.js", "/js/db.js", "/js/screens/login.js", "/js/screens/courses.js", "/js/screens/snapshot.js", "/js/screens/reflect.js", "/js/screens/profile.js", "/js/screens/professor.js", "/js/screens/admin.js", "/vendor/supabase.js",
  "/fonts/newsreader-latin-wght-normal.woff2", "/fonts/newsreader-latin-wght-italic.woff2",
  "/fonts/inter-latin-wght-normal.woff2", "/fonts/pixelify-sans-latin-700-normal.woff2",
  "/icons/icon-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match("/index.html")))
  );
});
