"use client";
import { useEffect, useState } from "react";

// ดึงข้อมูลกิจวัตร
async function fetchSchedule() {
  const res = await fetch("/api/schedule");
  return res.json();
}

function canUseNotificationAPI() {
  // เช็คว่ามีฟีเจอร์นี้และ constructor
  return typeof window !== "undefined"
    && "Notification" in window
    && typeof Notification === "function";
}

export default function Home() {
  const [schedule, setSchedule] = useState({});
  const [notificationStatus, setNotificationStatus] = useState("loading"); // รับค่า: granted/denied/default/not-supported
  const [registration, setRegistration] = useState(null);

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

  // ลงทะเบียน Service Worker
  useEffect(() => {
    if (canUseNotificationAPI() && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        . then((reg) => {
          console.log("Service Worker registered:", reg);
          setRegistration(reg);
        })
        . catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
    }
  }, []);

  // ขอ permission แจ้งเตือนทันทีถ้า supported
  useEffect(() => {
    if (canUseNotificationAPI()) {
      setNotificationStatus(Notification.permission);
      if (Notification.permission === "default") {
        Notification.requestPermission().then(setNotificationStatus);
      }
    } else {
      setNotificationStatus("not-supported");
    }
  }, []);

  // ตั้ง timer แจ้งเตือนกิจวัตรวันนี้เมื่อ permission OK และ API พร้อม
  useEffect(() => {
    if (
      ! canUseNotificationAPI() ||
      notificationStatus !== "granted" ||
      !registration
    )
      return;

    const tasks = schedule[days[todayIndex]?. key] || [];
    const timers = [];

    tasks.forEach((t) => {
      const [h, m] = t.start.split(":").map(Number);
      const now = new Date();
      const taskTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        h,
        m,
        0,
        0
      );
      const msUntilTask = taskTime.getTime() - now.getTime();

      if (msUntilTask > 0) {
        timers.push(
          setTimeout(async () => {
            try {
              await registration.showNotification("ถึงเวลาเริ่มกิจวัตร!", {
                body: `${t.start} - ${t.task}`,
                icon: "/icon-192.png",
              });
              console.log(`Notification sent for: ${t.task}`);
            } catch (err) {
              console.error("Notification error:", err);
              alert(
                `ถึงเวลาเริ่มกิจวัตร!\n${t.start} - ${t.task}\nError: ${err.message}`
              );
            }
          }, msUntilTask)
        );
      }
    });

    return () => timers.forEach(clearTimeout);
  }, [schedule, todayIndex, notificationStatus, registration]);

  // sync วันอัตโนมัติ
  useEffect(() => {
    const interval = setInterval(() => {
      const nowDayIdx = new Date().getDay();
      if (nowDayIdx !== selectedDayIndex) setSelectedDayIndex(nowDayIdx);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedDayIndex]);

  // ฟังก์ชั่นปุ่มทดสอบแจ้งเตือน
  async function testNotification() {
    if (! canUseNotificationAPI()) {
      alert(
        "เบราว์เซอร์ของคุณไม่รองรับฟีเจอร์การแจ้งเตือน (Notification API)"
      );
      return;
    }

    console.log("Notification. permission:", Notification.permission);

    if (Notification.permission === "granted") {
      if (! registration) {
        alert("Service Worker ยังไม่พร้อม กรุณารอสักครู่");
        return;
      }

      try {
        await registration.showNotification("🎉 ทดสอบแจ้งเตือน!", {
          body: "นี่คือข้อความทดสอบบน RoutineOS",
          icon: "/icon-192.png",
        });
        console.log("Test notification sent successfully");
      } catch (err) {
        alert(
          "แจ้งเตือนแบบ Notification ไม่สำเร็จ (ดูรายละเอียดใน console)\n" +
            (err.message || "Unknown error")
        );
        console.error("Notification error:", err);
      }
    } else if (Notification.permission === "denied") {
      alert(
        "คุณได้ปฏิเสธสิทธิ์แจ้งเตือน กรุณาเปิดสิทธิ์ในเบราว์เซอร์ก่อนใช้งาน"
      );
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then(async (result) => {
        setNotificationStatus(result);
        if (result === "granted") {
          if (!registration) {
            alert("Service Worker ยังไม่พร้อม กรุณารอสักครู่");
            return;
          }

          try {
            await registration.showNotification("🎉 ทดสอบแจ้งเตือน!", {
              body: "นี่คือข้อความทดสอบบน RoutineOS",
              icon: "/icon-192.png",
            });
            console.log("Test notification sent successfully");
          } catch (err) {
            alert(
              "แจ้งเตือนแบบ Notification ไม่สำเร็จ (ดูรายละเอียดใน console)\n" +
                (err. message || "Unknown error")
            );
            console.error("Notification error:", err);
          }
        } else if (result === "denied") {
          alert(
            "คุณได้ปฏิเสธสิทธิ์แจ้งเตือน กรุณาเปิดสิทธิ์ในเบราว์เซอร์ก่อนใช้งาน"
          );
        } else {
          alert("คุณยังไม่ได้อนุญาตให้แจ้งเตือน");
        }
      });
    }
  }

  const selectedDay = days[selectedDayIndex] || days[todayIndex];
  const selectedTasks = schedule[selectedDay. key] || [];

  let notificationText = "";
  switch (notificationStatus) {
    case "granted":
      notificationText = "เปิดใช้งานแล้ว ✅";
      break;
    case "denied":
      notificationText = "คุณไม่อนุญาตแจ้งเตือน ❌";
      break;
    case "default":
      notificationText = "ยังไม่ได้อนุญาต 🟡";
      break;
    case "not-supported":
      notificationText = "เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน";
      break;
    default:
      notificationText = "กำลังตรวจสอบ... ";
  }

  return (
    <>
      <h1>📅 กิจวัตรประจำวัน</h1>
      {/* ปุ่มทดสอบแจ้งเตือน */}
      <button
        onClick={testNotification}
        style={{
          marginBottom: 16,
          padding: "8px 24px",
          borderRadius: 8,
          background: "#5fdb5f",
          color: "#232",
          border: "none",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        ทดสอบแจ้งเตือน
      </button>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {days.map((d, idx) => (
          <button
            key={d.key}
            onClick={() => setSelectedDayIndex(idx)}
            style={{
              background: idx === selectedDayIndex ?  "#2257df" : "#f5f5f5",
              color: idx === selectedDayIndex ?  "#fff" : "#333",
              padding: "6px 18px",
              borderRadius: 8,
              border: "none",
              fontWeight: idx === selectedDayIndex ? "bold" : "normal",
              cursor: "pointer",
              boxShadow: idx === selectedDayIndex ? "0 2px 10px #ccd" : "none",
            }}
          >
            {d.label}
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
            cursor: "pointer",
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
                gap: "16px",
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
      <div style={{ marginTop: 16, color: "#888", fontSize: "15px" }}>
        แจ้งเตือน: <strong>{notificationText}</strong>
        {notificationStatus === "not-supported" ?  (
          <div style={{ color: "#e23" }}>
            แนะนำให้เปิดผ่าน Chrome/Firefox/Edge บน Android, หรือ Safari (iOS
            16. 4 ขึ้นไป)
          </div>
        ) : null}
      </div>
    </>
  );
}