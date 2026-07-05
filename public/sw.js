var CACHE = 'tbs-v3';

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(function (keys) {
        return Promise.all(
          keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })
        );
      }),
    ])
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/admin/')) return;
  if (url.pathname === '/health') return;

  e.respondWith(
    caches.match(e.request).then(function (r) {
      return r || fetch(e.request).then(function (res) {
        if (url.pathname.match(/\.(js|css|png|svg|woff2?)$/) && res.ok) {
          var clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function () {
        return new Response('Offline', { status: 503 });
      });
    })
  );
});
