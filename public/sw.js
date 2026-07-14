const CACHE = 'riichicam-v3';
const STATIC = [
  // '/' and '/score' intentionally excluded - proxy middleware handles routing and
  // may redirect these URLs. Caching redirect responses for navigation requests
  // causes "Response served by service worker has redirections" browser errors.
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Never intercept navigation requests - the proxy middleware may redirect them,
  // and browsers reject redirect responses from service workers for navigations.
  if (e.request.mode === 'navigate') return;
  const url = new URL(e.request.url);
  // Network-first for API routes
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('Offline', { status: 503 })));
    return;
  }
  // Cache-first for everything else (static assets, icons, etc.)
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
      return cached || fresh;
    })
  );
});
