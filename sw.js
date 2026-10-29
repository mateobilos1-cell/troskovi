// Service worker: aplikacija se otvara iz datoteka spremljenih na uređaju (brzo i bez interneta).
// Nove verzije se preuzimaju u pozadini i vrijede od idućeg otvaranja.
const CACHE = 'finplus-v2';
const SHELL = [
  './', './index.html', './style.css', './app.js', './db.js', './config.js', './lock-early.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/apple-touch-icon.png', './vendor/supabase.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase ide ravno na mrežu
  e.respondWith(staleWhileRevalidate(e, req));
});

// Odmah vrati spremljenu verziju, a u pozadini preuzmi novu za idući put
async function staleWhileRevalidate(e, req) {
  const cache = await caches.open(CACHE);
  const isPage = req.mode === 'navigate';
  const key = isPage ? './index.html' : req; // stranica je uvijek index.html (bez obzira na ?parametre)
  const hit = await cache.match(key, { ignoreSearch: isPage });
  const update = fetch(req).then(async (res) => {
    if (!res.ok) return res;
    // javi aplikaciji da je stigla nova verzija
    const oldTag = hit?.headers.get('etag');
    const newTag = res.headers.get('etag');
    if (hit && oldTag && newTag && oldTag !== newTag) notify('update');
    await cache.put(key, res.clone());
    return res;
  }).catch(() => null);
  if (hit) {
    e.waitUntil(update);
    return hit;
  }
  return (await update) || new Response('Nema veze s internetom.', { status: 503 });
}

let notified = false;
async function notify(type) {
  if (notified) return;
  notified = true;
  (await self.clients.matchAll()).forEach((c) => c.postMessage({ type }));
}
