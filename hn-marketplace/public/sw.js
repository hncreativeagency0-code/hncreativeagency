/* HN Creative Agency service worker — makes the site installable and fast on repeat visits.
   Strategy: network-first for pages (always fresh), cache-first for hashed build assets,
   never caches API/Supabase traffic. Bump VERSION to force an update. */
const VERSION = 'hn-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/offline.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // Supabase, fonts, analytics: straight to network
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('/', copy)); return res; })
      .catch(() => caches.match('/').then((r) => r || caches.match('/offline.html'))));
    return;
  }
  if (url.pathname.startsWith('/assets/') || /\.(png|jpg|jpeg|webp|svg|woff2?)$/.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    })));
  }
});
