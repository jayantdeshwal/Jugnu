// Muzaffarnagar Kaamgar - Progressive Web App Service Worker
const CACHE_NAME = 'kaamgar-pwa-v1.1.0'

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.svg',
  '/icon.svg',
  '/icon-maskable.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
]

// 1. Install: Precache app shell and offline fallback
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_ASSETS)
    }).then(() => {
      return self.skipWaiting()
    })
  )
})

// 2. Activate: Invalidate old caches and claim clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('kaamgar-pwa-') && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    }).then(() => {
      return self.clients.claim()
    })
  )
})

// 3. Fetch: Smart strategy with Offline Support
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Don't cache Supabase auth/API calls or MSG91 verification
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('msg91.com') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/.well-known/')
  ) {
    return
  }

  // A. Navigation requests: Network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone and cache the latest HTML
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          if (cached) return cached
          const offlinePage = await caches.match('/offline.html')
          if (offlinePage) return offlinePage
          return caches.match('/index.html')
        })
    )
    return
  }

  // B. Static assets (JS, CSS, fonts, icons) -> Cache-first with network fallback
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.woff2') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached
        return fetch(request).then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response
          }
          const copy = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy))
          return response
        }).catch(async () => {
          return caches.match('/offline.html')
        })
      })
    )
    return
  }

  // C. Default: Network with cache fallback
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      return caches.match('/offline.html')
    })
  )
})

// 4. Background Sync: Sync offline actions when connectivity returns
self.addEventListener('sync', event => {
  if (event.tag === 'sync-bookings' || event.tag === 'sync-leads' || event.tag === 'background-sync') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SYNC_COMPLETED', tag: event.tag })
        })
      })
    )
  }
})

// 5. Periodic Background Sync: Fetch fresh worker updates/alerts periodically
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-alerts' || event.tag === 'periodic-sync') {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return fetch('/index.html').then(response => {
          if (response && response.status === 200) {
            return cache.put('/index.html', response)
          }
        }).catch(() => {})
      })
    )
  }
})

// 6. Push Notifications
self.addEventListener('push', event => {
  let data = { title: 'Muzaffarnagar Kaamgar', body: 'New update available!' }
  try {
    if (event.data) {
      data = event.data.json()
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text()
    }
  }

  const options = {
    body: data.body || 'You have a new update from Muzaffarnagar Kaamgar.',
    icon: '/icon-192.png',
    badge: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Muzaffarnagar Kaamgar', options)
  )
})

// 7. Notification Click Handler
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
