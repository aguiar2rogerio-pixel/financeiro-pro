const CACHE_NAME = 'financeiro-v5'; // Incrementado para v5 para forçar a atualização do cache
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com' // Guardando o manual visual para nunca quebrar offline
];

// Instalação do Service Worker e armazenamento dos arquivos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting(); // Força o novo service worker a se ativar imediatamente
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache); // Limpa caches antigos
          }
        })
      );
    })
  );
});

// Estratégia de carregamento ultra rápido: Puxa do cache instantaneamente e atualiza em segundo plano
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse.status === 200) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(() => {
        // Silencia falhas de rede se estiver totalmente offline
      });

      return cachedResponse || fetchPromise;
    })
  );
});
