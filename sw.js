/* LottoLab USA — Service Worker
   Estratégia:
   - App shell (index, manifest, ícones): cache-first (abre offline e instantâneo).
   - Dados dos sorteios (data.ny.gov): stale-while-revalidate — devolve o cache na hora
     (carrega rápido) e, em paralelo, busca a versão mais nova para a próxima abertura.
     Assim o app abre instantâneo e nunca fica muito atrás do último sorteio. */

const VERSION = 'lottolab-usa-v1';
const SHELL = 'shell-' + VERSION;
const DATA  = 'data-' + VERSION;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Dados dos sorteios (data.ny.gov) -> stale-while-revalidate
  if (url.hostname.includes('data.ny.gov')) {
    e.respondWith(
      caches.open(DATA).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // App shell / mesmo domínio -> cache-first
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match('./index.html')))
    );
  }
});
