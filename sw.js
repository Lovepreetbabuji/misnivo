// Misnivo service worker — offline app shell.
// Purpose: offline/refresh must never break the UI (icon font, css, js, page).
// Data comes from Firestore's own offline cache; videos are never cached here.
//
// VER MUST be bumped with the ?v= cache-buster in index.html. A stale VER means
// the activate step deletes nothing, so every version of css/js ever fetched
// stays in the cache — and the offline fallback can then pair an old cached
// index.html with the old assets it points at, rendering a UI from months ago.
const VER = 'dm-shell-20260821b';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
      .catch(() => {})
      .then(() => self.clients.claim())
  );
});

// THE rule of this file: the cache is an optimisation, never a dependency.
// caches.open() can reject — private windows, storage pressure, a corrupted or
// evicted store — and a worker that lets that reach respondWith() turns every
// request it intercepts into a network error. That is the whole app failing to
// load because a cache was unavailable. Anything touching storage degrades to a
// plain fetch instead.
const openCache = () => caches.open(VER).catch(() => null);
const quietPut = (c, req, res) => { if (c) { try { c.put(req, res).catch(() => {}); } catch (e) {} } };

// Whatever the fresh page no longer points at is dead weight that the offline
// fallback could otherwise resurrect. Prune on every successful navigation, so
// the cache self-heals even if VER was forgotten.
async function _prune(cache, html) {
  if (!cache) return;
  const keys = await cache.keys().catch(() => []);
  for (const k of keys) {
    const u = new URL(k.url);
    if (u.origin !== self.location.origin) continue;
    if (!(u.pathname.startsWith('/css/') || u.pathname.startsWith('/js/'))) continue;
    if (html.indexOf(u.pathname + u.search) !== -1) continue;   // still referenced
    await cache.delete(k).catch(() => {});
  }
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
    url.pathname.endsWith('.webmanifest') || url.pathname.endsWith('.svg') ||
    url.pathname === '/misnivo.png'   // the logo and the splash — the shell is not a shell without it
  );
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (req.mode !== 'navigate' && !isShell && !isFont) return;   // everything else is the browser's own business

  // SPA navigations: network first, offline → cached shell
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => {
        const copy = r.clone();
        e.waitUntil(
          r.clone().text()
            .then(html => openCache().then(c => {
              if (!c) return;
              quietPut(c, '/', copy);
              return _prune(c, html);
            }))
            .catch(() => {})
        );
        return r;
      }).catch(() =>
        openCache()
          .then(c => c ? c.match('/') : null)
          .catch(() => null)
          .then(hit => hit || Response.error())
      )
    );
    return;
  }

  // Fonts (icon font included): cache-first — immutable in practice
  if (isFont) {
    e.respondWith((async () => {
      const c = await openCache();
      if (c) { const hit = await c.match(req).catch(() => null); if (hit) return hit; }
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') quietPut(c, req, r.clone());
      return r;
    })().catch(() => fetch(req)));
    return;
  }

  // App shell (css/js/manifest/icon): stale-while-revalidate. Safe because these
  // URLs carry ?v= — a new build is a new URL, so it can never be served stale.
  e.respondWith((async () => {
    const c = await openCache();
    if (!c) return fetch(req);                       // no cache today → just the network
    const hit = await c.match(req).catch(() => null);
    const net = fetch(req).then(r => { if (r.ok) quietPut(c, req, r.clone()); return r; });
    if (hit) { net.catch(() => {}); return hit; }
    return net;
  })().catch(() => fetch(req)));
});
