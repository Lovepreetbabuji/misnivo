// DareMarket service worker — offline app shell.
// Purpose: offline/refresh must never break the UI (icon font, css, js, page).
// Data comes from Firestore's own offline cache; videos are never cached here.
//
// VER MUST be bumped with the ?v= cache-buster in index.html. A stale VER means
// the activate step deletes nothing, so every version of css/js ever fetched
// stays in the cache — and the offline fallback can then pair an old cached
// index.html with the old assets it points at, rendering a UI from months ago.
const VER = 'dm-shell-20260812k';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Whatever the fresh page no longer points at is dead weight that the offline
// fallback could otherwise resurrect. Prune on every successful navigation, so
// the cache self-heals even if VER was forgotten.
async function _prune(html) {
  const cache = await caches.open(VER);
  const keys = await cache.keys();
  await Promise.all(keys.map(k => {
    const u = new URL(k.url);
    if (u.origin !== self.location.origin) return;
    if (!(u.pathname.startsWith('/css/') || u.pathname.startsWith('/js/'))) return;
    if (html.indexOf(u.pathname + u.search) !== -1) return;   // still referenced
    return cache.delete(k);
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never intercept: Firebase/auth traffic, Cloudinary video streams/manifests
  if (url.hostname.includes('firestore') || (url.hostname.includes('googleapis.com') && !url.hostname.startsWith('fonts.'))) return;
  if (url.pathname.includes('/video/upload/')) return;

  const sameOrigin = url.origin === self.location.origin;
  const isShell = sameOrigin && (
    url.pathname === '/' || url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/') ||
    url.pathname.endsWith('.webmanifest') || url.pathname.endsWith('.svg')
  );
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  // SPA navigations: network first, offline → cached shell
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const forCache = r.clone();
        r.clone().text()
          .then(html => caches.open(VER).then(c => c.put('/', forCache)).then(() => _prune(html)))
          .catch(() => {});
        return r;
      }).catch(() => caches.match('/'))
    );
    return;
  }

  // Fonts (icon font included): cache-first — immutable in practice
  if (isFont) {
    e.respondWith(
      caches.open(VER).then(async c => {
        const hit = await c.match(req);
        if (hit) return hit;
        const r = await fetch(req);
        if (r.ok || r.type === 'opaque') c.put(req, r.clone());
        return r;
      })
    );
    return;
  }

  // App shell (css/js/manifest/icon): stale-while-revalidate. Safe because these
  // URLs carry ?v= — a new build is a new URL, so it can never be served stale.
  if (isShell) {
    e.respondWith(
      caches.open(VER).then(async c => {
        const hit = await c.match(req);
        const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
        return hit || net.then(r => r || new Response('', { status: 504 }));
      })
    );
  }
});
