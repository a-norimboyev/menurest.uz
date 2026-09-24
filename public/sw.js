// Service Worker for QR Menyu PWA
const CACHE_NAME = 'qrmenu-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/css/landing.css',
  '/js/landing.js',
  '/favicon.png',
  '/images/logo.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Faqat GET so'rovlarni keshdan yoki tarmoqdan olish
  if (event.request.method !== 'GET') return;
  
  // API yoki real-time so'rovlarni to'g'ridan-to'g'ri tarmoqdan olish
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
