self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Atualização do pedido', {
      body: data.body || 'Seu pedido teve uma nova atualização.',
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: {
        url: data.url || '/',
      },
      tag: data.tag || 'pedido-status',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
