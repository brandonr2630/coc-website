// COC Bible Reader — Service Worker
// Strategy:
//   App shell  → pre-cached on install
//   Local JSONs → cached on first fetch (cache-on-demand)
//   External APIs (bolls.life, fonts) → network only

const CACHE = 'coc-bible-v49';

// The page itself must cache or install fails; the rest are best-effort so one
// missing asset (e.g. a 404 after a partial deploy) cannot block the worker.
const REQUIRED = ['/bible-reader.html'];

const SHELL = [
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
];

// Never cache — requires live network
const NETWORK_ONLY = /bolls\.life|fonts\.googleapis\.com|fonts\.gstatic\.com/;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all([
        cache.addAll(REQUIRED),
        Promise.allSettled(SHELL.map(url => cache.add(url))),
      ]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Pass external API calls straight through
  if (NETWORK_ONLY.test(url.href)) return;

  // Cache-first for everything else (app shell + JSON files)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('/bible-reader.html');
        }
      });
    })
  );
});


