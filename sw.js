// Service worker: guarda una copia de la app y la sirve aunque no haya internet.
// IMPORTANTE: cada vez que se publique un cambio en cualquier archivo, subir este número.
const CACHE_VERSION = 'disciplina-v7';

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/agenda.js',
  './js/db.js',
  './js/habits.js',
  './js/icons.js',
  './js/logic.js',
  './js/priorities.js',
  './js/settings.js',
  './fonts/bebas-neue-400.woff2',
  './fonts/space-mono-400.woff2',
  './fonts/space-mono-700.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

// cache: 'reload' obliga a pedir cada archivo al servidor y no a la caché HTTP del navegador
// (si no, tras publicar podría guardarse una versión vieja mezclada con la nueva).
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          fetch(new Request(url, { cache: 'reload' })).then((res) => {
            if (!res.ok) throw new Error(`No se pudo bajar ${url}`);
            return cache.put(url, res);
          }),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Primero la copia guardada; si no está, internet.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)),
  );
});
