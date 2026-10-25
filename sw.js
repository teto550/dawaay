const V = 'dawaay-v5', SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const PUSH = 'https://dawaay-push.devidemele.workers.dev';
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k != V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method != 'GET' || u.origin != location.origin) return;
  const put = r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; };
  if (/drugs\.json|barcodes\.json|world\.json/.test(u.pathname)) {
    // الملفات الكبيرة: من الكاش فورًا وتتحدّث في الخلفية
    e.respondWith(caches.match(e.request).then(m => { const f = fetch(e.request).then(put); return m || f; }));
  } else {
    // باقي الملفات: الإنترنت الأول (علشان التحديثات توصل)، والكاش لو مفيش نت
    e.respondWith(fetch(e.request).then(put).catch(() => caches.match(e.request)));
  }
});

// بلّغ السيرفر إن العميل رد على الجرعة (علشان يبطّل تكرار التنبيه)
async function ack(k, snooze) {
  try {
    const s = await self.registration.pushManager.getSubscription();
    if (!s || !k) return;
    await fetch(PUSH + '/ack', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ endpoint: s.endpoint, k, snooze: !!snooze }) });
  } catch (_) {}
}

// إشعار الجرعة: بيجي والبرنامج مقفول، وبيتكرر كل دقيقة لحد ما تضغط "أخدته"
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || '⏰ ميعاد الدواء', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png',
    vibrate: [600, 200, 600, 200, 600, 200, 600, 200, 600],
    tag: 'dose-' + (d.k || ''), renotify: true, requireInteraction: true, silent: false,
    data: { k: d.k },
    actions: [{ action: 'taken', title: 'أخدته ✅' }, { action: 'snooze', title: 'بعد 10 دقايق' }],
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const k = (e.notification.data || {}).k, a = e.action;
  e.waitUntil((async () => {
    await ack(k, a == 'snooze');
    if (a) return; // ضغط على زرار: مفيش داعي نفتح البرنامج
    const l = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    return l.length ? l[0].focus() : clients.openWindow('./');
  })());
});
self.addEventListener('notificationclose', e => { const k = (e.notification.data || {}).k; if (k) e.waitUntil(ack(k, false)); });
