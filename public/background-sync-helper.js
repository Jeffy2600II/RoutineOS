// ฟังก์ชันช่วย: ลงทะเบียน Periodic Sync เมื่อ app โหลด
export async function setupPeriodicSync() {
  if (!("serviceWorker" in navigator) || !("periodicSync" in ServiceWorkerRegistration.prototype)) {
    console.warn("⚠️ Periodic Background Sync not supported");
    return false;
  }
  
  try {
    const registration = await navigator.serviceWorker.ready;
    
    // ขอ permission
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

// ฟังก์ชันช่วย: ตรวจสอบเบื้องหลัง
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