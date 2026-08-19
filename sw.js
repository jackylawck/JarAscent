const CACHE_NAME = 'jarascent-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './JarAscenticon-192.png',
  './JarAscenticon-512.png',
  './js/rocket_game.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)).catch(err => console.warn('Cache warning:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(k => { if (k !== CACHE_NAME) return caches.delete(k); })
    ))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
