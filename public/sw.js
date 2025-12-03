const CACHE_NAME = "routineos-v2";
const POLLING_INTERVAL_MS = 30 * 1000; // 30 วินาที (fallback polling)
const DEDUP_TTL_MS = 10 * 60 * 1000; // 10 นาที

let pollingTimer = null;
let sseReader = null;
let sseControllerActive = false;
const sentNotifications = new Map(); // key -> timestamp

self.addEventListener("install", (event) => {
  console.log("✅ Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("✅ Service Worker activated");
  self.clients.claim();
  // เริ่ม monitoring แบบอิสระ (ไม่ต้องมีหน้าเว็บเปิด)
  event.waitUntil(startIndependentMonitoring());
});

// เริ่มการตรวจสอบแบบอิสระ: พยายามเชื่อม SSE ก่อน ถ้าไม่ได้ใช้ polling
async function startIndependentMonitoring() {
  try {
    console.log("🚀 Starting independent monitoring in SW...");
    
    // พยายามเชื่อมต่อ SSE (streaming)
    await startSSEStream();
    
    // ถ้าไม่สามารถอ่าน SSE stream ได้ ให้เริ่ม polling
    if (!sseControllerActive) {
      startPolling();
    }
    
  } catch (err) {
    console.error("❌ startIndependentMonitoring error:", err);
    startPolling();
  }
}

// ฟังก์ชันเชื่อม SSE โดยการ fetch และอ่าน stream
async function startSSEStream() {
  try {
    console.log("🔗 Attempting to open SSE stream from SW...");
    const resp = await fetch("/api/notifications/subscribe", {
      headers: { Accept: "text/event-stream" },
      cache: "no-store",
    });
    
    if (!resp || !resp.body) {
      console.warn("⚠️ SSE stream not available in SW. Response body missing.");
      sseControllerActive = false;
      return;
    }
    
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    sseReader = reader;
    sseControllerActive = true;
    
    let buffered = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("🔌 SSE stream closed by server");
        sseControllerActive = false;
        // ปิด reader แล้วลอง reconnect หลังจาก delay
        try { reader.releaseLock(); } catch (e) {}
        setTimeout(() => startSSEStream(), 5000);
        break;
      }
      
      buffered += decoder.decode(value, { stream: true });
      
      // แยกเป็นบรรทัด และ parse data: lines
      let parts = buffered.split("\n");
      // ถ้บรรทัดสุดท้ายยังไม่จบ ให้เก็บไว้ใน buffered
      buffered = parts.pop();
      
      for (let line of parts) {
        line = line.trim();
        if (!line) continue;
        if (line.startsWith("data:")) {
          const raw = line.slice(5).trim();
          try {
            const data = JSON.parse(raw);
            if (data?.type === "upcoming-task") {
              await handleUpcomingTask(data);
            }
          } catch (err) {
            // ถ้า parse ไม่ได้ ให้ข้าม
            // console.warn("⚠️ SSE parse error:", err);
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ SSE error in SW:", err);
    sseControllerActive = false;
    // reconnect with delay
    setTimeout(() => startSSEStream(), 5000);
  }
}

// Polling fallback: เรียก API เพื่อให้ server ส่ง event (POST) ทุก interval
function startPolling() {
  console.log("📡 Starting polling from SW (fallback)...");
  if (pollingTimer) clearInterval(pollingTimer);
  
  // ทำการเช็คทันที
  checkAndNotify().catch((e) => console.error("❌ initial check error:", e));
  
  pollingTimer = setInterval(() => {
    checkAndNotify().catch((e) => console.error("❌ polling check error:", e));
  }, POLLING_INTERVAL_MS);
}

// ฟังก์ชัน POST ไปยัง endpoint เพื่อให้ server ประมวลผลและ broadcast (server-side)
async function checkAndNotify() {
  try {
    const now = new Date();
    const dayIndex = now.getDay();
    
    const resp = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayIndex }),
      cache: "no-store",
    });
    
    if (!resp.ok) {
      console.warn("⚠️ checkAndNotify response not OK:", resp.status);
    } else {
      // server จะ broadcast ผ่าน SSE — SW อาจได้รับจาก SSE stream
      // แต่ในบาง environment SSE อาจถูกปิด -> server อาจตอบด้วยข้อมูล; handle ถ้ามี JSON คืนมา
      try {
        const json = await resp.clone().json().catch(() => null);
        if (json && json.tasksNotified && json.tasksNotified > 0) {
          console.log("📡 Server reported tasks notified:", json.tasksNotified);
        }
      } catch (err) {
        // ignore
      }
    }
  } catch (err) {
    console.error("❌ checkAndNotify error:", err);
  }
}

// จัดการ task ที่จะเกิดขึ้น: แสดง notification และป้องกันซ้ำ
async function handleUpcomingTask(data) {
  try {
    const key = `${data.dayIndex}-${data.task.start}-${data.task.task}`;
    const now = Date.now();
    
    // ตรวจสอบ dedup
    const prev = sentNotifications.get(key);
    if (prev && now - prev < DEDUP_TTL_MS) {
      // ส่งแล้วในช่วง TTL
      return;
    }
    
    // บันทึกเวลา
    sentNotifications.set(key, now);
    // ตั้ง timeout เพื่อลบ cache หลัง TTL
    setTimeout(() => sentNotifications.delete(key), DEDUP_TTL_MS + 1000);
    
    // แสดง Notification
    await self.registration.showNotification(`🔔 ถึงเวลาเริ่มกิจวัตร!`, {
      body: `${data.task.start} - ${data.task.task}\n\n📝 ${data.task.description || ""}`,
      tag: `task-${data.task.start}-${String(data.dayIndex)}`,
      badge: "/icon-192.png",
      icon: "/icon-192.png",
      vibrate: [200, 100, 200],
      requireInteraction: true,
      timestamp: Date.now(),
      data: {
        dayIndex: data.dayIndex,
        taskStart: data.task.start,
        taskTitle: data.task.task,
      },
    });
    
  } catch (err) {
    console.error("❌ handleUpcomingTask error:", err);
  }
}

// จัดการเมื่อผู้ใช้คลิก notification
self.addEventListener("notificationclick", (event) => {
  console.log("🔔 Notification clicked:", event.notification && event.notification.title);
  event.notification.close();
  
  event.waitUntil(
    clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        if (client.url && new URL(client.url).pathname === "/") {
          if ("focus" in client) return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});

self.addEventListener("notificationclose", (event) => {
  console.log("❌ Notification closed:", event.notification && event.notification.title);
});

// Support for one-off sync events
self.addEventListener("sync", (event) => {
  console.log("📡 SW 'sync' event:", event.tag);
  if (event.tag === "notify-tasks") {
    event.waitUntil(checkAndNotify());
  }
});

// Support for periodic sync (Chrome impl uses 'periodicsync' event)
self.addEventListener("periodicsync", (event) => {
  console.log("📅 SW 'periodicsync' event:", event.tag);
  if (event.tag === "check-tasks") {
    event.waitUntil(checkAndNotify());
  }
});