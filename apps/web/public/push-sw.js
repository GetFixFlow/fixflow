// Added to the app's service worker (vite.config.ts, workbox.importScripts). It shows a push the server sent, and opens the
// right page when it is tapped. The server sends {title, body, url, tag} (PushNotifier).
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'FixFlow', {
      body: data.body || '',
      // The same tag replaces an earlier notification of that kind instead of piling up beside it.
      tag: data.tag || undefined,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: data.url || '/' },
    }),
  )
})

// A page of this app, never another address, whatever the message said.
function pageToOpen(url) {
  try {
    const target = new URL(url || '/', self.location.origin)
    return target.origin === self.location.origin ? target.href : self.location.origin + '/'
  } catch {
    return self.location.origin + '/'
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = pageToOpen(event.notification.data && event.notification.data.url)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          if ('navigate' in client) client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
