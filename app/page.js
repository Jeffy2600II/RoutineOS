"use client";
import { useEffect, useState } from "react";

// ดึงข้อมูลผ่าน API
async function fetchSchedule() {
  const res = await fetch("/api/schedule");
  return res.json();
}

export default function Home() {
  const [schedule, setSchedule] = useState({});
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  
  // ดึงข้อมูลกิจวัตร
  useEffect(() => {
    fetchSchedule().then(setSchedule);
  }, []);
  
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const todayIndex = new Date().getDay();
  const today = days[todayIndex];
  const tasks = schedule[today] || [];
  
  // แจ้งเตือนกิจวัตรเมื่อถึงเวลาเริ่มต้น
  useEffect(() => {
    if (!notificationEnabled || tasks.length === 0) return;
    
    const notificationTimers = [];
    
    tasks.forEach((t, i) => {
      // คำนวณเวลาเริ่มต้น
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
      
      // ตั้งเวลานับถอยหลังเฉพาะกิจวัตรที่ยังไม่เลยไปแล้ว
      if (msUntilTask > 0) {
        const timer = setTimeout(() => {
          if (window.Notification && Notification.permission === "granted") {
            new window.Notification("ถึงเวลาเริ่มกิจวัตร!", {
              body: `${t.start} - ${t.task}`,
              icon: "/icon-192.png"
            });
          }
        }, msUntilTask);
        notificationTimers.push(timer);
      }
    });
    
    // เคลียร์ timer เมื่อหยุดแจ้งเตือนหรือเปลี่ยนวัน
    return () => {
      notificationTimers.forEach(clearTimeout);
    };
  }, [notificationEnabled, tasks]);
  
  // ขอสิทธิ์แจ้งเตือน
  function enableNotification() {
    if ("Notification" in window) {
      Notification.requestPermission().then(result => {
        if (result === "granted") {
          setNotificationEnabled(true);
        }
      });
    } else {
      alert("เบราว์เซอร์ไม่รองรับการแจ้งเตือน");
    }
  }
  
  return (
    <>
      <h1>📅 กิจวัตรประจำวัน</h1>
      <h2 style={{ marginTop: "-10px", color: "#666" }}>
        วันนี้: {today.toUpperCase()}
      </h2>
      <button
        style={{ marginTop: 10, marginBottom: 15 }}
        onClick={enableNotification}
        disabled={notificationEnabled}
      >
        {notificationEnabled ? "เปิดใช้งานแจ้งเตือนแล้ว" : "เปิดแจ้งเตือนกิจวัตรวันนี้"}
      </button>
      <div style={{ marginTop: "20px" }}>
        {tasks.map((t, i) => (
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
        ))}
      </div>
    </>
  );
}