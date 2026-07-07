// Kill switch for the short-lived PWA service worker experiment. Takes over
// from whatever is currently registered at this scope, clears every cache it
// made, unregisters itself, and reloads any open tabs — so devices that
// picked up the old worker stop being stuck serving stale cached pages.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((client) => client.navigate(client.url))
    })()
  )
})
