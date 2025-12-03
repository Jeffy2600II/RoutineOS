const CACHE_NAME = "routineos-v1";
const CACHE_URLS = ["/", "/api/schedule", "/manifest.json"];

// ✅ ติดตั้ง Service Worker
self.addEventListener("install", (event) => {
  console.log("✅ Service Worker installed");
  self.skipWaiting();
  
  // แคชไฟล์สำคัญ
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS).catch((err) => {
        console.warn("⚠️ Cache failed:", err);
      });
    })
  );
});

// ✅ เปิดใช้งาน Service Worker
self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activated");
  self.clients.claim();
});

// 🎯 Periodic Background Sync - ตรวจสอบกิจวัตรทุก 15 นาที
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "check-tasks") {
    console.log("🔔 Periodic Sync triggered - checking tasks");
    event.waitUntil(checkAndNotifyTasks());
  }
});

// 📡 Background Sync - ส่งแจ้งเตือนเมื่อคืนเน็ต
self.addEventListener("sync", (event) => {
  if (event.tag === "notify-tasks") {
    console.log("📡 Background Sync triggered");
    event.waitUntil(checkAndNotifyTasks());
  }
});

// 🔔 จัดการเมื่อคลิกที่แจ้งเตือน
self.addEventListener("notificationclick", (event) => {
  console.log("🔔 Notification clicked:", event.notification.title);
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // หากมี tab ที่เปิด app อยู่ให้ focus
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      // หากไม่มี tab ให้เปิด app ใหม่
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

// 💾 Cache-first strategy สำหรับ API
self.addEventListener("fetch", (event) => {
  // ดึงข้อมูล schedule จากแคช ก่อน แล้วจึง update
  if (event.request.url.includes("/api/schedule")) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
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

// 🎯 ฟังก์ชันหลัก: ตรวจสอบและแจ้งเตือนกิจวัตร
async function checkAndNotifyTasks() {
  try {
    // ดึงข้อมูลกิจวัตร
    const res = await fetch("/api/schedule");
    const schedule = await res.json();
    
    // หาวันปัจจุบัน
    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const todayIndex = new Date().getDay();
    const todayKey = days[todayIndex];
    
    // ได้ระเบียบวันนี้
    const todayTasks = schedule[todayKey] || [];
    const now = new Date();
    const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    
    // ตรวจสอบแต่ละงาน
    for (let task of todayTasks) {
      const taskStartSeconds = timeToSeconds(task.start);
      
      // ถ้าถึงเวลาเริ่มงาน และยังไม่เคยแจ้งเตือน
      if (
        currentSeconds >= taskStartSeconds &&
        currentSeconds < taskStartSeconds + 120 // ช่วง 2 นาที
      ) {
        // เช็คว่าเคยส่งแจ้งเตือนไปแล้วหรือไม่
        const notificationId = `${todayIndex}-${task.start}`;
        const storedNotifications = await getStoredNotifications();
        
        if (!storedNotifications.includes(notificationId)) {
          // ส่งแจ้งเตือน
          await self.registration.showNotification(`🔔 ถึงเวลาเริ่มกิจวัตร! `, {
            body: `${task.start} - ${task.task}\n\n📝 ${task.description}`,
            tag: `task-${task.start}`,
            badge: "/icon-192.png",
            icon: "/icon-192.png",
            vibrate: [200, 100, 200],
            requireInteraction: true,
          });
          
          console.log(`✅ Background notification sent: ${task.task}`);
          
          // บันทึกว่าเคยส่งแจ้งเตือนแล้ว
          storedNotifications.push(notificationId);
          await saveStoredNotifications(storedNotifications);
        }
      }
    }
  } catch (err) {
    console.error("❌ Error in checkAndNotifyTasks:", err);
  }
}

// 🕐 แปลงเวลา HH:MM เป็นวินาที
function timeToSeconds(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 3600 + m * 60;
}

// 💾 บันทึกแจ้งเตือนที่ส่งไปแล้ว
async function getStoredNotifications() {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction("notifications", "readonly");
    const store = tx.objectStore("notifications");
    const result = await new Promise((resolve, reject) => {
      const request = store.get("sent");
      request.onsuccess = () => resolve(request.result?.data || []);
      request.onerror = reject;
    });
    return result;
  } catch {
    return [];
  }
}

async function saveStoredNotifications(notifications) {
  try {
    const db = await openIndexedDB();
    const tx = db.transaction("notifications", "readwrite");
    const store = tx.objectStore("notifications");
    store.put({ id: "sent", data: notifications });
  } catch (err) {
    console.warn("⚠️ Could not save to IndexedDB:", err);
  }
}

// 💾 เปิด IndexedDB
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("RoutineOS", 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("notifications")) {
        db.createObjectStore("notifications", { keyPath: "id" });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = reject;
  });
}