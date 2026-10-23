/* RoutePratique – service worker: bewaart de app-bestanden, laat API-verkeer ongemoeid */
const CACHE = 'routepratique-v2.1.3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './logic.js',
  './app.js',
  './woorden.js',
  './vocab.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

/* cache: 'reload' slaat de HTTP-cache van de browser over (GitHub Pages bewaart bestanden tot 10 minuten),
   zodat een nieuwe versie nooit met oude bestanden wordt gevuld. */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Netwerk eerst (zodat updates meteen doorkomen), cache als terugval.
   cache: 'no-cache' laat de browser altijd bij de server controleren of er een nieuwere versie is. */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
