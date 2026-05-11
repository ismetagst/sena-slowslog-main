const CACHE_NAME = 'sena-v7';
const PRECACHE = ['/favicon.ico'];

const STATIC_DESTINATIONS = new Set(['style', 'font', 'image']);

const isStaticAssetRequest = (request, url) => {
  // Never cache JS/HTML/JSON — these change on every deploy and must be fresh.
  if (request.destination === 'script' || request.destination === 'document') return false;
  if (STATIC_DESTINATIONS.has(request.destination)) return true;
  return (
    url.pathname.startsWith('/assets/') && /\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/i.test(url.pathname)
  ) || /\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$/i.test(url.pathname);
};

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
      // Reload is handled by `controllerchange` listener on the client side
      // to avoid double-navigation races.
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('/~oauth')) return;

  const url = new URL(e.request.url);

  // Never cache backend/API or third-party requests.
  if (url.origin !== self.location.origin) return;

  // Always fetch documents, scripts, JSON, and manifest fresh (network-only).
  if (
    e.request.mode === 'navigate' ||
    e.request.destination === 'document' ||
    e.request.destination === 'script' ||
    url.pathname === '/manifest.json' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.json')
  ) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // Only cache immutable static assets (images, fonts).
  if (!isStaticAssetRequest(e.request, url)) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (!res || !res.ok) return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return res;
      });
    })
  );
});
