const V = 'dawaay-v1', SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k != V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method != 'GET' || u.origin != location.origin) return;
  const put = r => { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); return r; };
  if (/drugs\.json|barcodes\.json/.test(u.pathname)) {
    // الملفات الكبيرة: من الكاش فورًا وتتحدّث في الخلفية
    e.respondWith(caches.match(e.request).then(m => { const f = fetch(e.request).then(put); return m || f; }));
  } else {
    // باقي الملفات: الإنترنت الأول (علشان التحديثات توصل)، والكاش لو مفيش نت
    e.respondWith(fetch(e.request).then(put).catch(() => caches.match(e.request)));
  }
});
