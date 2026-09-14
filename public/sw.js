// Muzaffarnagar Kaamgar - Progressive Web App Service Worker
const CACHE_NAME = 'kaamgar-pwa-v1.0.0'

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icon.svg',
  '/icon-maskable.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
]

// 1. Install: Precache app shell
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

// 3. Fetch: Smart strategy
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
    url.pathname.startsWith('/auth/')
  ) {
    return
  }

  // A. Navigation requests: Network-first with SPA offline fallback
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
        })
      })
    )
    return
  }

  // C. Default: Network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})
