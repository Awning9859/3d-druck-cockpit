// Offline-Hülle für Trainingszeit. Die Trainingsdaten liegen im Browser (localStorage), nicht im Cache.
const CACHE = 'trainingszeit-v2';
const SHELL = ['./', './index.html', './styles.css', './data.js', './logic.js', './app.js', './manifest.webmanifest', './icons/icon.svg', './fonts/dm-sans-latin-400-normal.woff2', './fonts/dm-sans-latin-500-normal.woff2', './fonts/dm-sans-latin-700-normal.woff2', './fonts/dm-sans-latin-800-normal.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
