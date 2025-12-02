"use client";
import { useEffect, useState } from "react";

// ดึงข้อมูลจาก API
async function fetchSchedule() {
  const res = await fetch("/api/schedule");
  return res.json();
}

export default function Home() {
  const [schedule, setSchedule] = useState({});
  const [notificationPermission, setNotificationPermission] = useState(typeof window !== "undefined" ? Notification?.permission : "default");
  
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
  
  // ดึงข้อมูลกิจวัตรล่าสุด
  useEffect(() => {
    fetchSchedule().then(setSchedule);
  }, []);
  
  // ขออนุญาตแจ้งเตือนอัตโนมัติเมื่อเข้าหน้าจอ
  useEffect(() => {
    if ("Notification" in window && notificationPermission === "default") {
      Notification.requestPermission().then(setNotificationPermission);
    }
  }, [notificationPermission]);
  
  // ตั้ง timer แจ้งเตือนกิจวัตรของวันนี้
  useEffect(() => {
    if (notificationPermission !== "granted") return;
    // เฉพาะกิจวัตรของวันปัจจุบัน
    const tasks = schedule[days[todayIndex]?.key] || [];
    const notificationTimers = [];
    tasks.forEach((t, i) => {
      const [h, m] = t.start.split(":").map(Number);
      const now = new Date();
      const taskTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        h,
        m,
        0,
        0,
      );
      const msUntilTask = taskTime.getTime() - now.getTime();
      if (msUntilTask > 0) {
        const timer = setTimeout(() => {
          new window.Notification("ถึงเวลาเริ่มกิจวัตร!", {
            body: `${t.start} - ${t.task}`,
            icon: "/icon-192.png"
          });
        }, msUntilTask);
        notificationTimers.push(timer);
      }
    });
    return () => notificationTimers.forEach(clearTimeout);
  }, [schedule, notificationPermission, todayIndex]);
  
  // sync วันอัตโนมัติ ถ้าวันเปลี่ยน
  useEffect(() => {
    const interval = setInterval(() => {
      const nowDayIdx = new Date().getDay();
      if (nowDayIdx !== selectedDayIndex) setSelectedDayIndex(nowDayIdx);
    }, 1000 * 60 * 1);
    return () => clearInterval(interval);
  }, [selectedDayIndex]);
  
  const selectedDay = days[selectedDayIndex] || days[todayIndex];
  const selectedTasks = schedule[selectedDay.key] || [];
  
  // --- ฟังก์ชั่นทดสอบแจ้งเตือน ---
  function testNotification() {
    if ("Notification" in window) {
      if (notificationPermission === "granted") {
        new Notification("🎉 ทดสอบแจ้งเตือน!", {
          body: "นี่คือข้อความทดสอบบน RoutineOS",
          icon: "/icon-192.png"
        });
      } else if (notificationPermission === "denied") {
        alert("คุณปฏิเสธการแจ้งเตือนบนเบราว์เซอร์ กรุณาเปิดสิทธิ์ใหม่เพื่อใช้งานฟีเจอร์นี้");
      } else {
        // ร้องขออีกครั้ง
        Notification.requestPermission().then(result => {
          setNotificationPermission(result);
          if (result === "granted") {
            new Notification("🎉 ทดสอบแจ้งเตือน!", {
              body: "นี่คือข้อความทดสอบบน RoutineOS",
              icon: "/icon-192.png"
            });
          }
        });
      }
    }
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
          background: notificationPermission === "granted" ? "#5fdb5f" : "#eee",
          color: notificationPermission === "granted" ? "#123" : "#666",
          border: "none",
          fontWeight: "bold",
          cursor: "pointer"
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
              background: idx === selectedDayIndex ? "#2257df" : "#f5f5f5",
              color: idx === selectedDayIndex ? "#fff" : "#333",
              padding: "6px 18px",
              borderRadius: 8,
              border: "none",
              fontWeight: idx === selectedDayIndex ? "bold" : "normal",
              cursor: "pointer",
              boxShadow: idx === selectedDayIndex ? "0 2px 10px #ccd" : "none"
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
              <div style={{ fontWeight: "bold", minWidth: 85 }}>{t.start} – {t.end}</div>
              <div>{t.task}</div>
            </div>
          ))
        )}
      </div>
      <div style={{ marginTop:16,color:"#888" }}>
        แจ้งเตือน: {notificationPermission === "granted" ? "เปิดใช้งานแล้ว" : notificationPermission === "denied" ? "คุณไม่อนุญาตแจ้งเตือน" : "ยังไม่ได้อนุญาต"}
      </div>
    </>
  );
}