const CACHE_NAME = 'financeiro-v1';
const assets = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn-icons-png.flaticon.com/512/2454/2454261.png' // 👉 Adicionado o ícone ao cache
];

self.addEventListener('install', e => {
  // Força o Service Worker atual a se tornar ativo imediatamente, sem esperar o usuário fechar o app
  self.skipWaiting(); 
  
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('activate', e => {
  // Permite que o Service Worker controle a página atual imediatamente após a ativação
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
