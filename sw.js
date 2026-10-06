// Offline support: use the network when there is one, the saved copy when there isn't.

const CACHE = 'talking-pets-v9';
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
  'js/games.js',
  'js/speech.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'js/pet3d.js',
  'vendor/three.module.js',
  'vendor/three.core.js',
  'vendor/RoomEnvironment.js',
  'js/recorder-worklet.js',
  'sounds/punch1.wav',
  'sounds/punch2.wav',
  'sounds/punch3.wav',
  'sounds/kick1.wav',
  'sounds/kick2.wav',
  'sounds/appear1.wav',
  'sounds/appear2.wav',
  'sounds/pop1.wav',
  'sounds/pop2.wav',
  'sounds/pop3.wav',
  'sounds/catch1.wav',
  'sounds/catch2.wav',
  'sounds/star1.wav',
  'sounds/bell1.wav',
  'sounds/miss1.wav',
  'sounds/tune1.wav',
  'sounds/win1.wav',
  'sounds/goal1.wav',
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
