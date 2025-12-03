const CACHE_NAME = "routineos-v2";

self.addEventListener("install", (event) => {
  console.log("✅ Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activated");
  self.clients.claim();
  
  // ✨ เริ่มตรวจสอบเมื่อ activate
  event.waitUntil(startRealtimeMonitoring());
});

// 🎯 Real-Time Monitoring - ตรวจสอบกิจวัตรแบบ Real-Time
async function startRealtimeMonitoring() {
  try {
    console.log("🚀 Starting Real-Time monitoring...");
    
    // ✅ เชื่อมต่อ SSE
    const response = await fetch("/api/notifications/subscribe");
    
    if (!response.body) {
      console.warn("⚠️ SSE not supported, falling back to polling");
      return startPolling();
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log("🔌 SSE connection closed");
        // ✅ Reconnect เมื่อ disconnect
        setTimeout(() => startRealtimeMonitoring(), 3000);
        break;
      }
      
      const text = decoder.decode(value);
      const lines = text.split("\n");
      
      for (let line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === "upcoming-task") {
              console.log("🔔 Real-time notification received:", data.task);
              
              // ✅ ส่ง notification
              await self.registration.showNotification(
                `🔔 ถึงเวลาเริ่มกิจวัตร! `,
                {
                  body: `${data.task.start} - ${data.task.task}\n\n📝 ${data.task.description}`,
                  tag: `task-${data.task.start}`,
                  badge: "/icon-192.png",
                  icon: "/icon-192.png",
                  vibrate: [200, 100, 200],
                  requireInteraction: true,
                  timestamp: Date.now(),
                }
              );
            }
          } catch (err) {
            // ข้าม line ว่าง
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ Real-time monitoring error:", err);
    // Fallback ไป polling
    startPolling();
  }
}

// 🔄 Fallback: Polling ทุก 5 นาที (ถ้า SSE ไม่ได้ผล)
async function startPolling() {
  console.log("📡 Starting polling mode (fallback)...");
  
  while (true) {
    try {
      const now = new Date();
      const dayIndex = now.getDay();
      
      // ✅ POST เพื่อให้ server ส่ง notification
      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayIndex }),
      });
      
      console.log("📡 Polling check completed");
    } catch (err) {
      console.error("❌ Polling error:", err);
    }
    
    // ✅ รอ 5 นาที ก่อนเช็คครั้งถัดไป
    await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
  }
}

// 🔔 จัดการเมื่อคลิกที่แจ้งเตือน
self.addEventListener("notificationclick", (event) => {
  console.log("🔔 Notification clicked:", event.notification.title);
  event.notification.close();
  
  event.waitUntil(
    clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clientList) => {
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