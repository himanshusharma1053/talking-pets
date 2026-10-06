// Offline support: use the network when there is one, the saved copy when there isn't.

const CACHE = 'talking-pets-v3';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icon.svg',
  'js/app.js',
  'js/pets.js',
  'js/state.js',
  'js/vad.js',
  'js/voice.js',
  'js/sounds.js',
  'js/actions.js',
  'js/speech.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/pet3d.js',
  'vendor/three.module.js',
  'vendor/three.core.js',
  'js/recorder-worklet.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  );
});
