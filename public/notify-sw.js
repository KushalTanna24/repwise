// Imported into the generated service worker. Tapping a Repwise
// notification focuses the open app (or opens it) at the given URL.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate?.(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// Server-sent water reminders (Web Push). Payload: { title, body, url }.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    /* malformed payload: show the defaults */
  }
  const { title = 'Repwise', body = '', url = '/#/today' } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: 'water',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url },
    }),
  );
});
