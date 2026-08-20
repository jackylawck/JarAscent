// sw.js 頂部
const CACHE_NAME = 'jarascent-v2.1'; // 每次更新修改此版本號
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
    self.skipWaiting(); // 強制跳過等待，立刻啟用新版本
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) return caches.delete(key); // 清除舊版本快取
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request)) // 優先讀取網路最新代碼
    );
});
