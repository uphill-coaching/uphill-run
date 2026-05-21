// Uphill Taller — Service Worker
// Versioned cache. Bump CACHE_VERSION to force clients to refetch.
const CACHE_VERSION = 'uphill-taller-v1';

const PRECACHE_URLS = [
  './taller-coban-21k.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=League+Spartan:wght@400;600;700&display=swap',
  'https://cdn.jsdelivr.net/gh/theleagueof/norwester-fontface@master/norwester.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Cache critical assets one by one so a single failure doesn't kill install.
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { mode: 'no-cors' })).catch((err) => {
            console.warn('[SW] Precache failed:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Strategy:
// - Navigation / HTML: network-first with cache fallback (so users get updates when online).
// - Everything else (fonts, icons, css, js): cache-first with network fallback.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isHTML = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((cached) => cached || caches.match('./taller-coban-21k.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Only cache successful, basic/cors responses we can read.
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
