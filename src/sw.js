const CACHE_NAME = 'money-mate-v1';

const urlsToCache = [
  './',
  './index.html', 
  './manifest.json',
  './assets/icon/favicon.png',
  './assets/icon/android-chrome-192x192.png', 
  './assets/icon/android-chrome-512x512.png',
  './assets/shapes.svg'
]

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

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if available
        if (cachedResponse) {
          return cachedResponse;
        }

        // Clone the request for network fetch
        return fetch(event.request.clone())
          .then((networkResponse) => {
            // Check if response is valid
            if (!networkResponse || 
                networkResponse.status !== 200 || 
                networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Only cache specific file types
            const url = event.request.url;
            const shouldCache = url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|html)$/) ||
                               url.endsWith('/') ||
                               url.includes('/assets/');

            if (shouldCache) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                })
                .catch((err) => {
                  console.warn('Failed to cache:', event.request.url, err);
                });
            }

            return networkResponse;
          })
          .catch((error) => {
            console.warn('Network request failed:', event.request.url, error);
            
            // Return cached index.html for navigation requests when offline
            if (event.request.destination === 'document' || 
                event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
            
            // For other failed requests, just return the error
            return new Response('', {
              status: 408,
              statusText: 'Network request failed'
            });
          });
      })
      .catch((error) => {
        console.error('Cache match failed:', error);
        // Fallback to network if cache fails
        return fetch(event.request);
      })
  );
});