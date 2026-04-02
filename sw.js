// sw.js (PRODUCTION: maximum offline reliability)
const CACHE_NAME = 'tcm-pwa-v36'; // ✅ bump this on every release

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './db.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// INSTALL — precache full app shell (maximum offline reliability)
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Force bypass of browser HTTP cache during install
    await cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })));

    // Activate this SW immediately
    self.skipWaiting();
  })());
});

// Allow app.js to trigger immediate activation of new SW
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ACTIVATE — clean old caches + take control immediately
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

// FETCH — cache-first for maximum offline reliability
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // 1) Serve from cache if available
    const cached = await cache.match(req);
    if (cached) return cached;

    // 2) Otherwise fetch from network and cache it
    try {
      const fresh = await fetch(req);

      // Only cache successful same-origin responses
      if (fresh.ok && new URL(req.url).origin === self.location.origin) {
        cache.put(req, fresh.clone());
      }

      return fresh;
    } catch (err) {
      // 3) If navigation request fails (offline), serve cached app shell
      if (req.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
