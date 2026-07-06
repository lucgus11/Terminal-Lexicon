const CACHE_NAME = 'lexicon-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/src/main.ts',
  '/src/style.css',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});
