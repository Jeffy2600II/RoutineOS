// Service Worker (ปรับใหม่ให้รองรับ Push API และยังเก็บ fallback เดิมไว้บางส่วน)
// ใช้ push event เป็นหลักในการแสดง Notification
const CACHE_NAME = "routineos-v2";

self.addEventListener("install", (event) => {
  console.log("✅ Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activated");
  self.clients.claim();
});

self.addEventListener("push", (event) => {
  try {
    const payload = event.data ? event.data.json() : { title: "🔔 RoutineOS", body: "ถึงเวลาแล้ว" };
    const title = payload.title || "🔔 RoutineOS";
    const options = {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      requireInteraction: payload.requireInteraction ?? true,
      data: payload.data || {},
      timestamp: payload.timestamp || Date.now(),
      vibrate: payload.vibrate || [200, 100, 200],
      tag: payload.tag || undefined,
    };
    
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error("❌ SW push handler error:", err);
  }
});

// เมื่อผู้ใช้คลิกที่ Notification
self.addEventListener("notificationclick", (event) => {
  console.log("🔔 Notification clicked:", event.notification && event.notification.title);
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // หากมีหน้าต่างเปิดอยู่แล้ว ให้ focus หน้าต่างแรกที่ path เป็น '/'
      for (let client of clientList) {
        if (client.url && new URL(client.url).pathname === "/" && "focus" in client) {
          return client.focus();
        }
      }
      // ถ้าไม่มี ให้เปิดหน้าต่างใหม่
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});

// หาก subscription เปลี่ยน (เช่น expired) → แจ้ง client ให้ re-subscribe
self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("🔁 pushsubscriptionchange event", event);
  event.waitUntil(
    (async () => {
      try {
        const reg = await self.registration.pushManager.getSubscription();
        // แจ้ง client ให้ re-subscribe (client จะรับ message และทำ subscribe ใหม่)
        const allClients = await clients.matchAll({ includeUncontrolled: true });
        for (const client of allClients) {
          client.postMessage({ type: "subscription-changed" });
        }
        // ถ้าไม่มี subscription ให้พยายาม re-subscribe (ขึ้นอยู่กับ browser policy)
        if (!reg) {
          // we intentionally don't auto-subscribe here without user's action
          console.log("No active subscription after change.");
        }
      } catch (err) {
        console.error("❌ Error handling subscription change:", err);
      }
    })()
  );
});

// Fallback: เก็บโค้ดเดิมบางส่วน (polling) แต่ใน SW background lifetime จำกัดมาก
// ถ้าต้องการ polling จริงจัง ควรใช้ server-side cron หรือ periodic background sync (ถ้ารองรับ)
async function tryPollingOnce(dayIndex) {
  try {
    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayIndex }),
    });
    console.log("📡 Polling check done");
  } catch (err) {
    console.error("❌ Polling attempt failed:", err);
  }
}

// รับข้อความจากหน้า client (เช่น สั่งให้ polling หรือบอกว่า subscription เปลี่ยน)
self.addEventListener("message", (event) => {
  try {
    const data = event.data;
    if (data && data.type === "trigger-poll") {
      const dayIndex = data.dayIndex || new Date().getDay();
      event.waitUntil(tryPollingOnce(dayIndex));
    }
  } catch (err) {
    console.error("❌ SW message handler error:", err);
  }
});