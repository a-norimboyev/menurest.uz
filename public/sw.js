const CACHE_NAME = 'planner365-v2'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg']
const MAX_RUNTIME_CACHE_ITEMS = 60

function isSameOrigin(url) {
  return new URL(url).origin === self.location.origin
}

async function trimRuntimeCache(cache) {
  const keys = await cache.keys()
  const runtimeKeys = keys.filter((request) => {
    const path = new URL(request.url).pathname
    return !APP_SHELL.includes(path)
  })

  const overflow = runtimeKeys.length - MAX_RUNTIME_CACHE_ITEMS
  if (overflow <= 0) return

  for (let i = 0; i < overflow; i += 1) {
    await cache.delete(runtimeKeys[i])
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL)
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (!isSameOrigin(event.request.url)) return

  const isNavigation = event.request.mode === 'navigate'

  event.respondWith(
    (async () => {
      if (isNavigation) {
        try {
          const fresh = await fetch(event.request)
          if (fresh.ok) {
            const cache = await caches.open(CACHE_NAME)
            await cache.put('/index.html', fresh.clone())
          }
          return fresh
        } catch {
          return (await caches.match('/index.html')) || Response.error()
        }
      }

      const cached = await caches.match(event.request)
      if (cached) return cached

      try {
        const response = await fetch(event.request)
        if (response.ok && response.type === 'basic') {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(event.request, response.clone())
          await trimRuntimeCache(cache)
        }
        return response
      } catch {
        return Response.error()
      }
    })(),
  )
})
