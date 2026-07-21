// Bump this string on any deploy that must invalidate the SW's asset cache.
// Changing sw.js's bytes is what makes the browser install a new worker; the
// activate handler below then purges every cache except the current one. The
// app documents are kept fresh independently via Cache-Control (next.config),
// so code updates don't depend on remembering to bump this.
const CACHE = 'riichicam-v5';
const STATIC = [
  // '/' and '/score' intentionally excluded - proxy middleware handles routing and
  // may redirect these URLs. Caching redirect responses for navigation requests
  // causes "Response served by service worker has redirections" browser errors.
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
];

// The ONNX model (~77MB) is precached separately from STATIC, not added to
// it: caches.addAll() rejects the whole install if ANY one fetch fails, and
// gating the entire PWA install on one large, more failure-prone download
// would mean a flaky connection breaks icons/manifest caching too. This
// fetch runs in the background and is allowed to fail silently -- if it
// hasn't finished by the time a page requests it, the fetch handler below
// still serves it (just without the precache head start).
const MODEL_URL = '/models/tile-detector.onnx';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
  caches.open(CACHE).then((c) => c.add(MODEL_URL)).catch(() => {});
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// The ONNX model (~80MB) and the ORT wasm runtime (another ~13-27MB per
// variant) are large and effectively immutable: their URLs are fixed and their
// bytes only change on a deploy, which bumps CACHE and purges the old entry in
// activate. So once cached they never need re-fetching.
function isImmutableAsset(pathname) {
  return pathname.startsWith('/models/') || pathname.startsWith('/ort/');
}

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
  // Large immutable assets (model + ORT runtime): pure cache-first with NO
  // background revalidation. The previous stale-while-revalidate path below
  // re-fetched every asset on every request - for the 80MB model that meant a
  // full re-download on each page load, burning mobile data and, on
  // eviction-prone budget devices, turning every visit into a multi-minute
  // reload. Once cached, serve straight from cache and touch the network only
  // on a genuine miss.
  if (isImmutableAsset(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        if (cached) return cached;
        return fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }
  // Stale-while-revalidate for small static assets (icons, manifest, hashed
  // JS/CSS chunks): serve cached immediately, refresh in the background, and
  // fall back to cache if the network is unavailable.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fresh = fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
