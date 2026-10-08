// Service worker: deja la app y los mosaicos ya vistos disponibles sin internet.
// Subí este número cada vez que cambies index.html u otro archivo.
const VERSION = 'mcl-v1';
const TILES = 'mcl-tiles-v1';
const MAX_TILES = 600;

const LOCALES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const LEAFLET = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(LOCALES);
    await Promise.allSettled(LEAFLET.map((u) => c.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION && k !== TILES).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function recortar(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_TILES) {
    await Promise.all(keys.slice(0, keys.length - MAX_TILES).map((k) => cache.delete(k)));
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Mosaicos del mapa: primero lo guardado, si no hay, internet (y se guarda).
  if (url.hostname === 'tile.openstreetmap.org') {
    e.respondWith((async () => {
      const cache = await caches.open(TILES);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') {
          cache.put(req, res.clone());
          recortar(cache);
        }
        return res;
      } catch (err) {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  // La app y Leaflet: lo guardado al toque, y en segundo plano se actualiza.
  const propio = url.origin === self.location.origin || url.hostname === 'unpkg.com';
  if (!propio) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    const red = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(red); return hit; }
    const res = await red;
    if (res) return res;
    if (req.mode === 'navigate') return (await cache.match('./index.html')) || Response.error();
    return Response.error();
  })());
});
