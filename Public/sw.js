const CACHE_NAME = 'orderpoint-pro-cache-v9';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting obsolete cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache dynamic icon generation messages from client
let cachedIcons = {};

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_ICONS') {
    cachedIcons['icon-192'] = event.data.icon192;
    cachedIcons['icon-512'] = event.data.icon512;
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
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
    url.hostname.includes('googleapis') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Network-First for navigation & HTML document requests
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // Network-First with cache fallback for static assets
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
