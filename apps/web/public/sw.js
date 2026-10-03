// Ekalliptus service worker, runtime cache for static assets
// Versioning: bump CACHE_VERSION when you change cache strategy or want to invalidate clients
const CACHE_VERSION = 'v4-2026-09-25'
const STATIC_CACHE = `ekal-static-${CACHE_VERSION}`

const PRECACHE = [
  '/fonts/inter-latin-400-normal.woff2',
  '/fonts/inter-latin-500-normal.woff2',
  '/fonts/inter-latin-600-normal.woff2',
  '/fonts/inter-latin-700-normal.woff2',
  '/og-image.webp',
  '/ekalliptus_rounded.webp',
  '/logo_mobile.webp'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

const CACHE_FIRST_PATTERNS = [
  /^\/fonts\//,
  /^\/blog\/.+\.(svg|webp|png|jpg|jpeg)$/,
  /\.woff2?$/,
  /^\/(ekalliptus|logo|favicon|og-image)/
]

const isCacheFirst = (url) => CACHE_FIRST_PATTERNS.some((re) => re.test(url.pathname))

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Never cache API routes or auth-sensitive paths
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return

  if (isCacheFirst(url)) {
    // Cache-first for immutable static assets
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(STATIC_CACHE).then((c) => c.put(req, clone))
          }
          return res
        })
      })
    )
    return
  }

  // Locale navigation must always reach the server; never cache HTML.
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) return
})
