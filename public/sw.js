// ElectionMonitor Service Worker for Offline First Election Observation
const CACHE_NAME = 'election-monitor-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Event: Pre-cache core app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline app shell');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Partial pre-cache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-first strategy with cache fallback for app navigation
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests and non-extension/non-firestore API endpoints
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  // Handle SPA navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Update cache with fresh index.html
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback to cached app shell when offline
          console.log('[ServiceWorker] Offline fallback for navigation:', request.url);
          return caches.match('/index.html').then((cachedIndex) => {
            if (cachedIndex) return cachedIndex;
            return caches.match('/');
          });
        })
    );
    return;
  }

  // Network-first with cache fallback for JS/CSS/static assets
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return empty offline response or fallback if appropriate
          return new Response('Offline resource unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});

// Background Sync Event: Trigger sync when browser regains connection
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-election-reports' || event.tag === 'sync-reports') {
    console.log('[ServiceWorker] Background sync event triggered:', event.tag);
    event.waitUntil(notifyClientsToSync());
  }
});

// Listen to postMessages from active React app windows
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'TRIGGER_REPORT_SYNC') {
    console.log('[ServiceWorker] Manual sync requested via message');
    notifyClientsToSync();
  }
});

// Broadcast sync notification to all client tabs
async function notifyClientsToSync() {
  const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of allClients) {
    client.postMessage({
      type: 'SW_SYNC_PENDING_REPORTS',
      timestamp: new Date().toISOString()
    });
  }
}
