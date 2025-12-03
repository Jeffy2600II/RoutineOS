self.addEventListener("install", (event) => {
  console.log("✅ Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activated");
  self.clients.claim();
});

// 🔔 จัดการเมื่อคลิกที่แจ้งเตือน
self.addEventListener("notificationclick", (event) => {
  console.log("🔔 Notification clicked:", event.notification.title);
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});

// ❌ จัดการเมื่อปิดแจ้งเตือน
self.addEventListener("notificationclose", (event) => {
  console.log("❌ Notification closed:", event.notification.title);
});

// 💾 Cache strategy
self.addEventListener("fetch", (event) => {
  // ข้ามการแคช /api/events (real-time stream)
  if (event.request.url.includes("/api/events")) {
    return;
  }
  
  // ใช้ cache-first strategy สำหรับ schedule
  if (event.request.url.includes("/api/schedule")) {
    event.respondWith(
      caches.open("routineos-cache").then((cache) => {
        return cache.match(event.request).then((response) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
          return response || fetchPromise;
        });
      })
    );
  }
});