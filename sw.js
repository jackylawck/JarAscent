// sw.js
const CACHE_NAME = 'jarascent-v3.5';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './js/physics_core.js',
    './js/rockets_data.js',
    './js/rocket_builder.js',
    './js/rocket_engine.js',
    './js/rocket_game.js',
    './manifest.json',
    './JarAscenticon-192.png'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key);
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});
