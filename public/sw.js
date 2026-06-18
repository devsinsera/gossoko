// Gossoko — service worker
// Strategy:
//   • Cache-first for hashed static assets (/_next/static, icons, fonts)
//   • Network-first with cache fallback for HTML navigations
//   • Offline fallback to the cached "/" feed when navigation network fails
//
// Bump CACHE_VERSION whenever the cache shape changes — old caches are
// purged on activate.

const CACHE_VERSION = 'gossoko-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Routes that should be available offline after first visit.
const PRECACHE_ROUTES = [
  '/',
  '/nearby',
  '/rankings',
  '/profile',
  '/search',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      // Pre-warm a few routes so the app is usable offline after first visit.
      // Failures are non-fatal — install must not block on a flaky network.
      await Promise.allSettled(
        PRECACHE_ROUTES.map((url) =>
          fetch(url, { credentials: 'same-origin' })
            .then((res) => res.ok && cache.put(url, res.clone()))
            .catch(() => undefined),
        ),
      );
      self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      ).then(() => self.clients.claim()),
    ),
  );
});

// Don't intercept anything except same-origin GETs.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Skip Next.js HMR / dev-only paths to avoid masking dev errors.
  if (url.pathname.startsWith('/_next/webpack-hmr')) return;
  if (url.pathname.startsWith('/__nextjs')) return;

  // Static, hashed Next.js assets → cache-first.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icon') ||
    url.pathname.startsWith('/apple-icon')
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Manifest is small and rarely changes — cache-first is fine.
  if (url.pathname === '/manifest.webmanifest' || url.pathname === '/manifest.json') {
    event.respondWith(cacheFirst(req));
    return;
  }

  // HTML navigations → network-first, fall back to cache, then to "/" page.
  const accept = req.headers.get('accept') || '';
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    event.respondWith(networkFirstNavigation(req));
    return;
  }

  // Everything else (images, JSON, etc.) → stale-while-revalidate.
  event.respondWith(staleWhileRevalidate(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function networkFirstNavigation(req) {
  const runtime = await caches.open(RUNTIME_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) runtime.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await runtime.match(req);
    if (cached) return cached;
    // Last resort — serve the cached home feed so the user lands somewhere.
    const fallback = await caches.match('/');
    if (fallback) return fallback;
    return new Response(OFFLINE_HTML, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

// Inline minimal offline page — used only when the user is offline AND
// has nothing cached yet (e.g., first launch with no network).
const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Gossoko — Offline</title>
<style>
  html, body { margin: 0; height: 100%; background: #0a0908; color: #f5f1ec; font-family: system-ui, -apple-system, sans-serif; }
  body { display: flex; align-items: center; justify-content: center; padding: 24px; }
  .wrap { max-width: 320px; text-align: center; }
  .hazard { height: 6px; border-radius: 2px;
            background: repeating-linear-gradient(135deg, #FF7A00 0 10px, #111 10px 20px);
            margin-bottom: 24px; }
  h1 { font-size: 1.6rem; text-transform: uppercase; letter-spacing: 0.02em; margin: 0 0 8px; color: #FF7A00; }
  p  { color: #a89e92; font-size: 14px; line-height: 1.5; margin: 0 0 18px; }
  button { font: inherit; background: #FF7A00; color: #0a0908; border: 0;
           padding: 12px 18px; border-radius: 8px; font-weight: 700;
           letter-spacing: 0.1em; text-transform: uppercase; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="hazard"></div>
    <h1>Off The Grid</h1>
    <p>No signal — can't reach Gossoko right now. Visit again once you're back on a connection.</p>
    <button onclick="location.reload()">Try again</button>
  </div>
</body>
</html>`;
