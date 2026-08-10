/**
 * FCM background handler — separate from sw.js (the app-shell worker) because
 * Firebase requires this exact filename at the site root.
 *
 * Runs only when the tab is closed or in the background; a foreground message
 * is handled by onMessage() in app.js instead.
 */
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyCAturzorr_8CJQrPf2lp-vJhgHJEofrTk",
  authDomain:        "mission-markit-9192a.firebaseapp.com",
  projectId:         "mission-markit-9192a",
  storageBucket:     "mission-markit-9192a.firebasestorage.app",
  messagingSenderId: "490715782561",
  appId:             "1:490715782561:web:e04d5ea4d86aa3b133ffe0"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const d = payload.data || {};
  self.registration.showNotification(n.title || 'MissionMarket', {
    body: n.body || '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag:  d.refId || undefined,      // same subject collapses instead of stacking
    data: { url: d.url || '/' }
  });
});

// Tapping the notification focuses an open tab instead of opening a new one.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
