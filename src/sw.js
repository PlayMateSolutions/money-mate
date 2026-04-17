const SW_VERSION = 'v2';
const CACHE_NAME = `money-mate-${SW_VERSION}`;

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon/favicon.png',
  './assets/icon/android-chrome-192x192.png',
  './assets/icon/android-chrome-512x512.png',
  './assets/shapes.svg'
];

const isNavigationRequest = (request) => request.mode === 'navigate' || request.destination === 'document';
const isCacheableAssetRequest = (request) => {
  const url = request.url;
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/.test(url) || url.includes('/assets/');
};

// Install event - cache static resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Failed to cache resources during install:', error);
      })
  );
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Claim clients immediately
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-HTTP(S) requests and development requests
  if (!event.request.url.startsWith('http') || 
      event.request.url.includes('@vite') ||
      event.request.url.includes('hot-update') ||
      event.request.url.includes('sockjs-node') ||
      event.request.method !== 'GET') {
    return;
  }

  if (isNavigationRequest(event.request)) {
    event.respondWith((async () => {
      try {
        const networkResponse = await fetch(event.request);
        if (networkResponse && networkResponse.status === 200) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('./index.html', networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        console.warn('Navigation network request failed:', event.request.url, error);
        const cachedIndex = await caches.match('./index.html');
        if (cachedIndex) {
          return cachedIndex;
        }

        return new Response('', {
          status: 408,
          statusText: 'Network request failed'
        });
      }
    })());
    return;
  }

  if (!isCacheableAssetRequest(event.request)) {
    return;
  }

  event.respondWith((async () => {
    const cachedResponse = await caches.match(event.request);
    if (cachedResponse) {
      return cachedResponse;
    }

    try {
      const networkResponse = await fetch(event.request);
      if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      console.warn('Asset network request failed:', event.request.url, error);
      return new Response('', {
        status: 408,
        statusText: 'Network request failed'
      });
    }
  })());
});