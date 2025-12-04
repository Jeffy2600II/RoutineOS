// ฟังก์ชันช่วย: ลงทะเบียน Periodic Sync และขอให้ทำ Push Subscription (client-side helper)
export async function setupPeriodicSync() {
  if (!("serviceWorker" in navigator) || !("periodicSync" in ServiceWorkerRegistration.prototype)) {
    console.warn("⚠️ Periodic Background Sync not supported");
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // ขอ permission (ถ้ามี)
    const permission = await navigator.permissions.query({
      name: "periodic-background-sync",
    });
    
    if (permission.state === "granted" || permission.state === "prompt") {
      await registration.periodicSync.register("check-tasks", {
        minInterval: 15 * 60 * 1000, // 15 นาที
      });
      console.log("✅ Periodic Sync registered successfully");
      return true;
    }
  } catch (err) {
    console.error("❌ Periodic Sync registration failed:", err);
  }
  
  return false;
}

// ฟังก์ชันช่วย: ตรวจสอบเบื้องหลัง (sync)
export async function requestBackgroundSync() {
  if (!("serviceWorker" in navigator) || !("SyncManager" in window)) {
    console.warn("⚠️ Background Sync not supported");
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register("notify-tasks");
    console.log("✅ Background Sync registered");
    return true;
  } catch (err) {
    console.error("❌ Background Sync registration failed:", err);
  }
  
  return false;
}

// ฟังก์ชันช่วย: สมัคร Push Subscription (ใช้เมื่อผู้ให้สิทธิ์)
export async function ensurePushSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    console.warn("⚠️ Push not supported in this browser");
    return null;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    // เช็ค VAPID public key จาก server
    const res = await fetch("/api/vapid");
    const json = await res.json();
    if (!json.publicKey) {
      console.warn("❌ VAPID public key not available");
      return null;
    }
    
    // Convert VAPID key
    function urlBase64ToUint8Array(base64String) {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
      const rawData = atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }
    
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      return existing;
    }
    
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(json.publicKey),
    });
    
    // POST subscription to server
    await fetch("/api/subscribe-push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub),
    });
    
    console.log("✅ Push subscription successful");
    return sub;
  } catch (err) {
    console.error("❌ ensurePushSubscription error:", err);
    return null;
  }
}