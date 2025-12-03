self.addEventListener('install', (event) => {
  console.log('✅ Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
  self.clients.claim();
});

// จัดการเมื่อคลิกที่แจ้งเตือน
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked:', event.notification.title);
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// จัดการเมื่อปิดแจ้งเตือน
self.addEventListener('notificationclose', (event) => {
  console.log('❌ Notification closed:', event.notification.title);
});