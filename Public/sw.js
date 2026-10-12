const CACHE_NAME = 'orderpoint-pro-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Cache dynamic icon generation messages from client
let cachedIcons = {};

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_ICONS') {
    cachedIcons['icon-192'] = event.data.icon192;
    cachedIcons['icon-512'] = event.data.icon512;
  }
});

function dataURLtoBlob(dataurl) {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], {type:mime});
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Return generated icons if present
  if (url.pathname === '/icon-192.png' && cachedIcons['icon-192']) {
    event.respondWith(
      Promise.resolve(new Response(dataURLtoBlob(cachedIcons['icon-192']), {
        headers: { 'Content-Type': 'image/png' }
      }))
    );
    return;
  }
  if (url.pathname === '/icon-512.png' && cachedIcons['icon-512']) {
    event.respondWith(
      Promise.resolve(new Response(dataURLtoBlob(cachedIcons['icon-512']), {
        headers: { 'Content-Type': 'image/png' }
      }))
    );
    return;
  }

  // Bypass all Firestore/Firebase and API calls from cache
  if (
    url.pathname.includes('/api/') || 
    url.hostname.includes('firebase') || 
    url.hostname.includes('firestore') || 
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        // Fallback for document navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
