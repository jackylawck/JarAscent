const CACHE_NAME = 'jarascent-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './js/rocket_game.js',
  './js/rocket_engine.js',
  './js/physics_core.js',
  './js/rocket_builder.js',
  './js/rockets_data.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(response => response || fetch(event.request)));
});
