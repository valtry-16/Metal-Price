const CACHE_NAME = "metal-price-tracker-v1";
const STATIC_ASSETS = [
  "/index.html",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

// Install event - cache essential files
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching static assets");
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("[Service Worker] Some assets failed to cache:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[Service Worker] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip API requests (let them go to network)
  if (url.pathname.startsWith("/api") || url.hostname !== self.location.hostname) {
    return;
  }

  // For HTML and assets, try network first, fall back to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok && request.method === "GET") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fall back to cache if network fails
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return offline page or placeholder
          if (request.destination === "document") {
            return caches.match("/index.html");
          }
        });
      })
  );
});

// Handle messages from the app
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Push notification event
self.addEventListener("push", (event) => {
  let data = { title: "Auric Ledger", body: "Metal prices updated!" };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    // use defaults
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Auric Ledger", {
      body: data.body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      data: { url: data.url || "/market" }
    })
  );
});

// Notification click – open or focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/market";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).pathname === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
