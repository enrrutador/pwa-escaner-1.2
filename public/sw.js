const CACHE_VERSION = 'stockmaster-v4';
const STATIC_CACHE = 'stockmaster-static-v4';
const DYNAMIC_CACHE = 'stockmaster-dynamic-v4';
const IMAGE_CACHE = 'stockmaster-images-v4';
const OFFLINE_FALLBACK = '/offline.html';

const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/offline.html',
];

// Install: cache static assets + offline fallback
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== DYNAMIC_CACHE && k !== IMAGE_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API requests: network only (no cache for dynamic data)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'Sin conexión', resultados: [] }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        });
      })
    );
    return;
  }

  // Images: cache first, then network
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res && res.status === 200) {
            cache.put(request, res.clone());
          }
          return res;
        } catch {
          return new Response('', { status: 408 });
        }
      })
    );
    return;
  }

  // Navigation: network first, fallback to cache, then offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(DYNAMIC_CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match(OFFLINE_FALLBACK)))
    );
    return;
  }

  // Static assets (JS/CSS/fonts): stale-while-revalidate with long TTL
  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            cache.put(request, res.clone());
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Background sync for offline mutations (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-changes') {
    event.waitUntil(syncPendingChanges());
  }
});

async function syncPendingChanges() {
  // Placeholder for future offline mutation sync
  console.log('[SW] Background sync triggered');
}