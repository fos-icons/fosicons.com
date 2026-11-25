// Fos Icons service worker: makes the site installable and fast on
// repeat visits, and keeps it usable offline.
//
// - Pages: network first, falling back to the cached copy offline.
// - /assets/ and /icon-artwork/: cache first for build- or library-versioned assets.
// - Public SVG links and other data (/svg/, /brands/, modifiers.json, app images):
//   served from cache immediately and refreshed in the background.
// Nothing personal is cached: the site has no accounts or user data.
const VERSION = 'v1';
const PAGES = `pages-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const DATA = `data-${VERSION}`;
const KEEP = [PAGES, ASSETS, DATA];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(PAGES).then((cache) => cache.addAll(['/', '/docs/', '/404.html'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => !KEEP.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) ?? (await cache.match('/')) ?? Response.error();
  }
}

// Only keep real files: a server's HTML fallback for a missing asset would
// otherwise be served in place of the script or data until the next deploy.
const cacheable = (response) => response.ok && !(response.headers.get('content-type') ?? '').includes('text/html');

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (cacheable(response)) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(DATA);
  const hit = await cache.match(request);
  const refresh = fetch(request).then((response) => {
    if (cacheable(response)) cache.put(request, response.clone());
    return response;
  });
  if (hit) {
    event.waitUntil(refresh.catch(() => undefined));
    return hit;
  }
  return refresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icon-artwork/')) {
    event.respondWith(cacheFirst(request));
  } else if (/^\/(svg|brands|app|licenses)(\/|$)|^\/(modifiers\.json|og-image\.png|apple-touch-icon\.png|favicon\.svg)$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});
