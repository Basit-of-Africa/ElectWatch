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

// ==========================================
// Firebase Cloud Messaging & System Push Handlers
// ==========================================

// Handle incoming background Push events from FCM or Web Push Server
self.addEventListener('push', (event) => {
  console.log('[ServiceWorker] Push event received:', event);

  let data = {
    title: '🚨 EMERGENCY DANGER SOS ALERT',
    body: 'Urgent security incident reported by field observer.',
    link: '/incidents',
    tag: 'danger-sos-alert'
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = {
        title: parsed.title || parsed.notification?.title || data.title,
        body: parsed.body || parsed.message || parsed.notification?.body || data.body,
        link: parsed.link || parsed.data?.link || data.link,
        tag: parsed.tag || data.tag
      };
    } catch (err) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/pwa-icon.svg',
    badge: '/pwa-icon.svg',
    vibrate: [500, 150, 500, 150, 500, 150, 500],
    tag: data.tag || 'danger-sos-alert',
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.link || '/incidents'
    },
    actions: [
      { action: 'open_sos', title: '🚨 Open Emergency SOS' },
      { action: 'close', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle OS System Notification Click
self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] System notification clicked:', event);
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/incidents';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if window tab is already open and focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // If no tab is open, launch a new window to the target URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

