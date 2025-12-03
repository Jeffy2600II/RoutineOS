"use client";
import { useEffect, useState } from "react";

// ดึงข้อมูลกิจวัตร
async function fetchSchedule() {
  const res = await fetch("/api/schedule");
  return res.json();
}

function canUseNotificationAPI() {
  return typeof window !== "undefined"
    && "Notification" in window
    && "serviceWorker" in navigator;
}

export default function Home() {
  const [schedule, setSchedule] = useState({});
  const [notificationStatus, setNotificationStatus] = useState("loading");
  const [swRegistered, setSwRegistered] = useState(false);

  const days = [
    { key: "sunday", label: "อาทิตย์" },
    { key: "monday", label: "จันทร์" },
    { key: "tuesday", label: "อังคาร" },
    { key: "wednesday", label: "พุธ" },
    { key: "thursday", label: "พฤหัส" },
    { key: "friday", label: "ศุกร์" },
    { key: "saturday", label: "เสาร์" },
  ];
  const todayIndex = new Date().getDay();
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex);

  // ดึงข้อมูลกิจวัตร
  useEffect(() => {
    fetchSchedule().then(setSchedule);
  }, []);

  // ลงทะเบียน Service Worker ก่อนทำอะไร
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker. js")
        .then(reg => {
          console.log("✅ Service Worker registered successfully:", reg);
          setSwRegistered(true);
        })
        .catch(err => {
          console.error("❌ Service Worker registration failed:", err);
          setSwRegistered(false);
        });
    } else {
      console.warn("⚠️ Service Worker not supported in this browser");
    }
  }, []);

  // ขอ permission แจ้งเตือน
  useEffect(() => {
    if (canUseNotificationAPI() && swRegistered) {
      setNotificationStatus(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission(). then(permission => {
          setNotificationStatus(permission);
          console.log("Notification permission:", permission);
        });
      }
    } else {
      setNotificationStatus("not-supported");
    }
  }, [swRegistered]);

  // ตั้ง timer แจ้งเตือน (ใช้ SW เท่านั้น)
  useEffect(() => {
    if (! swRegistered || notificationStatus !== "granted") return;

    const tasks = schedule[days[todayIndex]?.key] || [];
    const timers = [];

    tasks.forEach(t => {
      const [h, m] = t.start.split(":").map(Number);
      const now = new Date();
      const taskTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      const msUntilTask = taskTime. getTime() - now.getTime();

      if (msUntilTask > 0) {
        timers.push(
          setTimeout(() => {
            showNotificationViaServiceWorker(`ถึงเวลาเริ่มกิจวัตร! `, `${t.start} - ${t.task}`);
          }, msUntilTask)
        );
      }
    });

    return () => timers.forEach(clearTimeout);
  }, [schedule, todayIndex, notificationStatus, swRegistered]);

  // sync วันอัตโนมัติ
  useEffect(() => {
    const interval = setInterval(() => {
      const nowDayIdx = new Date().getDay();
      if (nowDayIdx !== selectedDayIndex) setSelectedDayIndex(nowDayIdx);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedDayIndex]);

  // ฟังก์ชั่นแจ้งเตือนผ่าน Service Worker (วิธีถูกต้องเท่านั้น)
  function showNotificationViaServiceWorker(title, body) {
    if (!swRegistered) {
      alert("Service Worker ยังไม่ได้ลงทะเบียน");
      return;
    }

    navigator.serviceWorker.getRegistration(). then(reg => {
      if (reg) {
        reg.showNotification(title, {
          body: body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: "routineos-notification",
          requireInteraction: false,
        });
      } else {
        alert("ไม่พบ Service Worker ที่ลงทะเบียน");
      }
    }). catch(err => {
      console.error("Error showing notification:", err);
      alert("เกิดข้อผิดพลาดในการแจ้งเตือน:\n" + err.message);
    });
  }

  // ฟังก์ชั่นปุ่มทดสอบแจ้งเตือน (ใช้ SW เท่านั้น)
  function testNotification() {
    if (! canUseNotificationAPI()) {
      alert("❌ เบราว์เซอร์ของคุณไม่รองรับฟีเจอร์การแจ้งเตือน (ต้องมี Service Worker)");
      return;
    }

    if (! swRegistered) {
      alert("⏳ Service Worker ยังไม่ได้ลงทะเบียน กรุณารอสักครู่แล้วลองใหม่");
      return;
    }

    console.log("📢 Test notification - Permission:", Notification.permission);

    if (Notification.permission === "granted") {
      showNotificationViaServiceWorker("🎉 ทดสอบแจ้งเตือน!", "นี่คือข้อความทดสอบบน RoutineOS");
    } else if (Notification.permission === "denied") {
      alert(
        "❌ คุณได้ปฏิเสธสิทธิ์แจ้งเตือน\n\nกรุณาเปิดสิทธิ์ในเบราว์เซอร์ก่อนใช้งาน:\n" +
        "• Android: Settings > Notifications > RoutineOS\n" +
        "• iOS: Settings > RoutineOS > Notifications"
      );
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then(result => {
        setNotificationStatus(result);
        if (result === "granted") {
          showNotificationViaServiceWorker("🎉 ทดสอบแจ้งเตือน!", "นี่คือข้อความทดสอบบน RoutineOS");
        } else if (result === "denied") {
          alert(
            "❌ คุณได้ปฏิเสธสิทธิ์แจ้งเตือน\n\nกรุณาเปิดสิทธิ์ในเบราว์เซอร์ก่อนใช้งาน:\n" +
            "• Android: Settings > Notifications > RoutineOS\n" +
            "• iOS: Settings > RoutineOS > Notifications"
          );
        }
      });
    }
  }

  const selectedDay = days[selectedDayIndex] || days[todayIndex];
  const selectedTasks = schedule[selectedDay. key] || [];

  let notificationText = "";
  let notificationColor = "#888";

  switch (notificationStatus) {
    case "granted":
      notificationText = "เปิดใช้งานแล้ว ✅";
      notificationColor = "#2a2";
      break;
    case "denied":
      notificationText = "คุณไม่อนุญาตแจ้งเตือน ❌";
      notificationColor = "#e23";
      break;
    case "default":
      notificationText = "ยังไม่ได้อนุญาต 🟡";
      notificationColor = "#f80";
      break;
    case "not-supported":
      notificationText = "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน";
      notificationColor = "#e23";
      break;
    default:
      notificationText = "กำลังตรวจสอบ... ";
  }

  return (
    <>
      <h1>📅 กิจวัตรประจำวัน</h1>

      {/* สถานะ Service Worker */}
      <div style={{ marginBottom: 16, padding: "10px", background: swRegistered ? "#e8f5e9" : "#fff3cd", borderRadius: 8, fontSize: "14px", color: swRegistered ? "#2a2" : "#f80" }}>
        <strong>Service Worker: {swRegistered ? "✅ ลงทะเบียนสำเร็จ" : "⏳ กำลังลงทะเบียน..."}</strong>
      </div>

      {/* ปุ่มทดสอบแจ้งเตือน */}
      <button
        onClick={testNotification}
        disabled={!swRegistered}
        style={{
          marginBottom: 16,
          padding: "8px 24px",
          borderRadius: 8,
          background: swRegistered ? "#5fdb5f" : "#ccc",
          color: "#232",
          border: "none",
          fontWeight: "bold",
          cursor: swRegistered ? "pointer" : "not-allowed",
          opacity: swRegistered ? 1 : 0.6
        }}
      >
        ทดสอบแจ้งเตือน
      </button>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {days. map((d, idx) => (
          <button
            key={d.key}
            onClick={() => setSelectedDayIndex(idx)}
            style={{
              background: idx === selectedDayIndex ? "#2257df" : "#f5f5f5",
              color: idx === selectedDayIndex ?  "#fff" : "#333",
              padding: "6px 18px",
              borderRadius: 8,
              border: "none",
              fontWeight: idx === selectedDayIndex ? "bold" : "normal",
              cursor: "pointer",
              boxShadow: idx === selectedDayIndex ? "0 2px 10px #ccd" : "none"
            }}
          >
            {d. label}
          </button>
        ))}
        <button
          onClick={() => setSelectedDayIndex(todayIndex)}
          style={{
            background: "#ffda60",
            color: "#222",
            padding: "6px 18px",
            borderRadius: 8,
            border: "none",
            marginLeft: 6,
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Sync (กลับสู่วันนี้)
        </button>
      </div>

      <h2 style={{ marginTop: "-10px", color: "#666" }}>
        กิจวัตรประจำวัน "{selectedDay.label}"
      </h2>

      <div style={{ marginTop: "18px" }}>
        {selectedTasks.length === 0 ? (
          <div style={{ color: "#999" }}>ไม่มีข้อมูลกิจวัตรวันนี้</div>
        ) : (
          selectedTasks.map((t, i) => (
            <div
              key={i}
              style={{
                padding: "12px 16px",
                marginBottom: "10px",
                background: "#eef",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "16px"
              }}
            >
              <div style={{ fontWeight: "bold", minWidth: 85 }}>
                {t. start} – {t.end}
              </div>
              <div>{t.task}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 16, color: notificationColor, fontSize: "15px", padding: "12px", background: "#f5f5f5", borderRadius: 8 }}>
        <strong>สถานะแจ้งเตือน:</strong> {notificationText}
        {notificationStatus === "not-supported" && (
          <div style={{ color: "#e23", marginTop: 8 }}>
            ⚠️ แนะนำให้ใช้ Chrome/Firefox/Edge บน Android หรือ Safari (iOS 16. 4 ขึ้นไป) และ "เพิ่มไปที่หน้าแรก"
          </div>
        )}
        {! swRegistered && (
          <div style={{ color: "#f80", marginTop: 8 }}>
            ⏳ Service Worker กำลังลงทะเบียน กรุณารอสักครู่... 
          </div>
        )}
      </div>
    </>
  );
}