const VERSION = "v1";
const CACHE_PREFIX = "clearroad-";
const STATIC_CACHE = `${CACHE_PREFIX}static-${VERSION}`;
const PAGES_CACHE = `${CACHE_PREFIX}pages-${VERSION}`;
const IMAGES_CACHE = `${CACHE_PREFIX}images-${VERSION}`;
const ALL_CACHES = [STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE];

// Small static app shell only. Pages are auth-guarded (an install-time fetch
// would cache a login redirect) and the ~850 sign/question images are too
// heavy for an atomic addAll — both are runtime-cached in fetch instead.
const PRECACHE_URLS = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/favicon-512.png",
  "/placeholder.svg",
  "/js/auth.js",
  "/js/exam.js",
  "/js/flashcard.js",
  "/js/more.js",
  "/js/push.js",
  "/js/quiz.js",
  "/js/schedule.js",
];

function cacheable(response) {
  return (
    !!response && response.ok && !response.redirected && response.type === "basic"
  );
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (cacheable(response)) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (cacheable(response)) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (cacheable(response)) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || network.then((response) => response || Response.error());
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !ALL_CACHES.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", function (event) {
  const { request } = event;
  const url = new URL(request.url);

  // Same-origin GETs only — Supabase, analytics, and mutations go straight
  // to the network.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;
  // RSC payloads are per-session streams; caching them serves stale UI state.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES_CACHE));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }
  if (url.pathname.startsWith("/signs/") || url.pathname.startsWith("/questions/")) {
    event.respondWith(cacheFirst(request, IMAGES_CACHE));
    return;
  }
  if (
    url.pathname.startsWith("/js/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/placeholder.svg" ||
    url.pathname === "/favicon-512.png"
  ) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});

self.addEventListener("push", function (event) {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "ClearRoad", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clientList) {
        const url = event.notification.data.url;
        for (const client of clientList) {
          if (client.url === url && "focus" in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
