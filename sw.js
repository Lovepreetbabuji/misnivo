// DareMarket service worker — offline app shell.
// Purpose: offline/refresh must never break the UI (icon font, css, js, page).
// Data comes from Firestore's own offline cache; videos are never cached here.
const VER = 'dm-shell-v1';

self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VER).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never intercept: Firebase/auth traffic, Cloudinary video streams/manifests
  if (url.hostname.includes('firestore') || url.hostname.includes('googleapis.com') && !url.hostname.startsWith('fonts.')) return;
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
        const c = r.clone(); caches.open(VER).then(x => x.put('/', c));
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

  // App shell (css/js/manifest/icon): stale-while-revalidate
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
